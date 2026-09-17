// Daily AI Trainer Brief — generates a short, signed, context-aware brief
// from the AI Coach. Cached per user per day in coach_daily_briefs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sportBreakdown } from "../_shared/sports.ts";
import { gatherSituation, buildSituationBlock } from "../_shared/situation.ts";
import { gatherProgression, buildProgressionBlock } from "../_shared/progression.ts";
import { gatherNightSignals, buildCausalBlock } from "../_shared/health-causal.ts";
import { INNER_WORK_BLOCK } from "../_shared/inner-work-catalog.ts";
import { LONGEVITY_BLOCK } from "../_shared/longevity-catalog.ts";
import { WISDOM_BLOCK } from "../_shared/wisdom-catalog.ts";
import { programWeekState } from "../_shared/program-week.ts";
import { clampTzOffset, localDayKey, localWeekday } from "../_shared/local-day.ts";
import { todaysFocusSession } from "../_shared/today-session.ts";
import { AI_CONSENT_REQUIRED, consentOk, openrouterFetch } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TONE_LINE: Record<string, string> = {
  drill_sergeant: "Tone: drill sergeant — clipped, demanding, zero excuses, but never cruel.",
  calm_mentor: "Tone: calm mentor — measured, warm, surgical. Like a wise senior coach.",
  scientist: "Tone: scientist — precise, evidence-flavoured, references numbers cleanly.",
  hype: "Tone: high-energy hype — punchy, alive, charged. Never cheesy.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) return json({ error: "AI not configured" }, 500);

    const sb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: ud, error: uErr } = await sb.auth.getUser();
    if (uErr || !ud.user) return json({ error: "Unauthorized" }, 401);
    const uid = ud.user.id;

    const { data: hasAccess } = await sb.rpc("has_active_access", { _user_id: uid });
    if (!hasAccess) return json({ error: "Active membership required" }, 403);

    const body = await req.json().catch(() => ({}));
    const force = !!body?.force;
    // The device's calendar day, not the server's UTC one — the client keys
    // its cache on localDateKey(), and the two disagreed for hours every day.
    const today = localDayKey(clampTzOffset(body?.tz_offset_minutes));

    if (!force) {
      const { data: cached } = await sb
        .from("coach_daily_briefs")
        .select("payload, brief_date")
        .eq("user_id", uid)
        .eq("brief_date", today)
        .maybeSingle();
      if (cached?.payload) return json({ brief: cached.payload, cached: true });
    }

    // Gather context in parallel
    const sevenAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [profileRes, athleteRes, programRes, checkinsRes] = await Promise.all([
      sb.from("profiles").select("username, status_tier, streak, longest_streak, level, xp, ai_consent_version").eq("user_id", uid).maybeSingle(),
      sb.from("coach_athlete_profile" as any).select("*").eq("user_id", uid).maybeSingle(),
      sb.from("coach_programs").select("*").eq("user_id", uid).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("daily_checkins").select("checked_in_at, sleep_hours, hydration_liters, workout, sport, protein_intake, healthy_food, xp_earned").eq("user_id", uid).gte("checked_in_at", sevenAgo).order("checked_in_at", { ascending: false }).limit(7),
    ]);

    // AI consent (App Review 5.1.2(i)): a brief already written today is served
    // above, a NEW one sends the member's week to the model, so it waits for
    // their opt-in. Before bump_ai_usage: a refusal never costs quota.
    if (!consentOk(profileRes.data?.ai_consent_version)) return json({ error: AI_CONSENT_REQUIRED }, 403);

    const profile = profileRes.data ?? {};
    const athlete: any = athleteRes.data ?? {};
    const program: any = programRes.data ?? null;
    const checkins = checkinsRes.data ?? [];

    // Compute today's program day
    let todaySession: any = null;
    let weekIdx = 1;
    let dayIdx = 0;
    if (program?.plan_json?.weeks) {
      // Calendar AND logs — the week the runner shows (_shared/program-week.ts).
      const { data: logs } = await sb
        .from("coach_program_logs")
        .select("week, completed")
        .eq("user_id", uid)
        .eq("program_id", program.id);
      const now = new Date();
      weekIdx = programWeekState({ startedOn: program.started_on, weeks: program.weeks, logs: (logs ?? []) as any[], now }).currentWeek;
      // The member's weekday, not the server's UTC one (coach-daily-plan does the same).
      dayIdx = (localWeekday(clampTzOffset(body?.tz_offset_minutes), now.getTime()) + 6) % 7;
      const wk = program.plan_json.weeks.find((w: any) => w.week === weekIdx);
      todaySession = wk?.days?.[dayIdx] ?? null;
    }
    // A session built for today leads, as it does on Home.
    todaySession = (await todaysFocusSession(sb, uid, today).catch(() => null)) ?? todaySession;

    const last = checkins[0];
    const lastSleep = last?.sleep_hours ?? null;
    const avgSleep = checkins.length
      ? (checkins.reduce((s: number, c: any) => s + Number(c.sleep_hours ?? 0), 0) / checkins.length).toFixed(1)
      : null;
    const workouts7 = checkins.filter((c: any) => c.workout).length;
    const sports7 = sportBreakdown(checkins.filter((c: any) => c.workout).map((c: any) => c.sport));

    const firstName = (athlete?.i_am || profile.username || "").split(" ")[0] || "there";
    const tone = TONE_LINE[athlete?.tone_pref ?? "calm_mentor"] ?? TONE_LINE.calm_mentor;
    const lang = athlete?.language_pref ?? "en";

    const sessionLine = todaySession
      // plan_json is member-written now (hand edits): bound its strings here.
      ? `${String(todaySession.focus ?? "").slice(0, 120)} · ${Number(todaySession.duration_min) || "?"} min · ${todaySession.blocks?.length ?? 0} blocks${todaySession.blocks?.[0]?.name ? ` (lead: ${String(todaySession.blocks[0].name).slice(0, 120)})` : ""}`
      : "No session prescribed today.";

    // Cross-domain situation (tribe, battles, rank) — best-effort, fail-open.
    const situation = await gatherSituation(sb, uid, { streak: profile.streak ?? null }).catch(() => null);
    const situationBlock = situation ? buildSituationBlock(situation) : "";

    // Strength progression — so the morning brief can drive a specific lift.
    const progression = await gatherProgression(sb, uid).catch(() => []);
    const progressionBlock = buildProgressionBlock(progression);
    // Last night's recovery — so the brief can explain WHY they feel how they feel.
    const nightSignals = await gatherNightSignals(sb, uid).catch(() => ({ hasData: false }));
    const causalBlock = buildCausalBlock(nightSignals as any);

    // Whealth Index snapshot — the morning brief cites the real computed
    // state, not vibes. Fail-open.
    let whealthBlock = "";
    try {
      const { data: snap } = await sb
        .from("coach_performance_snapshots")
        .select("snapshot_date, performance_score, components")
        .eq("user_id", uid)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const comp: any = snap?.components ?? null;
      if (snap && comp?.pillars) {
        const pillarLine = ["sleep", "recovery", "movement", "nutrition", "mind", "inner"]
          .map((k) => `${k} ${comp.pillars[k] == null ? "–" : comp.pillars[k]}`)
          .join(" · ");
        whealthBlock = `\nWhealth Index (nightly, ${snap.snapshot_date}): overall ${snap.performance_score}/100 — ${pillarLine}.${comp.focus ? ` 7-day focus: ${comp.focus}` : ""}\n`;
      }
    } catch { /* optional */ }

    const systemPrompt = `You are AI Coach — the user's personal performance trainer inside the W app. You speak DIRECTLY to them, like a world-class private coach who knows their week, their body, and their goal.

${tone}
Reply language: ${lang}.

Athlete:
- Name: ${firstName}
- Goal: ${athlete?.primary_goal ?? "general performance"} (horizon ${athlete?.target_horizon_weeks ?? "?"} wks)
- Streak: ${profile.streak ?? 0}d · Tier: ${profile.status_tier ?? "recruit"}
- Equipment: ${(athlete?.equipment ?? []).join(", ") || "unknown"}
- Injuries: ${(athlete?.injuries ?? []).join(", ") || "none reported"}
- No-go: ${(athlete?.no_go_protocols ?? []).join(", ") || "none"}

Today's prescribed session: ${sessionLine}
Recent: avg sleep ${avgSleep ?? "?"}h (last night ${lastSleep ?? "?"}h), ${workouts7}/7 workouts${sports7 ? ` (${sports7})` : ""}.
${situationBlock ? `\n${situationBlock}\n` : ""}${progressionBlock ? `\n${progressionBlock}\n` : ""}${causalBlock ? `\n${causalBlock}\n` : ""}${whealthBlock}
${INNER_WORK_BLOCK}
${LONGEVITY_BLOCK}
${WISDOM_BLOCK}

Write the daily brief — 2-3 sentences, second person. No sign-off: the surface
rendering this already labels itself "AI Coach", and ai-coach is instructed the
same way, so a signature only repeats the name and eats space in previews.
Reference ONE concrete recent stat and ONE adjustment to today's session if warranted.
End with a single clear action for the next 24h.

Also produce:
- ribbon: ≤10 words ("Week N · Goal · status")
- prescriptions: 3 short label/value pairs (sleep target, protein target, today's intent — fitted to the user)
- suggested_questions: 3 sharp questions the user might ask, tailored to today.`;

    // Per-member daily cap before the model call (same atomic counter as the
    // chat coach). A cached brief above never counts; `force` skips the cache,
    // never this.
    const { data: allowed } = await sb.rpc("bump_ai_usage", { p_limit: 12, p_kind: "brief" });
    if (allowed === false) return json({ error: "Today's brief limit is reached. It resets at midnight UTC." }, 429);

    const aiResp = await openrouterFetch(
      OPENROUTER_API_KEY,
      {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Generate today's brief." }],
        tools: [{
          type: "function",
          function: {
            name: "emit_brief",
            description: "Return the daily trainer brief.",
            parameters: {
              type: "object",
              properties: {
                ribbon: { type: "string" },
                brief_md: { type: "string" },
                prescriptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { label: { type: "string" }, value: { type: "string" } },
                    required: ["label", "value"], additionalProperties: false,
                  },
                },
                suggested_questions: { type: "array", items: { type: "string" } },
              },
              required: ["ribbon", "brief_md", "prescriptions", "suggested_questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_brief" } },
      },
      { consent: true },
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    let payload: any = null;
    if (toolCall?.function?.arguments) {
      try { payload = JSON.parse(toolCall.function.arguments); } catch {}
    }
    if (!payload) {
      payload = {
        ribbon: `Week ${weekIdx} · ${athlete?.primary_goal ?? "Performance"}`,
        brief_md: aiData?.choices?.[0]?.message?.content ?? "Today: show up. Lock the basics.",
        prescriptions: [],
        suggested_questions: [],
      };
    }

    payload.session_focus = todaySession?.focus ?? null;
    payload.week = weekIdx;
    payload.day_index = dayIdx;

    // Stored under the day it was asked for: the read above keys on the
    // device's local day, and CURRENT_DATE on the server is UTC.
    await sb.rpc("upsert_daily_brief" as any, { _payload: payload, _brief_date: today });

    return json({ brief: payload, cached: false });
  } catch (e) {
    console.error("coach-daily-brief", e);
    // The real error is in the log line above: e.message can name tables and the provider.
    return json({ error: "Today's brief is unavailable right now. Try again in a moment." }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
