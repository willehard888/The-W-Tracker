// coach-progress-read — Premium-only. Generates a short coach read of last 7d progress vs program targets.
import { describeVital, meanOfPresent } from "../_shared/measurement.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AI_CONSENT_REQUIRED, hasAiConsent, openrouterFetch } from "../_shared/openrouter.ts";
import { clampTzOffset, localDayKey } from "../_shared/local-day.ts";

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
      return new Response(JSON.stringify({ error: "The coach is offline right now. Try again shortly." }), {
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

    // has_active_access, not has_premium: the trial is sold as full access and
    // the app lets a trialist walk the whole product, but has_premium is
    // paid-only — so a day-1 trialist tapping the most advertised feature hit a
    // 403 they were never warned about. coach-daily-plan already gates this way.
    const [{ data: hasAccess }, consent] = await Promise.all([
      supabase.rpc("has_active_access", { _user_id: userId }),
      hasAiConsent(supabase, userId),
    ]);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Active membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // AI consent (App Review 5.1.2(i)): the read sends the member's week to the
    // model. Refused here, before bump_ai_usage, so a refusal never costs quota.
    if (!consent) {
      return new Response(JSON.stringify({ error: AI_CONSENT_REQUIRED }), {
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
    // A training day is a check-in's workout tick or a completed program
    // session, the rule the page's summary and the Coach state card count by.
    // Counting ticks alone, this read "0 workouts" under "1 of 1 sessions".
    const tz = clampTzOffset((await req.json().catch(() => ({})))?.tz_offset_minutes);
    const day = (iso: string) => localDayKey(tz, new Date(iso).getTime());
    const workouts = new Set([
      ...(checks ?? []).filter((c: any) => c.workout).map((c: any) => day(c.checked_in_at)),
      ...(logs ?? []).filter((l: any) => l.completed).map((l: any) => day(l.logged_at)),
    ]).size;
    // A night nobody measured is not a night of no sleep. Averaging absent
    // nights as zero turned a week with three logged 8h nights into "3.4h".
    const avgSleepVal = meanOfPresent((checks ?? []).map((c: any) => Number(c.sleep_hours)));
    const avgSleep = avgSleepVal ?? 0;
    const avgHydr = n ? (checks!.reduce((s: number, c: any) => s + Number(c.hydration_liters ?? 0), 0) / n) : 0;
    const sessionsLogged = logs?.filter((l: any) => l.completed).length ?? 0;
    // plan_json is member-written now (hand edits): targets reach the prompt as numbers only.
    const rawTargets = (program?.plan_json as any)?.weekly_check_targets ?? null;
    const targets = rawTargets
      ? { workouts: Number(rawTargets.workouts) || 0, sleep_avg_h: Number(rawTargets.sleep_avg_h) || 0, hydration_l: Number(rawTargets.hydration_l) || 0 }
      : null;

    const summary = `Last 7 days:
- Check-ins: ${n}/7
- Training days: ${workouts}${targets ? ` (target ${targets.workouts})` : ""}
- Program sessions completed: ${sessionsLogged}
- Avg sleep: ${avgSleep.toFixed(1)} h${targets ? ` (target ${targets.sleep_avg_h})` : ""}
- Avg hydration: ${avgHydr.toFixed(1)} L${targets ? ` (target ${targets.hydration_l})` : ""}
- Goal: ${program?.goal ?? "n/a"}`;

    // Per-member daily cap before the model call (same counter as the chat coach).
    const { data: allowed } = await supabase.rpc("bump_ai_usage", { p_limit: 12, p_kind: "progress" });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Today's limit is reached. It resets at midnight UTC." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await openrouterFetch(
      OPENROUTER_API_KEY,
      {
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "You are AI Coach. Read the user's last 7 days of data and write a tight 4–6 sentence coach read in markdown. Open with one sharp observation, then one win, then ONE concrete adjustment for the next 7 days. No fluff, no clichés, no emojis. Use bold for the adjustment.",
          },
          { role: "user", content: summary },
        ],
      },
      { consent },
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "The coach is unavailable right now. Try again in a moment." }), {
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
      // The real error is in the log line above: e.message can name tables and the provider.
      JSON.stringify({ error: "The coach read is unavailable right now. Try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
