// Coach Proactive — the agentic outreach engine.
//
// Runs hourly via pg_cron. For each active member it evaluates a priority ladder
// of VERIFIED-state triggers and fires at most ONE nudge, timed to the user's
// local hour so it lands at the right moment:
//   1. Recovery crash   (local morning) — last night's resting HR up vs baseline
//                         or short sleep → "ease off / recover today". (HealthKit)
//   2. Streak at risk    (local evening) — live streak, not checked in today.
//   3. Morning intention (local ~07)     — checked in yesterday → set today's tone.
//
// Shares the coach_nudges one-per-day dedup with coach-morning-nudge, so the two
// never double-nudge. Every trigger has a deterministic fallback message, so the
// engine still delivers if the AI provider is unavailable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gatherSituation } from "../_shared/situation.ts";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only: cron invokes with the service-role key. Without this guard any
// signed-in user could trigger a proactive push blast.
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

const localHour = (tz: string | null): number => {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC", hour: "numeric", hour12: false }).format(new Date()),
    ) % 24;
  } catch {
    return new Date().getUTCHours();
  }
};

// IANA tz → current offset minutes in getTimezoneOffset() convention
// (positive = west of UTC). gatherSituation needs this for streakAtRisk /
// checkedInToday to evaluate in the USER's day, not UTC — without it the
// evening streak-risk trigger could never fire.
const tzOffsetMinutes = (tz: string | null): number => {
  try {
    const now = new Date();
    const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz || "UTC" }));
    return Math.round((utc.getTime() - local.getTime()) / 60_000);
  } catch {
    return 0;
  }
};

