// Daily AI Trainer Brief — generates a short, signed, context-aware brief
// from the W Coach. Cached per user per day in coach_daily_briefs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const today = new Date().toISOString().slice(0, 10);

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
      sb.from("profiles").select("username, status_tier, streak, longest_streak, level, xp").eq("user_id", uid).maybeSingle(),
      sb.from("coach_athlete_profile" as any).select("*").eq("user_id", uid).maybeSingle(),
      sb.from("coach_programs").select("*").eq("user_id", uid).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("daily_checkins").select("checked_in_at, sleep_hours, hydration_liters, workout, protein_intake, healthy_food, xp_earned").eq("user_id", uid).gte("checked_in_at", sevenAgo).order("checked_in_at", { ascending: false }).limit(7),
    ]);

    const profile = profileRes.data ?? {};
    const athlete: any = athleteRes.data ?? {};
    const program: any = programRes.data ?? null;
    const checkins = checkinsRes.data ?? [];

    // Compute today's program day
    let todaySession: any = null;
    let weekIdx = 1;
    let dayIdx = 0;
    if (program?.plan_json?.weeks) {
      const started = new Date(program.started_on);
      const now = new Date();
      const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime()) / 86400_000));
      weekIdx = Math.min(program.weeks ?? 1, Math.floor(diffDays / 7) + 1);
      dayIdx = (now.getDay() + 6) % 7;
      const wk = program.plan_json.weeks.find((w: any) => w.week === weekIdx);
      todaySession = wk?.days?.[dayIdx] ?? null;
    }

    const last = checkins[0];
    const lastSleep = last?.sleep_hours ?? null;
    const avgSleep = checkins.length
      ? (checkins.reduce((s: number, c: any) => s + Number(c.sleep_hours ?? 0), 0) / checkins.length).toFixed(1)
      : null;
    const workouts7 = checkins.filter((c: any) => c.workout).length;

    const firstName = (athlete?.i_am || profile.username || "").split(" ")[0] || "there";
    const tone = TONE_LINE[athlete?.tone_pref ?? "calm_mentor"] ?? TONE_LINE.calm_mentor;
    const lang = athlete?.language_pref ?? "en";

    const sessionLine = todaySession
      ? `${todaySession.focus} · ${todaySession.duration_min ?? "?"} min · ${todaySession.blocks?.length ?? 0} blocks${todaySession.blocks?.[0]?.name ? ` (lead: ${todaySession.blocks[0].name})` : ""}`
      : "No session prescribed today.";

    const systemPrompt = `You are W Coach — the user's personal performance trainer inside the W app. You speak DIRECTLY to them, like a world-class private coach who knows their week, their body, and their goal.

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
Recent: avg sleep ${avgSleep ?? "?"}h (last night ${lastSleep ?? "?"}h), ${workouts7}/7 workouts.

Write the daily brief — 2-3 sentences, second person, signed off as "— W Coach".
Reference ONE concrete recent stat and ONE adjustment to today's session if warranted.
End with a single clear action for the next 24h.

Also produce:
- ribbon: ≤10 words ("Week N · Goal · status")
- prescriptions: 3 short label/value pairs (sleep target, protein target, today's intent — fitted to the user)
- suggested_questions: 3 sharp questions the user might ask, tailored to today.`;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });

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
        brief_md: aiData?.choices?.[0]?.message?.content ?? "Today: show up. Lock the basics. — W Coach",
        prescriptions: [],
        suggested_questions: [],
      };
    }

    payload.session_focus = todaySession?.focus ?? null;
    payload.week = weekIdx;
    payload.day_index = dayIdx;

    await sb.rpc("upsert_daily_brief" as any, { _payload: payload });

    return json({ brief: payload, cached: false });
  } catch (e) {
    console.error("coach-daily-brief", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
