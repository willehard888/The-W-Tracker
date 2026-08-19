// AI Coach edge function — streaming chat using Lovable AI Gateway (GPT-5)
// Persona: trainer + sport psychologist + somatic therapist + brutally-honest
// friend. The user's holistic profile (hobbies, life context, stress / mood,
// mental-health focus) is injected into every prompt so replies speak to
// *this person*, not a generic athlete.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildPersonaBlock,
  buildHolisticContext,
  isVentingMessage,
  REGISTER_PROTOCOL,
  VENT_DIRECTIVE,
  type TodayMood,
} from "../_shared/coach-persona.ts";
import { gatherSituation, buildSituationBlock } from "../_shared/situation.ts";
import { gatherProgression, buildProgressionBlock } from "../_shared/progression.ts";
import { gatherNightSignals, buildCausalBlock } from "../_shared/health-causal.ts";
import { INNER_WORK_BLOCK } from "../_shared/inner-work-catalog.ts";
import { sportName, sportBreakdown } from "../_shared/sports.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Checkin {
  checked_in_at: string;
  xp_earned: number;
  workout: boolean;
  sport: string | null;
  cold_shower: boolean;
  healthy_food: boolean;
  protein_intake: boolean;
  hydration_liters: number;
  sleep_hours: number;
  reading: boolean;
  no_phone_morning: boolean;
  no_phone_evening: boolean;
}

const summarize7d = (checkins: Checkin[]) => {
  if (!checkins || checkins.length === 0) return "No check-ins in the last 7 days.";
  const days = checkins.length;
  const avgSleep = checkins.reduce((s, c) => s + Number(c.sleep_hours ?? 0), 0) / days;
  const avgHydr = checkins.reduce((s, c) => s + Number(c.hydration_liters ?? 0), 0) / days;
  const totalXp = checkins.reduce((s, c) => s + (c.xp_earned ?? 0), 0);
  const workouts = checkins.filter((c) => c.workout).length;
  const sportsLine = sportBreakdown(checkins.filter((c) => c.workout).map((c) => c.sport));
  const cold = checkins.filter((c) => c.cold_shower).length;
  const perfect = checkins.filter(
    (c) =>
      c.workout &&
      c.cold_shower &&
      c.healthy_food &&
      c.protein_intake &&
      c.hydration_liters >= 3 &&
      c.reading &&
      c.no_phone_morning &&
      c.no_phone_evening,
  ).length;
  const last = checkins[checkins.length - 1];
  return `Last 7d: ${days}/7 check-ins, ${totalXp} XP total, avg sleep ${avgSleep.toFixed(1)}h, avg hydration ${avgHydr.toFixed(1)}L, ${workouts} workouts${sportsLine ? ` (${sportsLine})` : ""}, ${cold} cold showers, ${perfect} perfect days.
Yesterday: sleep ${last.sleep_hours}h, ${last.workout ? `workout✓${sportName(last.sport) ? ` (${sportName(last.sport)})` : ""}` : "no workout"}, ${last.cold_shower ? "cold✓" : "no cold"}, hydration ${last.hydration_liters}L.`;
};

// Voice nuance now lives inside buildPersonaBlock() in ../_shared/coach-persona.ts.

