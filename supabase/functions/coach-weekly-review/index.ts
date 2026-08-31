// Generate the weekly meta-coach review for the authenticated user.
// Pulls last 7 days of check-ins, reflections, mission logs and program logs,
// then asks the AI to identify the driver of the week, wins, frictions, and next-week focus.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sportBreakdown } from "../_shared/sports.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const startOfWeekISO = (d = new Date()) => {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // Mon=0
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
};

const TOOL = {
  type: "function" as const,
  function: {
    name: "emit_weekly_review",
    description: "Emit this week's meta-coach review.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["performance_score", "driver_of_week", "wins", "frictions", "next_week_focus"],
      properties: {
        performance_score: { type: "integer", minimum: 0, maximum: 100 },
        driver_of_week: { type: "string", maxLength: 80 },
        wins: { type: "array", maxItems: 3, items: { type: "string", maxLength: 120 } },
        frictions: { type: "array", maxItems: 3, items: { type: "string", maxLength: 120 } },
        next_week_focus: { type: "string", maxLength: 240 },
        program_tweak: { type: "string", maxLength: 200 },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    const { data: hasAccess } = await supabase.rpc("has_active_access", { _user_id: userId });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Active membership required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const sinceDate = since.slice(0, 10);

    const [checkinsRes, reflectionsRes, missionsRes, athleteRes, goalRes] = await Promise.all([
      supabase.from("daily_checkins")
        .select("checked_in_at, sleep_hours, workout, sport, cold_shower, healthy_food, hydration_liters, xp_earned")
        .eq("user_id", userId).gte("checked_in_at", since).order("checked_in_at", { ascending: true }),
      supabase.from("coach_reflections")
        .select("reflection_date, energy_1to5, sleep_quality_1to5, mood_1to5, rpe_1to10, win, friction")
        .eq("user_id", userId).gte("reflection_date", sinceDate).order("reflection_date", { ascending: true }),
      supabase.from("coach_mission_logs")
        .select("mission_id, completed_at, xp_awarded")
        .eq("user_id", userId).gte("completed_at", since),
      supabase.from("coach_athlete_profile").select("primary_goal, tone_pref, i_am").eq("user_id", userId).maybeSingle(),
      supabase.from("coach_goals").select("title, target_value, current_value, unit, deadline")
        .eq("user_id", userId).eq("status", "active").limit(1).maybeSingle(),
    ]);

    const checkins = checkinsRes.data ?? [];
    const reflections = reflectionsRes.data ?? [];
    const missions = missionsRes.data ?? [];
    const athlete = (athleteRes as any)?.data;
    const goal = (goalRes as any)?.data;

    // Compute a rough performance score for the week (0..100)
    const days = checkins.length;
    const avgSleep = days ? checkins.reduce((s, c) => s + Number(c.sleep_hours ?? 0), 0) / days : 0;
    const workouts = checkins.filter((c) => c.workout).length;
    const sportsLine = sportBreakdown(checkins.filter((c) => c.workout).map((c: any) => c.sport));
    const avgEnergy = reflections.length
      ? reflections.reduce((s, r) => s + (r.energy_1to5 ?? 0), 0) / reflections.length
      : 3;
    const sleepPts = Math.max(0, Math.min(35, ((avgSleep - 5) / 3) * 35));
    const trainPts = Math.min(30, workouts * 8);
    const consistencyPts = Math.min(20, days * 3);
    const energyPts = Math.min(15, (avgEnergy / 5) * 15);
    const performance_score = Math.round(sleepPts + trainPts + consistencyPts + energyPts);

    let headline = `${workouts} workouts${sportsLine ? ` (${sportsLine})` : ""} · ${days}/7 days · avg sleep ${avgSleep.toFixed(1)}h`;
    let driver_of_week = workouts >= 4 ? "Training volume" : avgSleep >= 7.5 ? "Sleep" : "Consistency";
    let wins: string[] = [];
    let frictions: string[] = [];
    let next_week_focus = "Hold the line — stack one extra workout if energy stays >3.5.";
    let program_tweak: string | null = null;

    if (OPENROUTER_API_KEY) {
      try {
        const prompt = `Last 7 days for athlete (${athlete?.i_am ?? "no identity"}, goal: ${athlete?.primary_goal ?? "general"}, tone: ${athlete?.tone_pref ?? "calm_mentor"}).

CHECK-INS (${days}/7): avg sleep ${avgSleep.toFixed(1)}h, ${workouts} workouts, avg energy ${avgEnergy.toFixed(1)}/5
REFLECTIONS:
${reflections.map((r) => `- ${r.reflection_date}: energy ${r.energy_1to5}/5, sleep ${r.sleep_quality_1to5 ?? "?"}/5, RPE ${r.rpe_1to10 ?? "?"}/10. Win: "${r.win ?? "—"}". Friction: "${r.friction ?? "—"}"`).join("\n") || "(none)"}
MISSIONS COMPLETED: ${missions.length}
NORTH STAR: ${goal ? `${goal.title} → ${goal.current_value ?? "?"}/${goal.target_value}${goal.unit}` : "none"}
COMPUTED PERFORMANCE SCORE: ${performance_score}/100

Return a sharp meta-review. driver_of_week = the SINGLE biggest factor that moved the score this week (positive or negative). next_week_focus = ≤3 sentences of crisp prescription. program_tweak = ONE concrete adjustment if data warrants it (e.g. "Drop Friday VO₂ — RPE creeping above 9").`;

        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are AI Coach — distill the week into actionable signal. Use the emit_weekly_review tool." },
              { role: "user", content: prompt },
            ],
            tools: [TOOL],
            tool_choice: { type: "function", function: { name: "emit_weekly_review" } },
          }),
        });
        if (r.ok) {
          const jj = await r.json();
          const args = jj.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (args) {
            const p = JSON.parse(args);
            driver_of_week = p.driver_of_week ?? driver_of_week;
            wins = Array.isArray(p.wins) ? p.wins : wins;
            frictions = Array.isArray(p.frictions) ? p.frictions : frictions;
            next_week_focus = p.next_week_focus ?? next_week_focus;
            program_tweak = p.program_tweak ?? null;
          }
        }
      } catch (e) {
        console.warn("weekly ai err", e);
      }
    }

    const { data: rid, error: rpcErr } = await supabase.rpc("upsert_weekly_review", {
      _week_starts_on: startOfWeekISO(),
      _performance_score: performance_score,
      _driver_of_week: driver_of_week,
      _wins: wins,
      _frictions: frictions,
      _next_week_focus: next_week_focus,
      _program_tweak: program_tweak,
      _generated_with: OPENROUTER_API_KEY ? "google/gemini-2.5-flash" : "fallback",
    });
    if (rpcErr) {
      console.error("weekly rpc err", rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also persist a performance snapshot for today
    await supabase.rpc("upsert_performance_snapshot", {
      _snapshot_date: new Date().toISOString().slice(0, 10),
      _performance_score: performance_score,
      _components: {
        sleep_pts: Math.round(sleepPts),
        train_pts: Math.round(trainPts),
        consistency_pts: Math.round(consistencyPts),
        energy_pts: Math.round(energyPts),
        workouts,
        avg_sleep_h: Math.round(avgSleep * 10) / 10,
      },
    });

    return new Response(JSON.stringify({
      ok: true, review_id: rid, performance_score, driver_of_week, wins, frictions, next_week_focus, program_tweak,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("coach-weekly-review err", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
