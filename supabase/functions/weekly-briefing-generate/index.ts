// Weekly Briefing Generator — runs Sundays via pg_cron
// Generates AI-powered weekly summary for each Elite user with ≥3 checkins this week
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Checkin {
  checked_in_at: string;
  xp_earned: number;
  workout: boolean;
  extra_workout: boolean;
  cold_shower: boolean;
  healthy_food: boolean;
  protein_intake: boolean;
  hydration_liters: number;
  sleep_hours: number;
  reading: boolean;
  no_phone_morning: boolean;
  no_phone_evening: boolean;
  meditation_morning: boolean;
  meditation_evening: boolean;
  journal_entry: string | null;
}

const briefingTool = {
  type: "function",
  function: {
    name: "emit_briefing",
    description: "Emit the weekly briefing as structured data.",
    parameters: {
      type: "object",
      properties: {
        headline: {
          type: "string",
          description: "One short, punchy sentence summarizing the week. Max 80 chars.",
        },
        key_insights: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              icon: { type: "string", enum: ["trend", "warning", "win", "pattern"] },
              title: { type: "string", description: "Short headline (max 50 chars)" },
              detail: { type: "string", description: "1-2 concrete sentences with numbers" },
            },
            required: ["icon", "title", "detail"],
            additionalProperties: false,
          },
        },
        next_week_protocol: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              action: { type: "string", description: "Concrete action (max 60 chars)" },
              why: { type: "string", description: "Brief reason rooted in data" },
            },
            required: ["action", "why"],
            additionalProperties: false,
          },
        },
        summary_md: {
          type: "string",
          description: "Full markdown summary, 3-5 short paragraphs. Use the user's language.",
        },
      },
      required: ["headline", "key_insights", "next_week_protocol", "summary_md"],
      additionalProperties: false,
    },
  },
};

function getWeekRange() {
  // Week = last 7 full days ending today (Sunday in UTC)
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  return {
    start,
    end,
    weekStartISO: start.toISOString().slice(0, 10),
    weekEndISO: end.toISOString().slice(0, 10),
  };
}

