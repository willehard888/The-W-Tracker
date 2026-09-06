// Adaptive AI Coach v2 — generates today's mission plan for the authenticated user.
// Reads last 7 days of daily check-ins, latest active program, recent program logs,
// computes a Readiness Score, then asks OpenRouter (google/gemini-2.5-flash) to emit
// 3–5 high-impact missions via tool-calling. Persists to coach_daily_plans via SECURITY
// DEFINER RPC `upsert_daily_plan`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sportName } from "../_shared/sports.ts";
import { buildPersonaBlock, buildHolisticContext } from "../_shared/coach-persona.ts";
import { gatherNightSignals, buildCausalBlock } from "../_shared/health-causal.ts";
import { gatherProgression, buildProgressionBlock } from "../_shared/progression.ts";
import { gatherHabitGaps, buildHabitGapsBlock } from "../_shared/habit-gaps.ts";
import { programWeekState } from "../_shared/program-week.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Checkin {
  checked_in_at: string;
  xp_earned: number;
  workout: boolean;
  sport?: string | null;
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

// Compact, evidence-graded protocol catalog (mirrors src/lib/wellness-framework.ts).
// Keep tight to control token cost. AI MUST pick missions from this list.
const PROTOCOL_CATALOG = [
  // sleep
  { id: "sleep-7-9h", pillar: "sleep", evidence: "strong", title: "Sleep 7–9 hours", dose: "7–9 h nightly, same window ±30 min" },
  { id: "morning-light-10min", pillar: "sleep", evidence: "strong", title: "10 min morning light", dose: "10 min outside within 60 min of waking" },
  { id: "caffeine-cutoff-8h", pillar: "sleep", evidence: "promising", title: "No caffeine 8h pre-bed", dose: "Cut caffeine ≥8–10 h before bed" },
  { id: "alcohol-zero-on-training", pillar: "sleep", evidence: "strong", title: "No alcohol on training days", dose: "Zero alcohol within 24 h of a hard session" },
  // movement
  { id: "zone-2-cardio", pillar: "movement", evidence: "strong", title: "Zone 2 cardio", dose: "150–180 min/week @ 60–70% HRmax" },
  { id: "strength-2-3x", pillar: "movement", evidence: "strong", title: "Strength 2–3×/week", dose: "8–12 hard sets per muscle/week" },
  { id: "vo2-intervals-1x", pillar: "movement", evidence: "strong", title: "VO₂max intervals 1×/week", dose: "4×4 min @ ~90% HRmax" },
  { id: "strength-progressive-overload", pillar: "movement", evidence: "strong", title: "Progressive overload", dose: "+2.5–5% load when top of rep range hit" },
  { id: "walk-after-meals-10min", pillar: "movement", evidence: "promising", title: "10 min walk after meals", dose: "10 min within 30 min of largest meal" },
  // nutrition
  { id: "protein-1-6g-per-kg", pillar: "nutrition", evidence: "strong", title: "Protein 1.6 g/kg/day", dose: "Split across 3–4 meals" },
  { id: "log-meals-3x", pillar: "nutrition", evidence: "promising", title: "Log 3 meals", dose: "Photo or search each meal; protein visible by dinner" },
  { id: "fiber-30g", pillar: "nutrition", evidence: "strong", title: "Fibre 25–35 g/day", dose: "Whole-food sources" },
  { id: "hydration-30ml-kg", pillar: "nutrition", evidence: "promising", title: "Hydration ~30 ml/kg", dose: "Front-loaded; less after 19:00" },
  { id: "fasted-cardio", pillar: "nutrition", evidence: "speculative", title: "Fasted Z2 cardio", dose: "30–60 min Z2 fasted, 1–2×/week" },
  // stress / mind / focus
  { id: "breath-box-5min", pillar: "stress", evidence: "strong", title: "Box breathing 5 min", dose: "4-4-4-4 cadence, 5 min" },
  { id: "breath-physiological-sigh", pillar: "stress", evidence: "promising", title: "Physiological sighs (1 min)", dose: "2 short inhales + 1 long exhale, 1 min" },
  { id: "mindfulness-10min", pillar: "stress", evidence: "strong", title: "Mindfulness 10 min", dose: "10 min/day" },
  { id: "nsdr-yoga-nidra-10min", pillar: "stress", evidence: "promising", title: "NSDR / Yoga Nidra", dose: "10–20 min mid-afternoon" },
  { id: "nature-2h-week", pillar: "stress", evidence: "promising", title: "≥2 h nature/week", dose: "Any chunk size, green/blue space" },
  { id: "journaling-5min", pillar: "stress", evidence: "promising", title: "5 min evening journal", dose: "3 bullets: did / learned / next" },
  { id: "deep-work-90min", pillar: "stress", evidence: "strong", title: "90 min deep work block", dose: "Single task, phone in another room" },
  { id: "no-phone-first-60min", pillar: "stress", evidence: "promising", title: "Phone-free first hour", dose: "First 60 min, no inbox/feeds" },
  // recovery
  { id: "mobility-10min", pillar: "recovery", evidence: "promising", title: "10 min mobility", dose: "Targeted mobility, evening" },
  { id: "sauna-20min-4x", pillar: "recovery", evidence: "promising", title: "Sauna 20 min", dose: "20 min @ ~80 °C" },
  { id: "cold-2-3min", pillar: "recovery", evidence: "promising", title: "Cold exposure 2–3 min", dose: "≤15 °C, away from strength sessions" },
  { id: "sun-vitd-15min", pillar: "recovery", evidence: "promising", title: "15 min sun (skin)", dose: "10–20 min midday" },
  { id: "cwt-contrast", pillar: "recovery", evidence: "speculative", title: "Contrast hot/cold", dose: "3 rounds: 3 min hot / 1 min cold" },
  { id: "heart-rate-variability-track", pillar: "recovery", evidence: "speculative", title: "Track morning HRV", dose: "1 min lying down, same time daily" },
  // connection
  { id: "weekly-social-2x", pillar: "connection", evidence: "strong", title: "2 meaningful contacts/week", dose: "≥2 in-depth conversations weekly" },
  { id: "gratitude-3x", pillar: "connection", evidence: "promising", title: "3 gratitudes nightly", dose: "3 specific gratitudes, written" },
];
const PROTOCOL_IDS = PROTOCOL_CATALOG.map((p) => p.id);
const FRAMEWORK_VERSION = "1.0";
const PROTOCOL_BY_ID: Record<string, typeof PROTOCOL_CATALOG[number]> = Object.fromEntries(
  PROTOCOL_CATALOG.map((p) => [p.id, p]),
);

