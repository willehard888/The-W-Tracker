// coach-insights — the nightly Whealth OS synthesis engine.
//
// For every recently-active user: read ALL their data (check-ins, HealthKit
// nights + days, reflections, habits, Vault lessons, lifts, social), compute
// the deterministic Whealth Index (6 pillars + patterns, _shared/whealth-index),
// have the LLM phrase 2-3 observations + one focus FROM THE COMPUTED FACTS
// ONLY, and upsert one row/day into coach_performance_snapshots:
//   performance_score = overall index
//   components = { pillars, patterns, observations, focus, engine: "whealth-os" }
//
// Cron-only (service role guard, same pattern as weekly-briefing-generate).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  computeWhealthIndexDetailed,
  type WhealthInputs,
  type CheckinDay,
  type NightRow,
  type DayRow,
  type ReflectionRow,
} from "../_shared/whealth-index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same contract as weekly-briefing-generate: accept the exact env key OR any
// JWT whose payload role is service_role (the vault-stored key isn't always
// byte-identical to the function's env var).
function isServiceRole(token: string, envKey: string): boolean {
  if (!token) return false;
  if (envKey && token === envKey) return true;
  try {
    const seg = token.split(".")[1];
    if (!seg) return false;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
    return JSON.parse(atob(padded))?.role === "service_role";
  } catch {
    return false;
  }
}

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

