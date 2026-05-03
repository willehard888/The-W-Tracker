// AI Coach edge function — Elite-only, streaming chat using Lovable AI Gateway (GPT-5)
// Now with 7-day stats memory + latest briefing insights injected into system prompt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const TONE_LINES: Record<string, string> = {
  drill_sergeant: "Tone: drill sergeant — clipped, demanding, zero excuses, never cruel.",
  calm_mentor: "Tone: calm mentor — measured, warm, surgical. Like a wise senior coach.",
  scientist: "Tone: scientist — precise, evidence-flavoured, references numbers cleanly.",
  hype: "Tone: high-energy hype — punchy, alive, charged. Never cheesy.",
};

const buildSystemPrompt = (
  profile: any,
  athlete: any,
  checkins7d: Checkin[],
  briefingInsights: any[] | null,
  todayBrief: any | null,
  todaySession: any | null,
) => {
  const tier = profile?.status_tier ?? "recruit";
  const streak = profile?.streak ?? 0;
  const longest = profile?.longest_streak ?? 0;
  const username = profile?.username ?? "operator";
  const firstName = (athlete?.i_am || username).split(" ")[0];
  const tone = TONE_LINES[athlete?.tone_pref ?? "calm_mentor"] ?? TONE_LINES.calm_mentor;

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

  return `You are W Coach — ${firstName}'s personal performance trainer inside the W app. You speak directly to them as their trainer. They pay for you. Earn that.

${tone}
Reply language: match the user's input. Default ${athlete?.language_pref ?? "en"}.

Athlete:
- Name: ${firstName} (handle: ${username})
- Goal: ${athlete?.primary_goal ?? "general performance"}${athlete?.secondary_goal ? ` + ${athlete.secondary_goal}` : ""} (horizon ${athlete?.target_horizon_weeks ?? "?"} weeks)
- Age/Sex: ${athlete?.age ?? "?"} / ${athlete?.sex ?? "?"} · Height ${athlete?.height_cm ?? "?"}cm · Weight ${athlete?.weight_kg ?? "?"}kg
- Equipment: ${(athlete?.equipment ?? []).join(", ") || "unknown"}
- Injuries: ${(athlete?.injuries ?? []).join(", ") || "none reported"}
- Dietary: ${(athlete?.dietary ?? []).join(", ") || "none"}
- No-go protocols: ${(athlete?.no_go_protocols ?? []).join(", ") || "none"}
- Preferred session length: ${athlete?.preferred_session_length_min ?? 45} min
- Tier: ${tier} · Streak ${streak}d (longest ${longest})

Recent activity:
${recentSummary}${insightsBlock}${briefBlock}${sessionBlock}

Style:
- 3-5 sentences max unless the user explicitly asks for depth.
- Direct, knowledgeable, calm. No motivational clichés. No "as an AI".
- Name the relevant gap. Prescribe the next 24h.
- Use markdown sparingly (bold for key numbers, short lists when prescribing 2-3 steps).
- Reference at most ONE concrete stat from their recent activity, only if it sharpens the answer.
- End with a single, specific next action.
- Refuse medical/legal/financial advice that requires a licensed pro — give a framework and suggest seeing one.
- Never break character. Never name your model or that you are AI.`;
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
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
    const [checkinsRes, briefingRes, athleteRes, programRes, briefRes] = await Promise.all([
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
    ]);

    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const faqContext = body?.faq_context && typeof body.faq_context === "object"
      ? { question: String(body.faq_context.question ?? "").slice(0, 300), answer: String(body.faq_context.answer ?? "").slice(0, 2000) }
      : null;
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

    // Compute today's prescribed session
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

    const systemPrompt = buildSystemPrompt(
      profile,
      athleteRes.data ?? null,
      (checkinsRes.data ?? []) as Checkin[],
      (briefingRes.data?.key_insights as any[]) ?? null,
      (briefRes.data?.payload as any) ?? null,
      todaySession,
    ) + (faqContext
      ? `\n\nThe user just read the Playbook answer to: "${faqContext.question}". Do NOT repeat that answer. Go deeper, address their follow-up directly, or apply it to their specific context.`
      : "");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...trimmed],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await upstream.text();
      console.error("AI gateway error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
