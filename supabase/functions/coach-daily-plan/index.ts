// Adaptive AI Coach v2 — generates today's mission plan for the authenticated user.
// Reads last 7 days of daily check-ins, latest active program, recent program logs,
// computes a Readiness Score, then asks Lovable AI Gateway (Gemini 2.5 Flash) to emit
// 3–5 high-impact missions via tool-calling. Persists to coach_daily_plans via SECURITY
// DEFINER RPC `upsert_daily_plan`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Checkin {
  checked_in_at: string;
  xp_earned: number;
  workout: boolean;
  cold_shower: boolean;
  healthy_food: boolean;
  protein_intake: boolean;
  hydration_liters: number;
  sleep_hours: number;
  reading: boolean;
  no_phone_morning: boolean;
  no_phone_evening: boolean;
}

const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const computeReadiness = (checkins: Checkin[], lastRpe: number | null, streak: number, missedSessions7d: number) => {
  // Sleep component (0..40)
  const sleepValues = checkins.map((c) => Number(c.sleep_hours ?? 0)).filter((v) => v > 0);
  const avgSleep = sleepValues.length ? sleepValues.reduce((s, v) => s + v, 0) / sleepValues.length : 7;
  const sleepScore = Math.max(0, Math.min(40, ((avgSleep - 5) / 3) * 40)); // 5h→0, 8h→40

  // RPE component (0..25) — high RPE yesterday lowers readiness
  let rpeScore = 18;
  if (lastRpe != null) {
    rpeScore = Math.max(0, Math.min(25, 25 - (lastRpe - 6) * 5)); // RPE 6→25, RPE 9→10, RPE 10→5
  }

  // Streak velocity (0..15) — active streak is good
  const streakScore = Math.min(15, Math.round((Math.min(streak, 14) / 14) * 15));

  // Missed sessions penalty (0..20)
  const missedScore = Math.max(0, 20 - missedSessions7d * 6);

  const total = Math.round(sleepScore + rpeScore + streakScore + missedScore);
  return {
    score: Math.max(0, Math.min(100, total)),
    breakdown: {
      avg_sleep_h: Math.round(avgSleep * 10) / 10,
      last_rpe: lastRpe,
      streak,
      missed_7d: missedSessions7d,
      sleep_pts: Math.round(sleepScore),
      rpe_pts: Math.round(rpeScore),
      streak_pts: streakScore,
      missed_pts: missedScore,
    },
  };
};

const adjustmentFor = (score: number): "push" | "hold" | "deload" | "swap" => {
  if (score >= 80) return "push";
  if (score >= 60) return "hold";
  if (score >= 40) return "deload";
  return "swap";
};