// Truthy check across legacy boolean columns + the personalized habits jsonb.
const habitDone = (row: Record<string, unknown>, legacyKeys: string[], habitKeys: string[]): boolean => {
  for (const k of legacyKeys) if (row[k] === true) return true;
  const h = (row.habits ?? {}) as Record<string, unknown>;
  for (const k of habitKeys) if (h[k] === true) return true;
  return false;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    const authToken = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!isServiceRole(authToken, SERVICE_KEY)) {
      return new Response(JSON.stringify({ error: "Service role required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const since = new Date(Date.now() - 28 * 86400_000).toISOString();
    const sinceDay = since.slice(0, 10);
    const today = dayStr(new Date());

    // Active = checked in within 14 days.
    const activeSince = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data: activeRows } = await sb
      .from("daily_checkins")
      .select("user_id")
      .gte("checked_in_at", activeSince);
    const userIds = [...new Set((activeRows ?? []).map((r: { user_id: string }) => r.user_id))];

    const { count: lessonsTotal } = await sb
      .from("vault_articles")
      .select("id", { count: "exact", head: true });

    // pg_net's cron invocation times out after ~5s and the disconnect can kill
    // in-flight work — so respond immediately and do the real work in the
    // background via waitUntil (the runtime keeps the isolate alive).
    const run = async () => {
    let processed = 0;
    const errors: string[] = [];

    for (const uid of userIds) {
      try {
        const [checkinsR, nightsR, daysR, reflR, habitsR, lessonsR, liftsR, tribesR, friendsR, athleteR] =
          await Promise.all([
            sb.from("daily_checkins")
              .select("checked_in_at, sleep_hours, hydration_liters, workout, meditation_morning, meditation_evening, protein_intake, healthy_food, no_phone_morning, no_phone_evening, journal_entry, habits, verified_at")
              .eq("user_id", uid).gte("checked_in_at", since).order("checked_in_at", { ascending: true }),
            sb.from("health_night_metrics")
              .select("night_date, resting_hr, hrv_sdnn, respiratory_rate, sleep_total_min, sleep_deep_min, sleep_rem_min, sleep_start")
              .eq("user_id", uid).gte("night_date", sinceDay).order("night_date", { ascending: true }),
            sb.from("health_sync_snapshots")
              .select("snapshot_date, steps, active_kcal, workout_minutes, mindful_minutes")
              .eq("user_id", uid).gte("snapshot_date", sinceDay),
            sb.from("coach_reflections")
              .select("reflection_date, energy_1to5, mood_1to5, win, friction")
              .eq("user_id", uid).gte("reflection_date", sinceDay),
            sb.from("user_habits")
              .select("current_streak").eq("user_id", uid).is("archived_at", null),
            sb.from("vault_lesson_progress")
              .select("quiz_score").eq("user_id", uid),
            sb.from("workout_set_logs")
              .select("exercise_slug, exercise_name, weight, reps, logged_on")
              .eq("user_id", uid).gte("logged_on", sinceDay)
              .order("logged_on", { ascending: false }).limit(120),
            sb.from("tribe_members").select("id", { count: "exact", head: true }).eq("user_id", uid),
            sb.from("friendships").select("id", { count: "exact", head: true })
              .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`).eq("status", "accepted"),
            sb.from("coach_athlete_profile").select("i_am").eq("user_id", uid).maybeSingle(),
          ]);

        const checkins: CheckinDay[] = (checkinsR.data ?? []).map((c: Record<string, unknown>) => ({
          day: String(c.checked_in_at).slice(0, 10),
          sleepHours: c.sleep_hours != null ? Number(c.sleep_hours) : null,
          hydration: c.hydration_liters != null ? Number(c.hydration_liters) : null,
          workout: c.workout === true || habitDone(c, [], ["workout"]),
          meditation: habitDone(c, ["meditation_morning", "meditation_evening"], ["meditation", "meditation_pm"]),
          protein: habitDone(c, ["protein_intake"], ["protein"]),
          healthyFood: habitDone(c, ["healthy_food"], ["healthy_food"]),
          noPhone: habitDone(c, ["no_phone_morning", "no_phone_evening"], ["no_phone_am", "no_phone_pm"]),
          journal: typeof c.journal_entry === "string" && c.journal_entry.trim().length > 0,
          verified: c.verified_at != null,
        }));

        const nights: NightRow[] = (nightsR.data ?? []).map((n: Record<string, unknown>) => ({
          day: String(n.night_date),
          restingHr: n.resting_hr != null ? Number(n.resting_hr) : null,
          hrvSdnn: n.hrv_sdnn != null ? Number(n.hrv_sdnn) : null,
          respRate: n.respiratory_rate != null ? Number(n.respiratory_rate) : null,
          sleepTotalMin: n.sleep_total_min != null ? Number(n.sleep_total_min) : null,
          deepMin: n.sleep_deep_min != null ? Number(n.sleep_deep_min) : null,
          remMin: n.sleep_rem_min != null ? Number(n.sleep_rem_min) : null,
          sleepStart: n.sleep_start != null ? String(n.sleep_start) : null,
        }));

        const days: DayRow[] = (daysR.data ?? []).map((d: Record<string, unknown>) => ({
          day: String(d.snapshot_date),
          steps: d.steps != null ? Number(d.steps) : null,
          activeKcal: d.active_kcal != null ? Number(d.active_kcal) : null,
          workoutMinutes: d.workout_minutes != null ? Number(d.workout_minutes) : null,
          mindfulMinutes: d.mindful_minutes != null ? Number(d.mindful_minutes) : null,
        }));

        const reflections: ReflectionRow[] = (reflR.data ?? []).map((r: Record<string, unknown>) => ({
          day: String(r.reflection_date),
          energy: r.energy_1to5 != null ? Number(r.energy_1to5) : null,
          mood: r.mood_1to5 != null ? Number(r.mood_1to5) : null,
          hasWin: typeof r.win === "string" && r.win.trim().length > 0,
          hasFriction: typeof r.friction === "string" && r.friction.trim().length > 0,
        }));

        // Lift progression: newest e1RM vs best prior, per exercise.
        const e1rm = (w: number, r: number) => w * (1 + r / 30);
        const byExercise = new Map<string, Array<{ v: number; on: string }>>();
        for (const row of (liftsR.data ?? []) as Array<Record<string, unknown>>) {
          const key = String(row.exercise_slug ?? row.exercise_name ?? "");
          if (!key || row.weight == null) continue;
          const v = e1rm(Number(row.weight), Number(row.reps ?? 1));
          (byExercise.get(key) ?? byExercise.set(key, []).get(key)!).push({ v, on: String(row.logged_on) });
        }
        let prs = 0, stalls = 0;
        for (const sets of byExercise.values()) {
          if (sets.length < 2) continue; // need history to call it either way
          const latest = sets[0].v;
          const priorBest = Math.max(...sets.slice(1).map((s) => s.v));
          if (latest >= priorBest * 1.01) prs++;
          else if (latest <= priorBest * 0.97) stalls++;
        }

        const quizScores = (lessonsR.data ?? [])
          .map((l: { quiz_score: number | null }) => l.quiz_score)
          .filter((q: number | null): q is number => q != null);

        const inputs: WhealthInputs = {
          checkins, nights, days, reflections,
          habitStreaks: (habitsR.data ?? []).map((h: { current_streak: number | null }) => Number(h.current_streak ?? 0)),
          lessonsCompleted: (lessonsR.data ?? []).length,
          lessonsTotal: lessonsTotal ?? 0,
          avgQuizScore: quizScores.length ? quizScores.reduce((a: number, b: number) => a + b, 0) / quizScores.length : null,
          liftPrs: prs, liftStalls: stalls, liftCount: byExercise.size,
          tribeCount: tribesR.count ?? 0,
          friendCount: friendsR.count ?? 0,
          iAmSet: !!(athleteR.data?.i_am && String(athleteR.data.i_am).trim().length > 0),
        };

        const result = computeWhealthIndexDetailed(inputs);

        // LLM phrasing — computed facts in, coach voice out. Skipped when
        // there's nothing to phrase or no API key (snapshot still stored).
        let observations: string[] = [];
        let focus: string | null = null;
        if (OPENROUTER_API_KEY && result.overall != null) {
          try {
            const factLines = [
              `Overall Whealth Index: ${result.overall}/100`,
              ...Object.entries(result.pillars).map(([k, v]) => `${k}: ${v == null ? "no data yet" : `${v}/100`}`),
              ...result.patterns.map((p) =>
                `PATTERN ${p.metric}: ${p.avgA}${p.unit} ${p.aLabel} vs ${p.avgB}${p.unit} ${p.bLabel} (n=${p.nA}/${p.nB})`),
            ].join("\n");
            const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  {
                    role: "system",
                    content:
                      "You are W Coach writing 2-3 observations + 1 focus from a member's computed wellbeing stats. RULES: use ONLY the numbers given — never invent data; each observation is one sentence, second person, specific and warm-but-direct; the focus is ONE concrete lever for the next 7 days (start with a verb). No markdown, no emoji.",
                  },
                  { role: "user", content: factLines },
                ],
                tools: [{
                  type: "function",
                  function: {
                    name: "emit_insights",
                    description: "Return the phrased observations and focus.",
                    parameters: {
                      type: "object",
                      additionalProperties: false,
                      required: ["observations", "focus"],
                      properties: {
                        observations: { type: "array", maxItems: 3, items: { type: "string", maxLength: 200 } },
                        focus: { type: "string", maxLength: 140 },
                      },
                    },
                  },
                }],
                tool_choice: { type: "function", function: { name: "emit_insights" } },
              }),
              signal: AbortSignal.timeout(25_000),
            });
            if (aiResp.ok) {
              const j = await aiResp.json();
              const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
              if (args) {
                const parsed = JSON.parse(args);
                observations = Array.isArray(parsed.observations) ? parsed.observations.slice(0, 3) : [];
                focus = typeof parsed.focus === "string" ? parsed.focus : null;
              }
            }
          } catch { /* phrasing is optional — the numbers still land */ }
        }

        const { error: upErr } = await sb.from("coach_performance_snapshots").upsert(
          {
            user_id: uid,
            snapshot_date: today,
            performance_score: result.overall ?? 0,
            components: {
              engine: "whealth-os",
              pillars: result.pillars,
              patterns: result.patterns,
              breakdown: result.breakdown,
              observations,
              focus,
            },
          },
          { onConflict: "user_id,snapshot_date" },
        );
        if (upErr) throw new Error(upErr.message);
        processed++;
      } catch (e) {
        errors.push(`${uid}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`coach-insights done: ${processed}/${userIds.length}`, errors.length ? errors : "");
    };

    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil ? (globalThis as any).EdgeRuntime.waitUntil(run()) : await run();

    return new Response(JSON.stringify({ ok: true, started: true, users: userIds.length }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
