// coach-progress-read — Premium-only. Generates a short coach read of last 7d progress vs program targets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: isPremium } = await supabase.rpc("has_premium", { _user_id: userId });
    if (!isPremium) {
      return new Response(JSON.stringify({ error: "Premium membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sevenAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [{ data: program }, { data: checks }, { data: logs }] = await Promise.all([
      supabase
        .from("coach_programs")
        .select("plan_json, goal, ai_summary")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("daily_checkins")
        .select("workout, sleep_hours, hydration_liters, protein_intake, xp_earned, checked_in_at")
        .eq("user_id", userId)
        .gte("checked_in_at", sevenAgo),
      supabase
        .from("coach_program_logs")
        .select("week, day_index, completed, perceived_rpe, notes, logged_at")
        .eq("user_id", userId)
        .gte("logged_at", sevenAgo),
    ]);

    const n = checks?.length ?? 0;
    const workouts = n ? checks!.filter((c: any) => c.workout).length : 0;
    const avgSleep = n ? (checks!.reduce((s: number, c: any) => s + Number(c.sleep_hours ?? 0), 0) / n) : 0;
    const avgHydr = n ? (checks!.reduce((s: number, c: any) => s + Number(c.hydration_liters ?? 0), 0) / n) : 0;
    const sessionsLogged = logs?.filter((l: any) => l.completed).length ?? 0;
    const targets = (program?.plan_json as any)?.weekly_check_targets ?? null;

    const summary = `Last 7 days:
- Check-ins: ${n}/7
- Workouts: ${workouts}${targets ? ` (target ${targets.workouts})` : ""}
- Program sessions completed: ${sessionsLogged}
- Avg sleep: ${avgSleep.toFixed(1)} h${targets ? ` (target ${targets.sleep_avg_h})` : ""}
- Avg hydration: ${avgHydr.toFixed(1)} L${targets ? ` (target ${targets.hydration_l})` : ""}
- Goal: ${program?.goal ?? "n/a"}`;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "You are W Coach. Read the user's last 7 days of data and write a tight 4–6 sentence coach read in markdown. Open with one sharp observation, then one win, then ONE concrete adjustment for the next 7 days. No fluff, no clichés, no emojis. Use bold for the adjustment.",
          },
          { role: "user", content: summary },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const read = aiJson?.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({
        read,
        stats: {
          checkins: n,
          workouts,
          sessions_logged: sessionsLogged,
          avg_sleep_h: Number(avgSleep.toFixed(1)),
          avg_hydration_l: Number(avgHydr.toFixed(1)),
          targets,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("coach-progress-read error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