// ── Context gating ────────────────────────────────────────────────────────────
// A "Moi" against a 4k-token briefing prompt produced briefing-shaped replies:
// with a 3-token message, attention has nowhere to go but the injected stats.
// Light messages get a ~1k-token prompt (persona + register + memory) so the
// model can simply TALK. False-light is safe — chat history + memory carry
// continuity, and the register rules still allow coaching when asked.
const GREETING_RE =
  /^(moi+|moikka|morjes|moro|terve|hei+|heippa|huomenta|hyvää huomenta|hyvää iltaa|iltaa|kiitos|kiitti|ok(ei)?|selvä|jees|hyvä|joo+|no moi|mitä kuuluu|mitäs kuuluu|mites menee|miten menee|hi|hey+|hello|yo|sup|thanks|thank you|good (morning|evening)|gm|what'?s up|how are you)[\s!?.,🙂😊👋🔥💪]*$/i;
const DOMAIN_RE =
  /tree?ni|ohjelm|sali|penk|kyyk|maastav|sarj|toisto|prote|ravin|ruoka|nukku|\buni\b|palautu|väsy|stress|workout|program|plan|gym|bench|squat|deadlift|\bset\b|\brep\b|sleep|recover|paino|kilo|\d/i;
const isLightMessage = (msg: string, goDeep: boolean): boolean => {
  if (goDeep) return false;
  const t = msg.trim();
  if (GREETING_RE.test(t)) return true;
  return t.length <= 30 && !t.includes("?") && t.split(/\s+/).length <= 4 && !DOMAIN_RE.test(t);
};

const buildSystemPrompt = (
  profile: any,
  athlete: any,
  checkins7d: Checkin[],
  briefingInsights: any[] | null,
  todayBrief: any | null,
  todaySession: any | null,
  reflections: any[],
  goals: any[],
  recentLogs: any[],
  todayMood: TodayMood | undefined,
  latestUserMessage: string,
  situationBlock: string,
  memoryBlock: string,
  knowledgeBlocks: string,
  light: boolean,
) => {
  const tier = profile?.status_tier ?? "recruit";
  const streak = profile?.streak ?? 0;
  const longest = profile?.longest_streak ?? 0;
  const username = profile?.username ?? "operator";
  const firstName = (athlete?.i_am || username).split(" ")[0];

  // If the freshest reflection has data and the caller didn't supply
  // an explicit pre-chat snapshot, fall back to it so the persona block
  // is grounded in real signal rather than baseline only.
  const fallbackReflection = reflections?.[0];
  const mood: TodayMood = {
    energy: todayMood?.energy ?? fallbackReflection?.energy_1to5 ?? null,
    mood: todayMood?.mood ?? fallbackReflection?.mood_1to5 ?? null,
  };

  const personaBlock = buildPersonaBlock(athlete ?? {}, mood, { firstName });
  const holisticBlock = buildHolisticContext(athlete ?? {}, mood);
  const ventDirective = isVentingMessage(latestUserMessage) ? VENT_DIRECTIVE : "";

  const recentSummary = summarize7d(checkins7d);

  const insightsBlock =
    briefingInsights && briefingInsights.length > 0
      ? `\n\nFrom last week's briefing:\n${briefingInsights
          .slice(0, 3)
          .map((i: any) => `- ${i.title}: ${i.detail}`)
          .join("\n")}`
      : "";

  // One line, not the whole brief — the user already read it on the Coach
  // page; echoing it verbatim made every chat turn duplicate the briefing.
  const briefBlock = todayBrief
    ? `\n\nThis morning's brief already told them: "${String(todayBrief.brief_md ?? "").slice(0, 140)}…" — do not repeat it; stay consistent with it if training comes up.`
    : "";

  const sessionBlock = todaySession
    ? `\n\nToday's prescribed session: ${todaySession.focus} · ${todaySession.duration_min ?? "?"} min · ${todaySession.blocks?.length ?? 0} blocks${todaySession.blocks?.[0]?.name ? ` (lead: ${todaySession.blocks[0].name})` : ""}.`
    : "";

  const reflectionsBlock = reflections.length
    ? `\n\nLast ${reflections.length} reflections (newest first): ${reflections
        .map((r) => `RPE ${r.rpe_1to10 ?? "?"}, energy ${r.energy_1to5 ?? "?"}/5, sleepQ ${r.sleep_quality_1to5 ?? "?"}/5, mood ${r.mood_1to5 ?? "?"}/5${r.friction ? `, friction: ${String(r.friction).slice(0, 80)}` : ""}`)
        .join(" | ")}`
    : "";

  const goalsBlock = goals.length
    ? `\n\nActive goals:\n${goals
        .map((g) => {
          const cur = Number(g.current_value ?? 0);
          const tgt = Number(g.target_value ?? 0);
          const base = Number(g.baseline_value ?? 0);
          const span = tgt - base || 1;
          const pct = Math.max(0, Math.min(100, Math.round(((cur - base) / span) * 100)));
          return `- ${g.title}: ${cur} → ${tgt} ${g.unit ?? ""} (${pct}%${g.deadline ? `, by ${g.deadline}` : ""})`;
        })
        .join("\n")}`
    : "";

  const logsBlock = recentLogs.length
    ? `\n\nLast ${recentLogs.length} session logs: ${recentLogs
        .map((l) => `W${l.week}D${l.day_index + 1} ${l.completed ? "✓" : "skip"}${l.perceived_rpe ? ` @RPE${l.perceived_rpe}` : ""}`)
        .join(", ")}`
    : "";

  const today = new Date();
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()];

  // ── LIGHT MODE — greetings / small talk. ~1k tokens: persona + register +
  // memory. No stats arsenal to recite, so the model can simply be a person.
  if (light) {
    const lastCheckin = checkins7d[checkins7d.length - 1];
    const glance = `Today at a glance (mention only if genuinely relevant, never as a report): streak ${streak}d${
      lastCheckin ? ` · yesterday sleep ${lastCheckin.sleep_hours}h` : ""
    }${todaySession ? ` · session on deck: ${todaySession.focus}` : ""}.`;

    return `${personaBlock}

${REGISTER_PROTOCOL}

${holisticBlock}

Today is ${dayName}, ${today.toISOString().slice(0, 10)}.
${glance}${memoryBlock}

How to reply: apply the CONVERSATION REGISTER above. Mirror their language and energy — "Moi" gets "Moi" energy back, not a briefing. At most one question, and only if it genuinely matters. No markdown in small talk. If they signal crisis (suicidal language, "I can't function"), name what you see in one sentence, give one regulation tool, and point them — by name — to a human professional today.${ventDirective}`;
  }

  return `${personaBlock}

${REGISTER_PROTOCOL}

${holisticBlock}

Today is ${dayName}, ${today.toISOString().slice(0, 10)}.

Athlete file:
- Handle: ${username} · first name: ${firstName}
- Goal: ${athlete?.primary_goal ?? "general performance"}${athlete?.secondary_goal ? ` + ${athlete.secondary_goal}` : ""} (horizon ${athlete?.target_horizon_weeks ?? "?"} weeks)
- Age / sex: ${athlete?.age ?? "?"} / ${athlete?.sex ?? "?"} · ${athlete?.height_cm ?? "?"}cm · ${athlete?.weight_kg ?? "?"}kg
- Sports they train: ${(athlete?.sports ?? []).map((id: string) => sportName(id) ?? id).join(", ") || "not set"}
- Equipment: ${(athlete?.equipment ?? []).join(", ") || "unknown"}
- Injuries: ${(athlete?.injuries ?? []).join(", ") || "none reported"}
- Dietary: ${(athlete?.dietary ?? []).join(", ") || "none"}
- No-go protocols (hard filter, never suggest): ${(athlete?.no_go_protocols ?? []).join(", ") || "none"}
- Preferred session length: ${athlete?.preferred_session_length_min ?? 45} min
- Rhythm: wake ${athlete?.wake_time ?? "?"} · sleep ${athlete?.sleep_time ?? "?"} · training days ${(athlete?.training_days_pref ?? []).join("/") || "flexible"}${Array.isArray(athlete?.busy_blocks) && athlete.busy_blocks.length ? `\n- Busy blocks: ${athlete.busy_blocks.map((b: any) => `${b.label ?? b.day ?? ""} ${b.start ?? ""}-${b.end ?? ""}`.trim()).filter(Boolean).join("; ").slice(0, 160)}` : ""}
- Tier: ${tier} · Streak ${streak}d (longest ${longest})

Recent activity:
${recentSummary}${reflectionsBlock}${goalsBlock}${logsBlock}${insightsBlock}${briefBlock}${sessionBlock}
${situationBlock ? `\n${situationBlock}\n` : ""}
${INNER_WORK_BLOCK}
${knowledgeBlocks}

How to reply — the craft of a world-class private coach.
Apply the CONVERSATION REGISTER above — registers 1–3 exempt you from every prescription rule below:
- **When they asked a question, lead with the answer.** First sentence = the verdict or the move. No preamble, no "great question", no restating what they asked. (Contentless messages — greetings, thanks — have no "answer" to lead with; do not manufacture one.)
- **Match length to the weight of what they asked.** A vent → mirror first, then ONE question or small move. Quick tactical Q → 2–3 sentences. Deep ask → go deep but structured. Default ceiling: 3 short paragraphs; greetings and small talk: 1–2 sentences.
- **One concrete next move** at the end of coaching replies (registers 4–6 only). Dated to today or tomorrow. Specific (movement, breath count, time on the calendar) — never "try to relax".
- **Use what you know.** Their file, memory, and last 7 days exist so you never coach a stranger. Continuity is the product: "how did the knee handle Tuesday's volume?" beats any generic insight. But weave facts in naturally — never recite data back, never mention having "memory" or "data".
- **When a sport is in play** (theirs from the file, or named in the message), coach it like a specialist: sport-specific conditioning, movement patterns, common injury profiles, skill/practice periodization — and connect gym work to on-court/field/ice performance. Generic gym advice for a named sport is a failure.
- Reference at most ONE concrete stat, only if it sharpens the answer.
- **Ask at most ONE question, and only when the answer genuinely changes your prescription.** If you can give a sensible default with a fork ("if X, do A; if Y, do B"), do that instead of asking.
- **Hold the standard.** No empty validation, no cheerleading — praise evidence (a rep done tired, a streak defended), not effort-theater. You are demanding AND unmistakably on their side; certainty over hedging ("do this" — not "you could consider").
- Mirror their language and energy: terse athlete gets terse coach; "Moi" gets "Moi" energy back, not a briefing; someone struggling gets warmth first, prescription second.
- Markdown sparingly: bold for key numbers, short list only when prescribing 2–3 steps. No headings in chat, no sign-off.
- If the conversation is about today's training, stay consistent with the prescribed session (or explicitly justify deviating). Never volunteer the session unprompted.
- Refuse medical / legal / financial advice that requires a licensed pro — give a framework and tell them to see one. Same for clinical mental-health (suicidal ideation, panic disorder, etc.) — name what you see, give one regulation tool, point at a professional.${ventDirective}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Parse the body FIRST (fast, no network) so validation errors return
    // before any context gathering, and tz_offset is in hand for stage 2.
    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const goDeep = body?.go_deep === true;
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Context gather stage 1: EVERYTHING independent, one Promise.all.
    // (Was 9 sequential stages / ~20 round trips — the second-largest
    // latency term after model reasoning.)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayDate = new Date().toISOString().slice(0, 10);
    const [
      profileRes,
      accessRes,
      memoryRes,
      progression,
      nightSignals,
      checkinsRes, briefingRes, athleteRes, programRes, briefRes, reflectionsRes, goalsRes,
      snapshotRes, lessonsRes, habitsRes, journalRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, xp, level, streak, longest_streak, status_tier, is_elite")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.rpc("has_active_access", { _user_id: userId }),
      // Long-term memory — the facts coach-extract-memory has been banking
      // after every chat. This is the read side that makes them count.
      supabase
        .from("coach_chat_memory")
        .select("fact")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      gatherProgression(supabase, userId, { limit: 60 }).catch(() => []),
      gatherNightSignals(supabase, userId).catch(() => ({ hasData: false })),
      supabase
        .from("daily_checkins")
        .select(
          "checked_in_at, xp_earned, workout, sport, cold_shower, healthy_food, protein_intake, hydration_liters, sleep_hours, reading, no_phone_morning, no_phone_evening",
        )
        .eq("user_id", userId)
        .gte("checked_in_at", sevenDaysAgo)
        .order("checked_in_at", { ascending: true }),
      supabase
        .from("weekly_briefings")
        .select("key_insights")
        .eq("user_id", userId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("coach_athlete_profile").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("coach_programs").select("*").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("coach_daily_briefs").select("payload").eq("user_id", userId).eq("brief_date", todayDate).maybeSingle(),
      supabase
        .from("coach_reflections")
        .select("rpe_1to10, energy_1to5, sleep_quality_1to5, mood_1to5, win, friction, reflection_date")
        .eq("user_id", userId)
        .order("reflection_date", { ascending: false })
        .limit(7),
      supabase
        .from("coach_goals")
        .select("title, metric, unit, baseline_value, current_value, target_value, deadline")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(5),
      // Whealth OS: the nightly-computed index — how the coach "knows
      // everything" in ~120 tokens.
      supabase
        .from("coach_performance_snapshots")
        .select("snapshot_date, performance_score, components")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // What they've STUDIED (reference, never re-teach).
      supabase
        .from("vault_lesson_progress")
        .select("quiz_score, vault_articles(title, category_id)")
        .eq("user_id", userId)
        .limit(60),
      // Per-habit maturity (streaks/levels).
      supabase
        .from("user_habits")
        .select("protocol_id, current_streak, best_streak, level")
        .eq("user_id", userId)
        .is("archived_at", null),
      // Recent journal lines — the member's own words.
      supabase
        .from("daily_checkins")
        .select("checked_in_at, journal_entry, verified_at")
        .eq("user_id", userId)
        .gte("checked_in_at", new Date(Date.now() - 30 * 86400_000).toISOString())
        .order("checked_in_at", { ascending: false })
        .limit(30),
    ]);

    const profile = profileRes.data;

    // Membership gate (active subscription OR within 7-day trial).
    // The Coach is part of the paid app, not an Elite-only perk.
    if (accessRes.error || !accessRes.data) {
      return new Response(JSON.stringify({ error: "Active membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-user daily cap before the (expensive) GPT-5 call. Paid members get a
    // generous limit; trial users get much less (abuse is almost always fresh
    // trial accounts). Atomic Postgres counter — survives isolate churn.
    const isPaid = profile?.is_elite === true;
    const dailyLimit = isPaid ? 200 : 40;
    const { data: allowed } = await supabase.rpc("bump_ai_usage", { p_limit: dailyLimit, p_kind: "coach" });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "You've reached today's Coach limit. It resets at midnight UTC." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const faqContext = body?.faq_context && typeof body.faq_context === "object"
      ? { question: String(body.faq_context.question ?? "").slice(0, 300), answer: String(body.faq_context.answer ?? "").slice(0, 2000) }
      : null;
    // Pre-chat mood snapshot — optional; falls back to latest reflection in buildSystemPrompt.
    const moodTodayRaw = body?.mood_today;
    const moodToday: TodayMood | undefined = moodTodayRaw && typeof moodTodayRaw === "object"
      ? {
          energy: typeof moodTodayRaw.energy === "number" && moodTodayRaw.energy >= 1 && moodTodayRaw.energy <= 5
            ? moodTodayRaw.energy : null,
          mood: typeof moodTodayRaw.mood === "number" && moodTodayRaw.mood >= 1 && moodTodayRaw.mood <= 5
            ? moodTodayRaw.mood : null,
        }
      : undefined;

    const trimmed = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));

    // ── Stage 2: the only two gathers with stage-1 dependencies
    // (situation needs profile.streak; program logs need the program id).
    const program: any = programRes.data ?? null;
    let todaySession: any = null;
    if (program?.plan_json?.weeks) {
      const started = new Date(program.started_on);
      const now = new Date();
      const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime()) / 86400_000));
      const weekIdx = Math.min(program.weeks ?? 1, Math.floor(diffDays / 7) + 1);
      const dayIdx = (now.getDay() + 6) % 7;
      const wk = program.plan_json.weeks.find((w: any) => w.week === weekIdx);
      todaySession = wk?.days?.[dayIdx] ?? null;
    }

    const tzOffset = typeof body?.tz_offset === "number" ? body.tz_offset : undefined;
    const [situation, logsRes] = await Promise.all([
      gatherSituation(supabase, userId, {
        tzOffsetMinutes: tzOffset,
        streak: profile?.streak ?? null,
      }).catch(() => null),
      program?.plan_json?.weeks
        ? supabase
            .from("coach_program_logs")
            .select("week, day_index, completed, perceived_rpe, logged_at")
            .eq("user_id", userId)
            .eq("program_id", program.id)
            .order("logged_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const recentLogs = (logsRes as any).data ?? [];
    const situationBlock = situation ? buildSituationBlock(situation) : "";

    // Pull the latest user message for vent-detection heuristic.
    const latestUserMessage = [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";

    const progressionBlock = buildProgressionBlock(progression);
    const causalBlock = buildCausalBlock(nightSignals as any);
    const workoutLogBlock = [progressionBlock, causalBlock].filter(Boolean).map((b) => `\n\n${b}`).join("");

    // Long-term memory block — injected right after the athlete file so the
    // coach actually KNOWS the athlete across sessions.
    const memoryFacts = (memoryRes.data ?? []).map((m: any) => String(m.fact)).filter(Boolean);
    const memoryBlock = memoryFacts.length
      ? `\n\nWHAT YOU KNOW ABOUT THIS ATHLETE (long-term memory from past conversations — weave in naturally when relevant, never recite as a list, never say "according to my memory"):\n${memoryFacts.map((f) => `- ${f}`).join("\n")}`
      : "";

    // ── Whealth OS blocks — the full-data awareness layer ──────────────────
    const snap: any = snapshotRes?.data ?? null;
    const snapComp = snap?.components ?? {};
    let whealthBlock = "";
    if (snap && snapComp?.pillars) {
      const p = snapComp.pillars as Record<string, number | null>;
      const pillarLine = ["sleep", "recovery", "movement", "nutrition", "mind", "inner"]
        .map((k) => `${k} ${p[k] == null ? "–" : p[k]}`)
        .join(" · ");
      const patternLines = Array.isArray(snapComp.patterns)
        ? snapComp.patterns.slice(0, 3).map((x: any) =>
            `- ${x.metric}: ${x.avgA}${x.unit} ${x.aLabel} vs ${x.avgB}${x.unit} ${x.bLabel} (n=${x.nA}/${x.nB})`)
        : [];
      whealthBlock = `\n\nWHEALTH INDEX (computed nightly from ALL their data, as of ${snap.snapshot_date}): overall ${snap.performance_score}/100 — ${pillarLine}.` +
        (snapComp.focus ? `\nCurrent 7-day focus: ${snapComp.focus}` : "") +
        (patternLines.length ? `\nTheir own measured patterns:\n${patternLines.join("\n")}` : "") +
        `\nUse the weakest pillar and these patterns to aim your coaching; cite a number only when it sharpens the point.`;
    }

    const lessons = (lessonsRes?.data ?? []) as Array<{ quiz_score: number | null; vault_articles: { title: string; category_id: string } | null }>;
    let studiedBlock = "";
    if (lessons.length) {
      const byCat = new Map<string, number>();
      for (const l of lessons) {
        const cat = l.vault_articles?.category_id ?? "other";
        byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
      }
      const weak = lessons
        .filter((l) => l.quiz_score != null && l.quiz_score < 67 && l.vault_articles?.title)
        .slice(0, 2)
        .map((l) => l.vault_articles!.title);
      studiedBlock = `\n\nSTUDIED IN THE VAULT (${lessons.length} lessons: ${[...byCat.entries()].map(([c, n]) => `${c} ${n}`).join(", ")}) — build on what they know, never re-teach it.` +
        (weak.length ? ` Shaky on: ${weak.join("; ")} — reinforce when relevant.` : "");
    }

    const habitRows = (habitsRes?.data ?? []) as Array<{ protocol_id: string; current_streak: number | null; best_streak: number | null; level: number | null }>;
    const habitsBlock = habitRows.length
      ? `\n\nHABIT TRACK (their chosen protocols): ${habitRows
          .map((h) => `${h.protocol_id} ${h.current_streak ?? 0}d (best ${h.best_streak ?? 0}, Lv${h.level ?? 1})`)
          .join(" · ")}`
      : "";

    const journalRows = (journalRes?.data ?? []) as Array<{ checked_in_at: string; journal_entry: string | null; verified_at: string | null }>;
    const journalLines = journalRows
      .filter((j) => j.journal_entry && j.journal_entry.trim().length > 0)
      .slice(0, 3)
      .map((j) => `- ${j.checked_in_at.slice(5, 10)}: "${j.journal_entry!.trim().slice(0, 120)}"`);
    const verifiedDays = journalRows.filter((j) => j.verified_at != null).length;
    const journalBlock =
      (journalLines.length
        ? `\n\nTHEIR OWN JOURNAL LINES (private — mirror their language, never quote back verbatim):\n${journalLines.join("\n")}`
        : "") +
      (journalRows.length
        ? `\nDiscipline verification: ${verifiedDays} of last ${journalRows.length} check-in days HealthKit-verified.`
        : "");

    // ── Assemble. Data blocks live under ONE preamble that subordinates
    // their per-block directives to the conversation register — six blocks
    // each demanding output was exactly what made every reply a briefing.
    const light = isLightMessage(latestUserMessage, goDeep);
    const faqBlock = faqContext
      ? `\n\nThe user just read the Playbook answer to: "${faqContext.question}". Do NOT repeat that answer. Go deeper, address their follow-up directly, or apply it to their specific context.`
      : "";
    const dataBlocks = memoryBlock + whealthBlock + studiedBlock + habitsBlock + journalBlock + workoutLogBlock + faqBlock;
    const knowledgeBlocks = dataBlocks.trim()
      ? `\n━━ YOUR KNOWLEDGE OF THIS ATHLETE ━━
Everything below is what you KNOW — it is not your outline. Per reply, pull at most 1–2 elements that genuinely serve the message and ignore the rest. In small talk and greetings, use none of it (knowing ≠ reciting). Any per-block instruction below is subordinate to the CONVERSATION REGISTER.${dataBlocks}`
      : "";

    const systemPrompt = buildSystemPrompt(
      profile,
      athleteRes.data ?? null,
      (checkinsRes.data ?? []) as Checkin[],
      (briefingRes.data?.key_insights as any[]) ?? null,
      (briefRes.data?.payload as any) ?? null,
      todaySession,
      reflectionsRes.data ?? [],
      goalsRes.data ?? [],
      recentLogs,
      moodToday,
      latestUserMessage,
      situationBlock,
      memoryBlock,
      knowledgeBlocks,
      light,
    );
    console.log("ai-coach", light ? "light" : "full", "sys≈", Math.round(systemPrompt.length / 4), "tok");

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Premium coach = the model is the product. gpt-5 for quality, with a
        // fast/cheap fallback so a transient upstream hiccup (rate limit /
        // timeout / 5xx) auto-recovers instead of surfacing an error.
        model: "openai/gpt-5",
        models: ["openai/gpt-5", "google/gemini-3-flash-preview"],
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...trimmed],
        // Reasoning tokens stream BEFORE any visible content, so effort is
        // the dominant time-to-first-word term. "low" keeps gpt-5 sharp for
        // chat coaching; Go Deep buys real thinking time.
        reasoning: { effort: goDeep ? "medium" : "low" },
        // Style comes from the prompt; these are guardrails. verbosity is a
        // gpt-5 param — OpenRouter drops unsupported params on the fallback
        // model. max_tokens is a runaway backstop (includes reasoning tokens;
        // effort-low reasoning is small, 1500 still fits a full session).
        verbosity: goDeep ? "medium" : "low",
        max_tokens: goDeep ? 4000 : 1500,
      }),
      // Hard deadline so a hung upstream never leaves the user on an
      // infinite spinner (client shows the failed bubble + retry).
      signal: AbortSignal.timeout(55_000),
    });

    if (!upstream.ok) {
      // Surface the actual OpenRouter response body to the client so the
      // user can diagnose without dashboard access. Generic "AI gateway
      // error" copy hid the real cause through multiple debug rounds.
      const upstreamBody = await upstream.text().catch(() => "<unreadable>");
      console.error("OpenRouter error:", upstream.status, upstreamBody);

      let friendly = "AI gateway error";
      if (upstream.status === 429) friendly = "Rate limit exceeded. Try again in a moment.";
      else if (upstream.status === 402) friendly = "OpenRouter credits exhausted. Top up at openrouter.ai/credits.";
      else if (upstream.status === 401) friendly = "OpenRouter API key invalid. Reset OPENROUTER_API_KEY secret and redeploy.";
      else if (upstream.status === 400) friendly = "OpenRouter rejected the request (model name or payload). See upstream below.";
      else if (upstream.status === 404) friendly = "OpenRouter model not found. Check the model id in the edge function.";

      return new Response(
        JSON.stringify({
          error: friendly,
          upstream_status: upstream.status,
          upstream_body: upstreamBody.slice(0, 1200),
        }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