const median = (xs: number[]): number | null => {
  const a = xs.filter((v) => v != null && !Number.isNaN(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

type TriggerKind = "recovery" | "streak_risk" | "morning";
interface Trigger {
  kind: TriggerKind;
  route: string;
  // Deterministic fallback (used verbatim if AI is unavailable).
  headline: string;
  content: string;
  // Extra facts the AI can weave in.
  context: string;
}

const MORNING = [7, 8];
const EVENING = [19, 20];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token, SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(todayStart.getUTCDate() - 1);
  const todayStartISO = todayStart.toISOString();
  const threeDaysAgoISO = new Date(todayStart.getTime() - 3 * 86_400_000).toISOString();

  // Active members: a live streak OR activity in the last 3 days. Bounds cost and
  // targets people the nudge can actually help.
  const { data: users, error: usersErr } = await supabase
    .from("profiles")
    .select("user_id, username, status_tier, level, streak, timezone, last_active_at")
    .or(`streak.gt.0,last_active_at.gte.${threeDaysAgoISO}`);

  if (usersErr) {
    return new Response(JSON.stringify({ error: usersErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = { processed: 0, skipped: 0, errors: 0, sent: 0, byKind: {} as Record<string, number> };

  for (const p of users ?? []) {
    const lh = localHour((p as any).timezone ?? null);
    const inMorning = MORNING.includes(lh);
    const inEvening = EVENING.includes(lh);
    if (!inMorning && !inEvening) { results.skipped++; continue; }

    results.processed++;
    try {
      const trigger = await pickTrigger(supabase, p, { inMorning, inEvening, yesterdayStart, todayStartISO });
      if (!trigger) { results.skipped++; continue; }

      // Dedup per KIND: the daily slot (morning intent / recovery) is separate
      // from the evening streak-save, so a 07:00 nudge never suppresses the
      // 19:00 streak protection. limit(1)+array (NOT maybeSingle — once dupes
      // exist it returns PGRST116 with data=null, which read as "no nudge" and
      // spammed pushes every pass). The unique (user, kind, day) index is the
      // race-proof backstop against coach-morning-nudge.
      const dbKind = trigger.kind === "streak_risk" ? "streak_risk" : "daily";
      const { data: existingRows, error: dedupErr } = await supabase
        .from("coach_nudges")
        .select("id")
        .eq("user_id", p.user_id)
        .eq("kind", dbKind)
        .gte("created_at", todayStartISO)
        .limit(1);
      if (dedupErr || (existingRows?.length ?? 0) > 0) { results.skipped++; continue; }

      // AI-enhance the copy when possible; otherwise use the deterministic fallback.
      let headline = trigger.headline;
      let content = trigger.content;
      if (OPENROUTER_API_KEY) {
        const ai = await generate(OPENROUTER_API_KEY, p, trigger).catch(() => null);
        if (ai?.headline && ai?.content) { headline = ai.headline; content = ai.content; }
      }

      const { error: insErr } = await supabase.from("coach_nudges").insert({
        user_id: p.user_id, headline, content, kind: dbKind,
      });
      if (insErr) {
        // unique_violation = the other engine won the slot — skip, not an error.
        if ((insErr as any).code === "23505") { results.skipped++; } else { results.errors++; }
        continue;
      }

      const { data: tokens } = await supabase
        .from("push_tokens").select("token, platform").eq("user_id", p.user_id);
      if (tokens && tokens.length > 0) {
        const push = await sendApnsBatch(tokens as any, {
          title: `AI Coach: ${headline}`,
          body: content,
          data: { route: trigger.route },
        });
        const ok = push.filter((r) => r.status === 200).length;
        const dead = push.filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered").map((r) => r.token);
        if (dead.length > 0) await supabase.from("push_tokens").delete().in("token", dead);
        if (ok > 0) {
          results.sent++; results.byKind[trigger.kind] = (results.byKind[trigger.kind] ?? 0) + 1;
          // Attribution: which nudge kinds actually re-engage (join vs app_opened).
          const { error: evErr } = await supabase.from("analytics_events").insert({
            user_id: p.user_id, event: "nudge_sent", props: { kind: trigger.kind },
          });
          if (evErr) console.warn("nudge analytics insert failed:", evErr.message);
        }
      }
    } catch (_e) {
      results.errors++;
    }
  }

  console.log("coach-proactive run:", results);
  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

/** Evaluate the priority ladder and return the single highest-priority trigger. */
async function pickTrigger(
  supabase: any,
  p: any,
  ctx: { inMorning: boolean; inEvening: boolean; yesterdayStart: Date; todayStartISO: string },
): Promise<Trigger | null> {
  // ── Morning window ──────────────────────────────────────────────────────
  if (ctx.inMorning) {
    // 1. Recovery crash — last night's HealthKit metrics vs the user's baseline.
    const { data: nights } = await supabase
      .from("health_night_metrics")
      .select("night_date, resting_hr, sleep_total_min")
      .eq("user_id", p.user_id)
      .order("night_date", { ascending: false })
      .limit(15);
    const rows = (nights ?? []) as any[];
    const last = rows[0];
    // Freshness guard: only alert on a night that actually IS last night —
    // a stale row from a user who stopped syncing must not trigger "ease off".
    const lastFresh =
      last?.night_date &&
      (Date.now() - new Date(`${last.night_date}T00:00:00Z`).getTime()) / 86_400_000 <= 2;
    if (last && lastFresh && (last.resting_hr != null || last.sleep_total_min != null)) {
      const baseRhr = median(rows.slice(1).map((n) => Number(n.resting_hr)).filter((v) => v > 0));
      const rhrUp = last.resting_hr != null && baseRhr != null && last.resting_hr - baseRhr >= 6;
      const shortSleep = last.sleep_total_min != null && last.sleep_total_min < 360; // < 6h
      if (rhrUp || shortSleep) {
        const why = rhrUp
          ? `resting HR ${Math.round(last.resting_hr)} bpm vs ~${Math.round(baseRhr!)} baseline`
          : `only ${Math.floor((last.sleep_total_min ?? 0) / 60)}h ${Math.round((last.sleep_total_min ?? 0) % 60)}m sleep`;
        return {
          kind: "recovery",
          route: "/coach",
          headline: "Ease off today",
          content: `Your body's under-recovered (${why}). Treat today as recovery — swap the hard session for a 20-min walk + mobility, and protect tonight's sleep.`,
          context: `Recovery flag: ${why}. Last night vs baseline shows under-recovery.`,
        };
      }
    }

    // 3. Morning intention — checked in yesterday → set today's tone.
    const { data: checkin } = await supabase
      .from("daily_checkins")
      .select("checked_in_at, xp_earned, workout, sleep_hours")
      .eq("user_id", p.user_id)
      .gte("checked_in_at", ctx.yesterdayStart.toISOString())
      .lt("checked_in_at", ctx.todayStartISO)
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkin) {
      return {
        kind: "morning",
        route: "/coach",
        headline: "Lock in today",
        content: `You showed up yesterday${checkin.workout ? " and trained" : ""}. Same again today — one session and your core habits. Momentum compounds.`,
        context: `Yesterday: ${checkin.xp_earned} XP, sleep ${checkin.sleep_hours}h, workout ${checkin.workout ? "yes" : "no"}.`,
      };
    }
    return null;
  }

  // ── Evening window ──────────────────────────────────────────────────────
  // 2. Streak at risk — live streak, not yet checked in on the local day.
  // tzOffsetMinutes MUST be passed: without it gatherSituation evaluates the
  // "checked in today / evening window" logic at UTC and streakAtRisk is
  // hardcoded false — the entire evening trigger was dead code.
  const situation = await gatherSituation(supabase, p.user_id, {
    streak: p.streak ?? null,
    tzOffsetMinutes: tzOffsetMinutes((p as any).timezone ?? null),
  }).catch(() => null);
  if (situation?.streakAtRisk && (p.streak ?? 0) > 0) {
    return {
      kind: "streak_risk",
      route: "/checkin",
      headline: "Protect the chain",
      content: `Your ${p.streak}-day streak is still open — one check-in before midnight keeps it alive. Don't lose it on a tired evening.`,
      context: `Streak ${p.streak} days, not checked in today, evening window closing.`,
    };
  }
  return null;
}

const nudgeTool = {
  type: "function",
  function: {
    name: "emit_nudge",
    description: "Emit the coach's proactive nudge.",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "3-6 word headline. Sharp, no cliché." },
        content: { type: "string", description: "1-2 sentences. Reference the specific signal. One concrete action." },
      },
      required: ["headline", "content"],
      additionalProperties: false,
    },
  },
};

/** AI-enhance the nudge copy for this trigger. Returns null on any failure. */
async function generate(
  apiKey: string,
  p: any,
  trigger: Trigger,
): Promise<{ headline: string; content: string } | null> {
  const intent =
    trigger.kind === "recovery"
      ? "The user is under-recovered. Be caring but firm: prescribe backing off today and protecting sleep. Do NOT push hard training."
      : trigger.kind === "streak_risk"
      ? "The user's streak is at risk this evening. Protect it — urge one quick check-in before midnight. Warm, not naggy."
      : "Set today's tone off yesterday's momentum. One concrete action. Confident, not cheesy.";

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are AI Coach sending a proactive push notification. ${intent}
Rules: reference the specific signal, prescribe ONE concrete action, max 2 sentences, no greetings, no clichés, never mention being an AI. Reply in the user's language (default English).`,
        },
        {
          role: "user",
          content: `User: ${p.username} (${p.status_tier}, level ${p.level}, ${p.streak}d streak).\nSignal: ${trigger.context}`,
        },
      ],
      tools: [nudgeTool],
      tool_choice: { type: "function", function: { name: "emit_nudge" } },
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    const parsed = JSON.parse(args);
    if (typeof parsed.headline === "string" && typeof parsed.content === "string") {
      return { headline: parsed.headline, content: parsed.content };
    }
  } catch { /* fall through to fallback */ }
  return null;
}