const buildPrompt = (
  profile: any,
  program: any,
  todayDay: any,
  checkins: Checkin[],
  readiness: { score: number; breakdown: any },
  adjustment: string,
) => {
  const username = profile?.username ?? "operator";
  const tier = profile?.status_tier ?? "recruit";
  const streak = profile?.streak ?? 0;
  const last = checkins[checkins.length - 1];

  const recent = last
    ? `Yesterday: sleep ${last.sleep_hours}h · ${last.workout ? "workout✓" : "no workout"} · hydration ${last.hydration_liters}L · ${last.cold_shower ? "cold✓" : "no cold"} · ${last.healthy_food ? "food✓" : "food gap"}`
    : "No check-in yesterday.";

  const sessionLine = todayDay
    ? `Program calls for: ${todayDay.focus} (${todayDay.duration_min} min, ${todayDay.blocks?.length ?? 0} blocks)`
    : "No program session scheduled today.";

  return `You are W Coach — an elite, data-driven personal trainer. Build today's plan for ${username} (tier: ${tier}, streak: ${streak}d).

READINESS: ${readiness.score}/100 → adjustment "${adjustment}"
Breakdown: avg sleep ${readiness.breakdown.avg_sleep_h}h, last RPE ${readiness.breakdown.last_rpe ?? "n/a"}, missed sessions ${readiness.breakdown.missed_7d}/7d.
${recent}
${sessionLine}

Goal: emit 4–5 high-impact missions for the next 24 hours. Rules:
1. ALWAYS include exactly one "primary" mission tied to today's program session (or a recovery substitute if adjustment="swap"). Reflect the adjustment in its title (e.g. "+1 set" for push, "lighter loads" for deload).
2. Include at least one "recovery" mission targeting the weakest signal (sleep if avg<7h, hydration, mobility, or breathwork).
3. Include one "focus" mission (deep work block, no-phone window, journaling) — keep it concrete with minutes.
4. Include one "habit" anchor (water target, protein target, morning sun, etc).
5. If readiness ≥ 70, add one "edge" mission — a stretch challenge (cold finish, extra mobility, walk after dinner). Skip on low readiness.

XP guidance (impact-weighted):
- primary session: 50–60
- recovery: 25–35
- focus: 20–30
- habit: 15–20
- edge: 20–30

Tone: blunt, action-first, no fluff. Headlines under 70 chars. Details under 90 chars, prescriptive (numbers, durations).

Also produce a single "headline" (≤60 chars) summarizing today's stance — e.g. "Push day — earned it." or "Sleep was thin. Recover and rebuild."

Use the emit_daily_plan tool. Mission ids must be short kebab-case (e.g. "primary-strength", "sleep-8h").`;
};

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "emit_daily_plan",
    description: "Emit today's adaptive mission plan.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string", maxLength: 70 },
        missions: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "kind", "title", "xp", "priority"],
            properties: {
              id: { type: "string" },
              kind: { type: "string", enum: ["primary", "recovery", "focus", "habit", "edge"] },
              title: { type: "string", maxLength: 80 },
              detail: { type: "string", maxLength: 120 },
              xp: { type: "integer", minimum: 10, maximum: 80 },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
        },
      },
      required: ["headline", "missions"],
    },
  },
};