// Voice-only nuance — persona itself lives in ../_shared/coach-persona.ts.
const TONE_VOICE: Record<string, string> = {
  drill_sergeant: "Voice: clipped, imperative. No pleasantries, no hedging.",
  calm_mentor: "Voice: steady, fuller sentences. Calm authority.",
  scientist: "Voice: cite mechanism briefly. One percentage / dose anchor per mission.",
  hype: "Voice: high energy, identity language. Still specific, never cheesy.",
};

const buildPrompt = (
  profile: any,
  program: any,
  todayDay: any,
  checkins: Checkin[],
  readiness: { score: number; breakdown: any },
  adjustment: string,
  athlete: any,
  goal: any,
  memories: { fact: string }[],
  skipStats: { protocol_id: string; skips: number }[],
  habitContext: Array<{
    protocol_id: string;
    streak: number;
    level: number;
    logs_7d: number;
    last_logged: string | null;
  }>,
  /**
   * Per-lift trend, PRs and stalls from the athlete's own logged sets.
   *
   * This function decides today's missions and, until now, could not see a
   * single weight the athlete had lifted — it knew the session's NAME and its
   * duration and nothing else. The chat coach and the morning brief have both
   * read this block for months; the one surface that actually prescribes the
   * day was the one flying blind.
   */
  progressionBlock: string,
) => {
  const username = profile?.username ?? "operator";
  const tier = profile?.status_tier ?? "recruit";
  const streak = profile?.streak ?? 0;
  const last = checkins[checkins.length - 1];

  const wasSick = (c: Checkin | undefined) => Boolean((c as { habits?: { sick_day?: boolean } } | undefined)?.habits?.sick_day);
  const consecutiveTrained = (() => {
    let n = 0;
    for (let i = checkins.length - 1; i >= 0; i--) {
      if (checkins[i].workout) n++;
      else break;
    }
    return n;
  })();
  const recent = last
    ? `Yesterday: sleep ${last.sleep_hours}h · ${last.workout ? `workout✓${sportName(last.sport) ? ` (${sportName(last.sport)})` : ""}` : "no workout"} · hydration ${last.hydration_liters}L · ${last.cold_shower ? "cold✓" : "no cold"} · ${last.healthy_food ? "food✓" : "food gap"}${wasSick(last) ? " · ⚠️ SICK (self-reported)" : ""}${consecutiveTrained >= 6 ? ` · 🔺 ${consecutiveTrained} consecutive training days (overtraining risk)` : ""}`
    : "No check-in yesterday.";

  const sessionLine = todayDay
    ? `Program calls for: ${todayDay.focus} (${todayDay.duration_min} min, ${todayDay.blocks?.length ?? 0} blocks)`
    : "No program session scheduled today.";

  // Personalization block
  const tone = athlete?.tone_pref ?? "calm_mentor";
  const toneRule = TONE_VOICE[tone] ?? TONE_VOICE.calm_mentor;
  const focus = new Set<string>(((athlete?.mental_health_focus as string[]) ?? []).filter(Boolean));
  const noGo = new Set<string>([
    ...((athlete?.no_go_protocols as string[]) ?? []),
    ...skipStats.filter((s) => s.skips >= 5).map((s) => s.protocol_id),
  ]);
  // Hard-block HIIT / cold-shock first-line when anxiety is flagged
  if (focus.has("anxiety")) {
    PROTOCOL_CATALOG
      .filter((p) => /hiit|sprint|cold-?(shock|plunge|shower)/i.test(p.id) || /hiit|sprint/i.test(p.title))
      .forEach((p) => noGo.add(p.id));
  }
  const allowedCatalog = PROTOCOL_CATALOG.filter((p) => !noGo.has(p.id));
  const allowedIds = allowedCatalog.map((p) => p.id);

  // Mental-health-focus driven mission count + composition rules.
  const missionRules: string[] = [];
  let missionCount = "4–5";
  if (focus.has("burnout")) {
    missionCount = "2 (not more)";
    missionRules.push("BURNOUT MODE: total missions capped at 2. At least one MUST be domain=recovery or domain=mind. No 'edge' missions.");
  }
  if (focus.has("sleep")) {
    missionRules.push("SLEEP PRIORITY: include exactly one sleep-protective evening anchor mission (wind-down ritual, screens-off cutoff, magnesium etc.). It is non-negotiable.");
  }
  if (focus.has("anxiety")) {
    missionRules.push("ANXIETY MODE: lead with a parasympathetic / breath-paced mission. No HIIT or cold-shock as primary. Frame missions with zero ambiguity — exact when, where, how long.");
  }
  if (focus.has("low_mood")) {
    missionRules.push("LOW MOOD: include one mission that creates a small, definite win in <15 min. Name a strength you see in their data when justifying it.");
  }
  if (focus.has("focus")) {
    missionRules.push("FOCUS MODE: keep mission list lean. Single primary action, batched habits, no decision fatigue.");
  }

  // Hobby → mission framing hints
  const hobbies = ((athlete?.hobbies as string[]) ?? []).filter(Boolean);
  const hobbyHints: string[] = [];
  if (hobbies.includes("reading")) hobbyHints.push("reading → frame the mind / wind-down mission as a 15-min reading block");
  if (hobbies.includes("outdoors")) hobbyHints.push("outdoors → frame recovery as a walk outside, not indoor mobility");
  if (hobbies.includes("music")) hobbyHints.push("music → pair the breath / wind-down mission with a slow-tempo playlist");
  if (hobbies.includes("cooking")) hobbyHints.push("cooking → frame the fuel mission around prepping one specific meal");
  if (hobbies.includes("creative work") || hobbies.includes("creative")) hobbyHints.push("creative → frame the focus mission as a 25-min creative flow block");

  const profileBlock = athlete
    ? `ATHLETE PROFILE
- ${athlete.i_am ? `Identity: "${athlete.i_am}"` : "Identity: not set"}
- Body: ${athlete.age ?? "?"}y, ${athlete.sex ?? "?"}, ${athlete.height_cm ?? "?"}cm, ${athlete.weight_kg ?? "?"}kg
- Goal: ${athlete.primary_goal ?? "?"} over ${athlete.target_horizon_weeks ?? "?"} weeks
- Scheduling rule: NEVER give missions exact clock times — anchor to morning / afternoon / evening at most.
- SICK RULE: if the recent check-ins show the user marked sick_day (today or yesterday), plan a RECOVERY day — rest, fluids, extra sleep, gentle mobility at most. No training missions, no cold exposure.
- OVERTRAINING RULE: if they have trained 6+ consecutive days, schedule a deliberate rest/recovery day and say why — adaptation happens in recovery.
- Diet: ${(athlete.dietary ?? []).join(", ") || "omnivore"}
- Equipment: ${(athlete.equipment ?? []).join(", ") || "bodyweight only"}
- Injuries: ${(athlete.injuries ?? []).join(", ") || "none"}
- Hard no-go protocols: ${[...noGo].join(", ") || "none"}
- Tone: ${tone} — ${toneRule}`
    : "ATHLETE PROFILE: not provided.";

  const goalBlock = goal
    ? `NORTH STAR GOAL: "${goal.title}" — currently ${goal.current_value ?? goal.baseline_value ?? "?"}${goal.unit} → target ${goal.target_value}${goal.unit}${goal.deadline ? ` by ${goal.deadline}` : ""}.`
    : "NORTH STAR GOAL: none set.";

  const memBlock = memories.length
    ? `WHAT YOU KNOW ABOUT THIS ATHLETE:\n${memories.slice(0, 10).map((m) => `- ${m.fact}`).join("\n")}`
    : "WHAT YOU KNOW: nothing yet.";

  // ── Adopted habits block — the system layer the user is compounding ──
  // The model uses this to: (a) reinforce active habits, (b) flag stale
  // ones that have decayed, (c) avoid suggesting new habits the user
  // already runs. Each mission should map to an adopted habit when
  // possible — that's how the long-game and the daily plan stay aligned.
  const habitsBlock = habitContext.length === 0
    ? `ADOPTED HABITS: none yet. The user hasn't chosen any long-game protocols. You MAY suggest 1 new habit as a "primary" mission and frame it as the start of a streak.`
    : `ADOPTED HABITS (the user's chosen long-game stack — anchor missions here):
${habitContext.map((h) => {
  const p = PROTOCOL_CATALOG.find((x) => x.id === h.protocol_id);
  const title = p?.title ?? h.protocol_id;
  const stale = h.logs_7d === 0 ? " [STALE — 0 logs this week, gently re-engage]"
              : h.logs_7d >= 5 ? " [HOT — running consistently]"
              : "";
  return `- ${title} (id: ${h.protocol_id}, Lv${h.level}, ${h.streak}d streak, ${h.logs_7d}/7 days)${stale}`;
}).join("\n")}

HABIT-MISSION ALIGNMENT RULES:
- Every "habit" type mission MUST reference one of the user's adopted habits by id.
- If a habit is STALE, your mission can be the lightest possible version of it (e.g., "today just put on the workout clothes" for a stale movement habit).
- Do NOT propose a new habit if the user already has 6+ adopted habits — focus on compounding what they have.`;

  const catalogLines = allowedCatalog
    .map((p) => `- [${p.evidence.toUpperCase()}] ${p.id} (${p.pillar}) — ${p.title} :: ${p.dose}`)
    .join("\n");

  const personaBlock = buildPersonaBlock(athlete ?? {}, undefined, { firstName: username });
  const holisticBlock = buildHolisticContext(athlete ?? {});

  return `${personaBlock}

You are also grounded in physiology, behaviour science, and the Wellness Framework v${FRAMEWORK_VERSION}.

${holisticBlock}

TODAY'S READINESS: ${readiness.score}/100 → adjustment "${adjustment}"
Breakdown: avg sleep ${readiness.breakdown.avg_sleep_h}h, last RPE ${readiness.breakdown.last_rpe ?? "n/a"}, missed sessions ${readiness.breakdown.missed_7d}/7d.
ATHLETE STATUS: ${username} · tier ${tier} · streak ${streak}d
${recent}
${sessionLine}
${progressionBlock ? `\n${progressionBlock}\n` : ""}
${profileBlock}

${goalBlock}

${memBlock}

${habitsBlock}

PROTOCOL CATALOG (you MUST pick protocol_id ONLY from this list — no-go items already filtered out):
${catalogLines}

Build ${missionCount} high-impact missions for the next 24 hours.

HARD RULES:
1. Every mission must reference a real \`protocol_id\` from the catalog above. Never invent ids.
2. Every mission must include the protocol's \`evidence\` tier (strong | promising | speculative) verbatim from the catalog.
3. At least 60% of total mission XP MUST come from "strong" evidence protocols.
4. Respect injuries, diet, equipment — never prescribe something the athlete physically cannot or will not do.
5. Tailor at least one mission to the athlete's primary_goal (${athlete?.primary_goal ?? "general"}).
6. If a North Star goal is set, the primary mission MUST move the needle on it; reference it in the \`why\`.
7. Exactly one mission with kind="primary" (movement unless adjustment="swap" → recovery).
8. Always include one "recovery", one "focus", one "habit" mission — UNLESS a mental-health rule below overrides count.
9. If readiness ≥ 70 add one "edge" stretch mission — UNLESS burnout mode is active.
10. \`why\` MUST reference this athlete's actual data, identity, hobby, life context, or goal in ≤140 chars.${
    missionRules.length
      ? `\n\nMENTAL-HEALTH-FOCUS OVERRIDES (apply on top of base rules):\n${missionRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
      : ""
  }${
    hobbyHints.length
      ? `\n\nHOBBY-AWARE FRAMING (use where natural, don't force):\n${hobbyHints.map((h) => `- ${h}`).join("\n")}`
      : ""
  }

XP guidance: primary 50–60 · recovery 25–35 · focus 20–30 · habit 15–20 · edge 20–30.

${toneRule}

Also produce:
- "headline" (≤60 chars) summarising today's stance.
- "rationale" (≤220 chars) — one paragraph explaining the plan, citing the strongest data signal driving it AND naming one specific holistic field (life context, hobby, mood, or focus area) that shaped the call.

Use the emit_daily_plan tool. Mission ids must be short kebab-case. Allowed protocol_ids: ${allowedIds.length} options.`;
};

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "emit_daily_plan",
    description: "Emit today's adaptive, evidence-graded mission plan.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string", maxLength: 70 },
        rationale: { type: "string", maxLength: 240 },
        missions: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "kind", "title", "xp", "priority", "protocol_id", "evidence", "why"],
            properties: {
              id: { type: "string" },
              kind: { type: "string", enum: ["primary", "recovery", "focus", "habit", "edge"] },
              title: { type: "string", maxLength: 80 },
              detail: { type: "string", maxLength: 120 },
              xp: { type: "integer", minimum: 10, maximum: 80 },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              protocol_id: { type: "string", enum: PROTOCOL_IDS },
              evidence: { type: "string", enum: ["strong", "promising", "speculative"] },
              why: { type: "string", maxLength: 160 },
            },
          },
        },
      },
      required: ["headline", "rationale", "missions"],
    },
  },
};

const fallbackPlan = (todayDay: any, adjustment: string, readinessScore: number, breakdown: any) => {
  const isSwap = adjustment === "swap";
  const lowSleep = (breakdown?.avg_sleep_h ?? 7) < 7;
  const missions: any[] = [
    isSwap
      ? {
          id: "primary-mobility",
          kind: "recovery",
          title: "Active recovery · 10 min mobility",
          detail: "Easy walk + targeted mobility flow.",
          xp: 35,
          priority: "high",
          protocol_id: "mobility-10min",
          evidence: "promising",
          why: "Readiness is low — shift load away from CNS today.",
        }
      : {
          id: "primary-strength",
          kind: "primary",
          title: adjustment === "deload" ? "Strength · lighter loads" : "Strength · 8–12 hard sets",
          detail: adjustment === "push" ? "Push for +2.5–5% overload." : "Hit prescribed sets crisply.",
          xp: 55,
          priority: "high",
          protocol_id: "strength-2-3x",
          evidence: "strong",
          why: "Strength 2–3×/week is the highest-leverage longevity protocol after sleep.",
        },
    {
      id: "sleep-tonight",
      kind: "recovery",
      title: "Sleep 7–9 h tonight",
      detail: "Lights down by 22:30. Phone out of bedroom.",
      xp: 30,
      priority: "high",
      protocol_id: "sleep-7-9h",
      evidence: "strong",
      why: lowSleep ? "Avg sleep below 7 h — biggest single lever to recover." : "Protect the window — keeps tomorrow on track.",
    },
    {
      id: "deep-work",
      kind: "focus",
      title: "90 min deep work, no phone",
      detail: "One task. Phone in another room.",
      xp: 25,
      priority: "medium",
      protocol_id: "deep-work-90min",
      evidence: "strong",
      why: "Single-task blocks compound output — the cognitive equivalent of progressive overload.",
    },
    {
      id: "hydration",
      kind: "habit",
      title: "Hydration ~30 ml/kg today",
      detail: "Front-load before 18:00; ease off in the evening.",
      xp: 15,
      priority: "medium",
      protocol_id: "hydration-30ml-kg",
      evidence: "promising",
      why: "Plasma volume drives performance and tames tension headaches.",
    },
  ];
  if (readinessScore >= 70) {
    missions.push({
      id: "edge-cold",
      kind: "edge",
      title: "Edge: 2–3 min cold finish",
      detail: "End shower cold ≤15 °C. Box-breathe.",
      xp: 25,
      priority: "low",
      protocol_id: "cold-2-3min",
      evidence: "promising",
      why: "Readiness is high — spend a little for mood lift and resilience.",
    });
  }
  const headline = adjustment === "push"
    ? "Push day — earned it."
    : adjustment === "deload"
    ? "Deload — recover smart."
    : adjustment === "swap"
    ? "Recovery swap — rebuild."
    : "Hold the line.";
  const rationale = `Readiness ${readinessScore}/100 → ${adjustment}. ${lowSleep ? "Sleep is the limiting signal." : "Stack the strong-evidence basics."} Framework v${FRAMEWORK_VERSION}.`;
  return { headline, rationale, missions };
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [profileRes, checkinsRes, programRes, athleteRes, goalRes, memoryRes, skipRes, habitsRes, habitLogsRes, habitGaps] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, status_tier, streak, longest_streak, xp, level")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("daily_checkins")
        .select(
          "checked_in_at, xp_earned, workout, sport, cold_shower, healthy_food, protein_intake, hydration_liters, sleep_hours, reading, no_phone_morning, no_phone_evening, habits",
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
      supabase.from("coach_athlete_profile").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("coach_goals")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("coach_chat_memory")
        .select("fact")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("coach_preference_signals")
        .select("protocol_id")
        .eq("user_id", userId)
        .eq("signal_type", "skipped_protocol")
        .gte("created_at", thirtyDaysAgo),
      // User's adopted habits — the long-game protocols they've committed to.
      // We surface these in the prompt so missions cluster around what the
      // user has actually chosen to compound, instead of suggesting random
      // protocols every day.
      supabase
        .from("user_habits")
        .select("id, protocol_id, current_streak, best_streak, level, last_logged_on")
        .eq("user_id", userId)
        .is("archived_at", null),
      // Last 7d of habit logs so we can see what they've actually been doing
      // (not just adopted but ignoring). Lets the plan flag stale habits.
      supabase
        .from("user_habit_logs")
        .select("habit_id, logged_on")
        .eq("user_id", userId)
        .gte("logged_on", sevenDaysAgo.slice(0, 10)),
      // Per-habit truth + today's food diary — the same block the chat coach sees.
      gatherHabitGaps(supabase, userId, { days: 14 }).catch(() => null),
    ]);

    const profile = profileRes.data;
    const checkins = (checkinsRes.data ?? []) as Checkin[];
    const program = programRes.data as any;
    const athlete = (athleteRes as any)?.data ?? null;
    const goal = (goalRes as any)?.data ?? null;
    const memories = (((memoryRes as any)?.data ?? []) as { fact: string }[]);
    const skipRows = (((skipRes as any)?.data ?? []) as { protocol_id: string | null }[]);
    const skipMap = new Map<string, number>();
    for (const r of skipRows) {
      if (!r.protocol_id) continue;
      skipMap.set(r.protocol_id, (skipMap.get(r.protocol_id) ?? 0) + 1);
    }
    const skipStats = [...skipMap.entries()].map(([protocol_id, skips]) => ({ protocol_id, skips }));

    // ── Adopted habits + recent compliance ─────────────────────────────
    type UserHabitRow = {
      id: string;
      protocol_id: string;
      current_streak: number;
      best_streak: number;
      level: number;
      last_logged_on: string | null;
    };
    type HabitLogRow = { habit_id: string; logged_on: string };
    const userHabits = ((habitsRes as any)?.data ?? []) as UserHabitRow[];
    const habitLogs = ((habitLogsRes as any)?.data ?? []) as HabitLogRow[];
    const logsByHabit = new Map<string, number>();
    for (const l of habitLogs) {
      logsByHabit.set(l.habit_id, (logsByHabit.get(l.habit_id) ?? 0) + 1);
    }
    // Enriched view: per-habit logs in last 7d so the model can spot
    // ones the user adopted but is ignoring ("stale habits").
    const habitContext = userHabits.map((h) => ({
      protocol_id: h.protocol_id,
      streak: h.current_streak,
      level: h.level,
      logs_7d: logsByHabit.get(h.id) ?? 0,
      last_logged: h.last_logged_on,
    }));

    // Recent program logs (for missed sessions + last RPE)
    let lastRpe: number | null = null;
    let missedSessions7d = 0;
    // Every log of the block, not just the last week: the week the athlete is
    // in is derived from what they logged (see _shared/program-week.ts).
    let programLogs: any[] = [];
    if (program) {
      const { data: logs } = await supabase
        .from("coach_program_logs")
        .select("perceived_rpe, logged_at, week, day_index, completed")
        .eq("user_id", userId)
        .eq("program_id", program.id)
        .order("logged_at", { ascending: false });
      programLogs = (logs ?? []) as any[];
      const arr = programLogs.filter((l) => l.logged_at >= sevenDaysAgo);
      const withRpe = arr.find((l) => l.perceived_rpe != null);
      lastRpe = withRpe?.perceived_rpe ?? null;
      // crude estimate: planned target sessions per week vs completed
      const targetWeekly = program.days_per_week ?? 4;
      missedSessions7d = Math.max(0, targetWeekly - arr.filter((l) => l.completed).length);
    } else {
      missedSessions7d = Math.max(0, 4 - checkins.filter((c) => c.workout).length);
    }

    // Fall back to the evening reflection's RPE.
    //
    // `coach_program_logs.perceived_rpe` above is the intended source, but no
    // client has ever written it — TodaySessionCard marks a session done with
    // { completed: true } and nothing else. So lastRpe was null for every user
    // on every day, and computeReadiness silently fell back to its
    // `rpeScore = 18` default: 18 of the 100 readiness points were a constant
    // pretending to be personal.
    //
    // The RPE the athlete actually gives sits one table over, in
    // coach_reflections.rpe_1to10 (written by EveningReflectionCard).
    // coach-generate-program already reads it; the daily readiness calc never
    // did. Deliberately outside the `if (program)` block above: someone
    // reflecting without an active program still deserves a real number.
    if (lastRpe == null) {
      const { data: reflection } = await supabase
        .from("coach_reflections")
        .select("rpe_1to10")
        .eq("user_id", userId)
        .gte("reflection_date", sevenDaysAgo.slice(0, 10))
        .not("rpe_1to10", "is", null)
        .order("reflection_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastRpe = (reflection as any)?.rpe_1to10 ?? null;
    }

    const readiness = computeReadiness(checkins, lastRpe, profile?.streak ?? 0, missedSessions7d);
    const adjustment = adjustmentFor(readiness.score);

    // Resolve today's program day (Mon=0..Sun=6)
    let todayDay: any = null;
    if (program) {
      const today = new Date();
      // Calendar AND logs — the same week the runner shows, so the plan never
      // prescribes week 4 to someone the client shows on week 2.
      const week = programWeekState({ startedOn: program.started_on, weeks: program.weeks, logs: programLogs, now: today }).currentWeek;
      const js = today.getDay();
      const dayIdx = (js + 6) % 7;
      const w = (program.plan_json?.weeks ?? []).find((x: any) => x.week === week);
      todayDay = w?.days?.[dayIdx] ?? null;
    }

    // Generate via AI (or fallback)
    let headline: string | null = null;
    let rationale: string | null = null;
    let missions: any[] = [];

    if (OPENROUTER_API_KEY) {
      try {
        // Last night's recovery signals → let the plan account for under-recovery.
        const nightSignals = await gatherNightSignals(supabase, userId).catch(() => ({ hasData: false }));
        const causalBlock = buildCausalBlock(nightSignals as any);
        const gapsBlock = buildHabitGapsBlock(habitGaps);
        // The athlete's own logged sets — per-lift trend, PRs and stalls. The
        // same block the chat coach and the morning brief already read. Fails
        // open: a plan without it is worse, but a plan that never arrives is
        // worse still.
        const progression = await gatherProgression(supabase, userId).catch(() => []);
        const progressionBlock = buildProgressionBlock(progression);
        const prompt = buildPrompt(profile, program, todayDay, checkins, readiness, adjustment, athlete, goal, memories, skipStats, habitContext, progressionBlock)
          + (causalBlock ? `\n\n${causalBlock}\n\nIf recovery is clearly suppressed vs baseline, bias today toward recovery/lighter load and say why in the rationale.` : "")
          + (gapsBlock ? `\n\n${gapsBlock}` : "");
        const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a data-driven elite performance coach grounded in the Wellness Framework. Always emit the plan via the emit_daily_plan tool. Pick protocol_id ONLY from the provided catalog.",
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
            rationale = parsed.rationale ?? null;
            missions = (parsed.missions ?? [])
              .map((m: any) => {
                const protoId = typeof m.protocol_id === "string" ? m.protocol_id : null;
                const proto = protoId ? PROTOCOL_BY_ID[protoId] : null;
                if (!proto) return null; // drop missions referencing unknown protocols
                return {
                  id: String(m.id ?? crypto.randomUUID()).slice(0, 64),
                  kind: m.kind,
                  title: String(m.title ?? proto.title).slice(0, 100),
                  detail: m.detail ? String(m.detail).slice(0, 160) : undefined,
                  xp: Math.max(10, Math.min(80, parseInt(m.xp ?? 20))),
                  priority: m.priority ?? "medium",
                  protocol_id: proto.id,
                  evidence: proto.evidence,
                  pillar: proto.pillar,
                  why: m.why ? String(m.why).slice(0, 200) : undefined,
                };
              })
              .filter(Boolean);
          }
        } else {
          console.warn("AI gateway non-ok:", aiResp.status, await aiResp.text());
        }
      } catch (e) {
        console.warn("AI gateway error:", e);
      }
    }

    if (missions.length === 0) {
      const fb = fallbackPlan(todayDay, adjustment, readiness.score, readiness.breakdown);
      headline = fb.headline;
      rationale = fb.rationale;
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
      _generated_with: OPENROUTER_API_KEY ? "google/gemini-2.5-flash" : "fallback",
      _rationale: rationale,
      _framework_version: FRAMEWORK_VERSION,
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
        rationale,
        framework_version: FRAMEWORK_VERSION,
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
