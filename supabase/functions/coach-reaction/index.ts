// Coach Reaction — a SHORT personalized response right after check-in.
//
// The post-check-in coach line was a deterministic template ("Logged. {focus} —
// protect it tomorrow.") — generic at the single highest-emotion moment in the
// daily loop. This returns 1–2 sentences in the user's chosen tone, referencing
// TODAY's actual numbers (XP, tasks, streak, sleep) and — sparingly — their
// authored "why". Fast/cheap model; the client falls back to the template on
// any failure, so this can never break the celebration screen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SHARED_HABIT_BY_KEY, isBonusHabit } from "../_shared/checkin-habits.ts";
import { gatherHabitGaps } from "../_shared/habit-gaps.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TONE_HINT: Record<string, string> = {
  drill_sergeant: "Blunt, commanding, zero fluff. Short sentences.",
  calm_mentor: "Steady, warm, precise. No hype.",
  scientist: "Concrete numbers, mechanisms, cause→effect.",
  hype: "High energy, momentum language — but never cheesy.",
};

const reactionTool = {
  type: "function",
  function: {
    name: "emit_reaction",
    description: "Emit the coach's post-check-in reaction.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "1-2 sentences, max ~160 chars. Reference today's ACTUAL numbers. No greetings, no emoji spam (max 1), never mention being an AI.",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Membership gate (coach feature) — client silently falls back to the
    // deterministic template on 403, so free users lose nothing they had.
    const { data: hasAccess } = await supabase.rpc("has_active_access", { _user_id: user.id });
    if (hasAccess !== true) return json({ error: "Active membership required" }, 403);

    if (!OPENROUTER_API_KEY) return json({ error: "not_configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const xp = Number(body?.xp_earned) || 0;
    const tasksDone = Number(body?.tasks_done) || 0;
    const tasksTotal = Number(body?.tasks_total) || 0;
    const streak = Number(body?.streak) || 0;
    const sleepH = body?.sleep_hours != null ? Number(body.sleep_hours) : null;
    const workout = body?.workout === true;

    // TODAY's per-habit result, sent by the client (the submit-time prefetch
    // fires BEFORE record_checkin lands, so today's row isn't in the DB yet).
    // Whitelisted against the catalog — client strings never reach the prompt.
    const validKeys = (v: unknown): string[] =>
      (Array.isArray(v) ? v : [])
        .slice(0, 30)
        .map((k) => String(k))
        .filter((k) => !!SHARED_HABIT_BY_KEY[k]);
    const label = (k: string) => SHARED_HABIT_BY_KEY[k].label;
    const doneKeys = validKeys(body?.done_keys);
    const missedKeys = validKeys(body?.missed_keys);
    const isSick = body?.sick === true;
    // Bonus habits (second session, sauna…) are optional extras: a skipped
    // one is NOT a miss, a done one is worth a nod.
    const doneToday = doneKeys.filter((k) => !isBonusHabit(k)).map(label);
    const missedToday = missedKeys.filter((k) => !isBonusHabit(k)).map(label);
    const bonusDone = doneKeys.filter(isBonusHabit).map(label);

    // Athlete context + habit history in parallel. The gaps read excludes
    // nothing explicitly, but at prefetch time today's row simply isn't
    // there yet — history is what we want from it anyway.
    const [{ data: athlete }, gaps] = await Promise.all([
      supabase
        .from("coach_athlete_profile")
        .select("tone_pref, i_am, language_pref")
        .eq("user_id", user.id)
        .maybeSingle(),
      gatherHabitGaps(supabase, user.id, { days: 14 }).catch(() => null),
    ]);

    const tone = TONE_HINT[athlete?.tone_pref ?? "calm_mentor"] ?? TONE_HINT.calm_mentor;
    const why = (athlete?.i_am ?? "").toString().slice(0, 160);
    const lang = (athlete?.language_pref ?? "").toString();

    // 14-day neglect signal from history (today's row may not be in yet).
    const neglected = (gaps?.rates ?? [])
      .filter((r) => r.doneDays / Math.max(1, gaps!.checkinDays) < 0.3)
      .map((r) => `${r.label} ${r.doneDays}/${gaps!.checkinDays}`)
      .slice(0, 5);

    const facts = [
      isSick ? "⚠️ THE USER IS SICK TODAY (self-reported)." : null,
      `XP earned today: ${xp}`,
      tasksTotal > 0 ? `Habits completed: ${tasksDone}/${tasksTotal}` : null,
      doneToday.length ? `DONE today: ${doneToday.join(", ")}` : null,
      missedToday.length ? `MISSED today: ${missedToday.join(", ")}` : null,
      bonusDone.length ? `BONUS extras done today (optional — worth a nod): ${bonusDone.join(", ")}` : null,
      neglected.length ? `Habitually neglected (last ${gaps!.checkinDays} logged days): ${neglected.join(", ")}` : null,
      gaps?.unchosen?.length ? `Not in their habit set yet: ${gaps.unchosen.slice(0, 3).join(", ")}` : null,
      `Current streak: ${streak} days`,
      sleepH != null ? `Sleep last night: ${sleepH}h` : null,
      `Trained today: ${workout ? "yes" : "no"}`,
      why ? `Their WHY (who they're becoming): "${why}"` : null,
    ].filter(Boolean).join("\n");

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are AI Coach reacting the moment your athlete logs their day. Voice: ${tone}
Rules:
- 1-2 sentences, max ~160 characters total.
- React to TODAY's actual facts (pick the single most meaningful one — don't list them).
- NEVER advise improving anything in the DONE list — it's already handled today; that reads as not paying attention.
- If suggesting improvement, aim at a MISSED or habitually neglected habit (pick ONE). If nothing was missed, spark curiosity about ONE habit not in their set yet.
- Bonus extras (second session, sauna) are optional: celebrate if done, NEVER frame them as a gap, "falling behind", or something to fix.
- SICK DAY: if the facts say the user is sick, do NOT push training, cold exposure or any missed habit — praise them for logging while ill and give ONE recovery-promoting cue (rest, fluids, extra sleep).
- If a WHY is provided you MAY tie the day to it — only when it lands naturally, never as a canned tagline.
- ${lang ? `Reply in this language: ${lang}.` : "Reply in the user's likely language (default English)."}
- No greetings. Never mention being an AI.`,
          },
          { role: "user", content: facts },
        ],
        tools: [reactionTool],
        tool_choice: { type: "function", function: { name: "emit_reaction" } },
      }),
    });

    if (!aiResp.ok) {
      console.error("coach-reaction upstream:", aiResp.status, await aiResp.text().catch(() => ""));
      return json({ error: "upstream" }, 502);
    }
    const aiData = await aiResp.json();
    const args = aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "no_output" }, 502);

    let text = "";
    try { text = String(JSON.parse(args)?.text ?? ""); } catch { /* fall through */ }
    if (!text.trim()) return json({ error: "no_output" }, 502);

    return json({ text: text.trim().slice(0, 220) });
  } catch (e) {
    console.error("coach-reaction error:", e);
    return json({ error: "server_error" }, 500);
  }
});
