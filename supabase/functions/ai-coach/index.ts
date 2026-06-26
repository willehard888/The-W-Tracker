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
  VENT_DIRECTIVE,
  type TodayMood,
} from "../_shared/coach-persona.ts";
import { gatherSituation, buildSituationBlock } from "../_shared/situation.ts";
import { gatherProgression, buildProgressionBlock } from "../_shared/progression.ts";

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
  return `Last 7d: ${days}/7 check-ins, ${totalXp} XP total, avg sleep ${avgSleep.toFixed(1)}h, avg hydration ${avgHydr.toFixed(1)}L, ${workouts} workouts, ${cold} cold showers, ${perfect} perfect days.
Yesterday: sleep ${last.sleep_hours}h, ${last.workout ? "workout✓" : "no workout"}, ${last.cold_shower ? "cold✓" : "no cold"}, hydration ${last.hydration_liters}L.`;
};

// Voice nuance now lives inside buildPersonaBlock() in ../_shared/coach-persona.ts.

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

  const briefBlock = todayBrief
    ? `\n\nThis morning you (W Coach) wrote them:\n"${todayBrief.brief_md ?? ""}"\nStay consistent with that brief — don't contradict it.`
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

  return `${personaBlock}

${holisticBlock}

Today is ${dayName}, ${today.toISOString().slice(0, 10)}.

Athlete file:
- Handle: ${username} · first name: ${firstName}
- Goal: ${athlete?.primary_goal ?? "general performance"}${athlete?.secondary_goal ? ` + ${athlete.secondary_goal}` : ""} (horizon ${athlete?.target_horizon_weeks ?? "?"} weeks)
- Age / sex: ${athlete?.age ?? "?"} / ${athlete?.sex ?? "?"} · ${athlete?.height_cm ?? "?"}cm · ${athlete?.weight_kg ?? "?"}kg
- Equipment: ${(athlete?.equipment ?? []).join(", ") || "unknown"}
- Injuries: ${(athlete?.injuries ?? []).join(", ") || "none reported"}
- Dietary: ${(athlete?.dietary ?? []).join(", ") || "none"}
- No-go protocols (hard filter, never suggest): ${(athlete?.no_go_protocols ?? []).join(", ") || "none"}
- Preferred session length: ${athlete?.preferred_session_length_min ?? 45} min
- Tier: ${tier} · Streak ${streak}d (longest ${longest})

Recent activity:
${recentSummary}${reflectionsBlock}${goalsBlock}${logsBlock}${insightsBlock}${briefBlock}${sessionBlock}
${situationBlock ? `\n${situationBlock}\n` : ""}
How to reply:
- **Match length to the weight of what they asked.** A vent → mirror first, then ONE question or small move. Quick tactical Q → 2–3 sentences. Deep ask → go deep but structured.
- **One concrete next move** at the end. Dated to today or tomorrow. Specific (movement, breath count, time on the calendar) — never "try to relax".
- Reference at most ONE concrete stat from their data, only if it sharpens the answer.
- Markdown sparingly: bold for key numbers, short list only when prescribing 2–3 steps.
- If today has a prescribed session, stay consistent with it (or explicitly justify deviating).
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, xp, level, streak, longest_streak, status_tier, is_elite")
      .eq("user_id", userId)
      .maybeSingle();

    // Membership gate (active subscription OR within 7-day trial).
    // The Coach is part of the paid app, not an Elite-only perk.
    const { data: hasAccess, error: accessErr } = await supabase.rpc(
      "has_active_access",
      { _user_id: userId },
    );
    if (accessErr || !hasAccess) {
      return new Response(JSON.stringify({ error: "Active membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch context in parallel
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayDate = new Date().toISOString().slice(0, 10);
    const [checkinsRes, briefingRes, athleteRes, programRes, briefRes, reflectionsRes, goalsRes] = await Promise.all([
      supabase
        .from("daily_checkins")
        .select(
          "checked_in_at, xp_earned, workout, cold_shower, healthy_food, protein_intake, hydration_liters, sleep_hours, reading, no_phone_morning, no_phone_evening",
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
        .select("rpe_1to10, energy_1to5, sleep_quality_1to5, mood_1to5, friction, reflection_date")
        .eq("user_id", userId)
        .order("reflection_date", { ascending: false })
        .limit(3),
      supabase
        .from("coach_goals")
        .select("title, metric, unit, baseline_value, current_value, target_value, deadline")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(5),
    ]);

    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const goDeep = body?.go_deep === true;
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
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));

    // Compute today's prescribed session and recent program logs
    const program: any = programRes.data ?? null;
    let todaySession: any = null;
    let recentLogs: any[] = [];
    if (program?.plan_json?.weeks) {
      const started = new Date(program.started_on);
      const now = new Date();
      const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime()) / 86400_000));
      const weekIdx = Math.min(program.weeks ?? 1, Math.floor(diffDays / 7) + 1);
      const dayIdx = (now.getDay() + 6) % 7;
      const wk = program.plan_json.weeks.find((w: any) => w.week === weekIdx);
      todaySession = wk?.days?.[dayIdx] ?? null;

      const { data: logs } = await supabase
        .from("coach_program_logs")
        .select("week, day_index, completed, perceived_rpe, logged_at")
        .eq("user_id", userId)
        .eq("program_id", program.id)
        .order("logged_at", { ascending: false })
        .limit(5);
      recentLogs = logs ?? [];
    }

    // Pull the latest user message for vent-detection heuristic.
    const latestUserMessage = [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";

    // Cross-domain situation (tribe, battles, rank, check-in timing) — best-effort.
    const tzOffset = typeof body?.tz_offset === "number" ? body.tz_offset : undefined;
    const situation = await gatherSituation(supabase, userId, {
      tzOffsetMinutes: tzOffset,
      streak: profile?.streak ?? null,
    }).catch(() => null);
    const situationBlock = situation ? buildSituationBlock(situation) : "";

    // Progression digest (per-lift trajectory, PRs, stalls) → so the coach tracks
    // progress like a real coach and drives the next target. Best-effort.
    const progression = await gatherProgression(supabase, userId).catch(() => []);
    const progressionBlock = buildProgressionBlock(progression);
    const workoutLogBlock = progressionBlock ? `\n\n${progressionBlock}` : "";

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
    ) + workoutLogBlock + (faqContext
      ? `\n\nThe user just read the Playbook answer to: "${faqContext.question}". Do NOT repeat that answer. Go deeper, address their follow-up directly, or apply it to their specific context.`
      : "");

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...trimmed],
        reasoning: { effort: goDeep ? "high" : "medium" },
      }),
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