function computeStats(checkins: Checkin[]) {
  const totalXp = checkins.reduce((s, c) => s + (c.xp_earned ?? 0), 0);
  const days = checkins.length;
  const avgSleep =
    days > 0 ? checkins.reduce((s, c) => s + Number(c.sleep_hours ?? 0), 0) / days : 0;
  const avgHydration =
    days > 0 ? checkins.reduce((s, c) => s + Number(c.hydration_liters ?? 0), 0) / days : 0;
  const workouts = checkins.filter((c) => c.workout).length;
  const coldShowers = checkins.filter((c) => c.cold_shower).length;
  const perfectDays = checkins.filter(
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

  let bestDay: { date: string; xp: number } | null = null;
  let worstDay: { date: string; xp: number } | null = null;
  for (const c of checkins) {
    const date = c.checked_in_at.slice(0, 10);
    const xp = c.xp_earned ?? 0;
    if (!bestDay || xp > bestDay.xp) bestDay = { date, xp };
    if (!worstDay || xp < worstDay.xp) worstDay = { date, xp };
  }

  return {
    total_xp: totalXp,
    days_checked_in: days,
    avg_sleep: Math.round(avgSleep * 10) / 10,
    avg_hydration: Math.round(avgHydration * 10) / 10,
    workouts,
    cold_showers: coldShowers,
    perfect_days: perfectDays,
    best_day: bestDay,
    worst_day: worstDay,
    completion_pct: Math.round((days / 7) * 100),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { weekStartISO, weekEndISO, start, end } = getWeekRange();

  // Fetch all paid members (weekly briefing is a paid-membership feature —
  // gated on is_premium, NOT the earned "elite" status tier).
  const { data: eliteUsers, error: usersErr } = await supabase
    .from("profiles")
    .select("user_id, username, status_tier, level, xp, streak, longest_streak")
    .eq("is_premium", true);

  if (usersErr) {
    console.error("Failed to fetch elite users:", usersErr);
    return new Response(JSON.stringify({ error: usersErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = { processed: 0, skipped: 0, errors: 0, generated: 0 };

  for (const profile of eliteUsers ?? []) {
    results.processed++;

    try {
      // Skip if briefing already exists for this week
      const { data: existing } = await supabase
        .from("weekly_briefings")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("week_start", weekStartISO)
        .maybeSingle();

      if (existing) {
        results.skipped++;
        continue;
      }

      // Fetch the week's checkins
      const startISO = new Date(start).toISOString();
      const endISO = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data: checkins } = await supabase
        .from("daily_checkins")
        .select(
          "checked_in_at, xp_earned, workout, extra_workout, cold_shower, healthy_food, protein_intake, hydration_liters, sleep_hours, reading, no_phone_morning, no_phone_evening, meditation_morning, meditation_evening, journal_entry",
        )
        .eq("user_id", profile.user_id)
        .gte("checked_in_at", startISO)
        .lt("checked_in_at", endISO)
        .order("checked_in_at", { ascending: true });

      if (!checkins || checkins.length < 3) {
        results.skipped++;
        continue;
      }

      const stats = computeStats(checkins as Checkin[]);

      // Build prompt
      const journalSnippets = (checkins as Checkin[])
        .filter((c) => c.journal_entry && c.journal_entry.trim())
        .map(
          (c) =>
            `${c.checked_in_at.slice(0, 10)}: ${(c.journal_entry as string).slice(0, 200)}`,
        )
        .slice(0, 5);

      const userContext = `User: ${profile.username} (tier ${profile.status_tier}, level ${profile.level}, ${profile.xp} XP, ${profile.streak}d streak, longest ${profile.longest_streak}d)

Week: ${weekStartISO} → ${weekEndISO}

Stats:
- Days checked in: ${stats.days_checked_in}/7 (${stats.completion_pct}%)
- Total XP this week: ${stats.total_xp}
- Best day: ${stats.best_day?.date} (${stats.best_day?.xp} XP)
- Worst day: ${stats.worst_day?.date} (${stats.worst_day?.xp} XP)
- Workouts: ${stats.workouts}/7
- Cold showers: ${stats.cold_showers}/7
- Perfect days: ${stats.perfect_days}
- Avg sleep: ${stats.avg_sleep}h
- Avg hydration: ${stats.avg_hydration}L

Daily breakdown:
${(checkins as Checkin[]).map((c) => `${c.checked_in_at.slice(0, 10)}: ${c.xp_earned}XP, sleep ${c.sleep_hours}h, ${c.workout ? "workout✓" : "no workout"}, ${c.cold_shower ? "cold✓" : "no cold"}, hydr ${c.hydration_liters}L`).join("\n")}

${journalSnippets.length > 0 ? `Journal excerpts:\n${journalSnippets.join("\n")}` : ""}`;

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
              content: `You are W Coach. Produce a weekly briefing from the user's data.
Rules:
- Reply in the user's language (detect from journal entries; default English).
- Direct, sharp, no clichés. Use concrete numbers from the data.
- Insights must reference real patterns (e.g., "Sleep dropped Wed–Fri → workout XP -30%").
- Protocol items must be specific actions (sets/reps/minutes), not vague advice.
- Never mention you are an AI or which model you are.`,
            },
            { role: "user", content: userContext },
          ],
          tools: [briefingTool],
          tool_choice: { type: "function", function: { name: "emit_briefing" } },
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error(`AI gateway error for ${profile.user_id}:`, aiResp.status, t);
        results.errors++;
        continue;
      }

      const aiData = await aiResp.json();
      const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error(`No tool call for ${profile.user_id}`);
        results.errors++;
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error(`JSON parse error for ${profile.user_id}:`, e);
        results.errors++;
        continue;
      }

      // Insert briefing
      const { data: inserted, error: insertErr } = await supabase
        .from("weekly_briefings")
        .insert({
          user_id: profile.user_id,
          week_start: weekStartISO,
          week_end: weekEndISO,
          headline: parsed.headline,
          summary_md: parsed.summary_md,
          key_insights: parsed.key_insights,
          next_week_protocol: parsed.next_week_protocol,
          stats_snapshot: stats,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`Insert error for ${profile.user_id}:`, insertErr);
        results.errors++;
        continue;
      }

      results.generated++;

      // Push notification (logged for now — same pattern as notify-message)
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, platform")
        .eq("user_id", profile.user_id);

      if (tokens && tokens.length > 0) {
        const pushResults = await sendApnsBatch(tokens, {
          title: "📊 Your weekly briefing is ready",
          body: parsed.headline ?? "Tap to see your week.",
          data: { route: `/briefing/${inserted.id}` },
        });
        const sent = pushResults.filter((r) => r.status === 200).length;
        const dead = pushResults
          .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
          .map((r) => r.token);
        if (dead.length > 0) {
          await supabase.from("push_tokens").delete().in("token", dead);
        }
        console.log(`Push for ${profile.user_id}: sent=${sent}/${tokens.length}, cleaned=${dead.length}`);
      }
    } catch (e) {
      console.error(`Unexpected error for ${profile.user_id}:`, e);
      results.errors++;
    }
  }

  console.log("Weekly briefing run complete:", results);

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