const fallbackPlan = (todayDay: any, adjustment: string, readinessScore: number) => {
  const isSwap = adjustment === "swap";
  const focus = todayDay?.focus ?? (isSwap ? "Active recovery" : "Training session");
  const dur = todayDay?.duration_min ?? 30;
  const missions: any[] = [
    {
      id: "primary-session",
      kind: isSwap ? "recovery" : "primary",
      title: isSwap ? `Recovery: ${focus}` : `${focus} · ${dur} min`,
      detail: isSwap ? "20 min easy walk + mobility flow." : `Hit it ${adjustment === "push" ? "with intent" : "as planned"}.`,
      xp: isSwap ? 35 : 55,
      priority: "high",
    },
    {
      id: "sleep-tonight",
      kind: "recovery",
      title: "Sleep ≥ 8h tonight",
      detail: "Lights down by 22:30. Phone out of bedroom.",
      xp: 30,
      priority: "high",
    },
    {
      id: "deep-work",
      kind: "focus",
      title: "20 min deep work, no phone",
      detail: "One task. Phone in another room.",
      xp: 20,
      priority: "medium",
    },
    {
      id: "hydration-3l",
      kind: "habit",
      title: "3L water before 18:00",
      detail: "Front-load hydration; back off after 19:00.",
      xp: 15,
      priority: "medium",
    },
  ];
  if (readinessScore >= 70) {
    missions.push({
      id: "edge-cold-finish",
      kind: "edge",
      title: "Edge: 2 min cold finish",
      detail: "End your shower cold for 120s. Box-breathe.",
      xp: 25,
      priority: "low",
    });
  }
  const headline = adjustment === "push"
    ? "Push day — earned it."
    : adjustment === "deload"
    ? "Deload — recover smart."
    : adjustment === "swap"
    ? "Recovery swap — rebuild."
    : "Hold the line.";
  return { headline, missions };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Premium gate
    const { data: hasAccess } = await supabase.rpc("has_active_access", { _user_id: userId });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Active membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [profileRes, checkinsRes, programRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, status_tier, streak, longest_streak, xp, level")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("daily_checkins")
        .select(
          "checked_in_at, xp_earned, workout, cold_shower, healthy_food, protein_intake, hydration_liters, sleep_hours, reading, no_phone_morning, no_phone_evening",
        )
        .eq("user_id", userId)
        .gte("checked_in_at", sevenDaysAgo)
        .order("checked_in_at", { ascending: true }),
      supabase
        .from("coach_programs")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const checkins = (checkinsRes.data ?? []) as Checkin[];
    const program = programRes.data as any;

    // Recent program logs (for missed sessions + last RPE)
    let lastRpe: number | null = null;
    let missedSessions7d = 0;
    if (program) {
      const { data: logs } = await supabase
        .from("coach_program_logs")
        .select("perceived_rpe, logged_at, week, day_index, completed")
        .eq("user_id", userId)
        .eq("program_id", program.id)
        .gte("logged_at", sevenDaysAgo)
        .order("logged_at", { ascending: false });
      const arr = (logs ?? []) as any[];
      const withRpe = arr.find((l) => l.perceived_rpe != null);
      lastRpe = withRpe?.perceived_rpe ?? null;
      // crude estimate: planned target sessions per week vs completed
      const targetWeekly = program.days_per_week ?? 4;
      missedSessions7d = Math.max(0, targetWeekly - arr.filter((l) => l.completed).length);
    } else {
      missedSessions7d = Math.max(0, 4 - checkins.filter((c) => c.workout).length);
    }

    const readiness = computeReadiness(checkins, lastRpe, profile?.streak ?? 0, missedSessions7d);
    const adjustment = adjustmentFor(readiness.score);

    // Resolve today's program day (Mon=0..Sun=6)
    let todayDay: any = null;
    if (program) {
      const started = new Date(program.started_on);
      const today = new Date();
      const days = Math.floor((today.getTime() - started.setHours(0, 0, 0, 0)) / 86400_000);
      const week = Math.min(program.weeks ?? 4, Math.max(1, Math.floor(days / 7) + 1));
      const js = today.getDay();
      const dayIdx = (js + 6) % 7;
      const w = (program.plan_json?.weeks ?? []).find((x: any) => x.week === week);
      todayDay = w?.days?.[dayIdx] ?? null;
    }

    // Generate via AI (or fallback)
    let headline: string | null = null;
    let missions: any[] = [];

    if (LOVABLE_API_KEY) {
      try {
        const prompt = buildPrompt(profile, program, todayDay, checkins, readiness, adjustment);
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a data-driven elite performance coach. Always emit the plan via the emit_daily_plan tool.",
              },
              { role: "user", content: prompt },
            ],
            tools: [TOOL_SCHEMA],
            tool_choice: { type: "function", function: { name: "emit_daily_plan" } },
          }),
        });
        if (aiResp.ok) {
          const j = await aiResp.json();
          const call = j.choices?.[0]?.message?.tool_calls?.[0];
          if (call?.function?.arguments) {
            const parsed = JSON.parse(call.function.arguments);
            headline = parsed.headline ?? null;
            missions = (parsed.missions ?? []).map((m: any) => ({
              id: String(m.id ?? crypto.randomUUID()).slice(0, 64),
              kind: m.kind,
              title: String(m.title ?? "").slice(0, 100),
              detail: m.detail ? String(m.detail).slice(0, 160) : undefined,
              xp: Math.max(10, Math.min(80, parseInt(m.xp ?? 20))),
              priority: m.priority ?? "medium",
            }));
          }
        } else {
          console.warn("AI gateway non-ok:", aiResp.status, await aiResp.text());
        }
      } catch (e) {
        console.warn("AI gateway error:", e);
      }
    }

    if (missions.length === 0) {
      const fb = fallbackPlan(todayDay, adjustment, readiness.score);
      headline = fb.headline;
      missions = fb.missions;
    }

    // Persist via SECURITY DEFINER RPC
    const { data: planId, error: rpcErr } = await supabase.rpc("upsert_daily_plan", {
      _plan_date: todayLocalISO(),
      _readiness_score: readiness.score,
      _readiness_breakdown: readiness.breakdown,
      _adjustment: adjustment,
      _headline: headline,
      _missions: missions,
      _generated_with: LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "fallback",
    });

    if (rpcErr) {
      console.error("upsert_daily_plan error:", rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        plan_id: planId,
        readiness_score: readiness.score,
        adjustment,
        headline,
        missions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("coach-daily-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
