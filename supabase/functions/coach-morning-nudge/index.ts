// Coach Morning Nudge — runs daily 07:00 UTC via pg_cron
// Generates short proactive AI message for each Elite user with a checkin yesterday
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const nudgeTool = {
  type: "function",
  function: {
    name: "emit_nudge",
    description: "Emit today's coach nudge.",
    parameters: {
      type: "object",
      properties: {
        headline: {
          type: "string",
          description: "3-6 word headline. Sharp, no cliché.",
        },
        content: {
          type: "string",
          description:
            "1-2 sentences. Reference yesterday's data. Prescribe one concrete action for today.",
        },
      },
      required: ["headline", "content"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Yesterday window in UTC
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(todayStart.getUTCDate() - 1);

  // Skip duplicates: don't send a second nudge today
  const todayStartISO = todayStart.toISOString();

  const { data: eliteUsers, error: usersErr } = await supabase
    .from("profiles")
    .select("user_id, username, status_tier, level, streak")
    .eq("is_elite", true);

  if (usersErr) {
    return new Response(JSON.stringify({ error: usersErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = { processed: 0, skipped: 0, errors: 0, generated: 0 };

  for (const profile of eliteUsers ?? []) {
    results.processed++;

    try {
      // Skip if nudge already exists today
      const { data: existing } = await supabase
        .from("coach_nudges")
        .select("id")
        .eq("user_id", profile.user_id)
        .gte("created_at", todayStartISO)
        .maybeSingle();

      if (existing) {
        results.skipped++;
        continue;
      }

      // Fetch yesterday's checkin
      const { data: checkin } = await supabase
        .from("daily_checkins")
        .select(
          "checked_in_at, xp_earned, workout, cold_shower, healthy_food, protein_intake, hydration_liters, sleep_hours, reading, no_phone_morning, no_phone_evening, journal_entry",
        )
        .eq("user_id", profile.user_id)
        .gte("checked_in_at", yesterdayStart.toISOString())
        .lt("checked_in_at", todayStartISO)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!checkin) {
        results.skipped++;
        continue;
      }

      const userContext = `User: ${profile.username} (${profile.status_tier}, level ${profile.level}, ${profile.streak}d streak)

Yesterday (${(checkin.checked_in_at as string).slice(0, 10)}):
- XP earned: ${checkin.xp_earned}
- Sleep: ${checkin.sleep_hours}h
- Workout: ${checkin.workout ? "yes" : "no"}
- Cold shower: ${checkin.cold_shower ? "yes" : "no"}
- Healthy food: ${checkin.healthy_food ? "yes" : "no"}
- Protein: ${checkin.protein_intake ? "yes" : "no"}
- Hydration: ${checkin.hydration_liters}L
- Reading: ${checkin.reading ? "yes" : "no"}
- No phone (morning/evening): ${checkin.no_phone_morning ? "✓" : "✗"} / ${checkin.no_phone_evening ? "✓" : "✗"}
${checkin.journal_entry ? `- Journal: ${(checkin.journal_entry as string).slice(0, 300)}` : ""}`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are W Coach. Generate today's morning nudge based on yesterday's data.
Rules:
- Reply in user's language (detect from journal; default English).
- Direct, no clichés. Reference yesterday's data specifically.
- Prescribe ONE concrete action for today (sets/reps/minutes/specific habit).
- Max 2 sentences. No greetings.
- Never mention you are an AI.`,
            },
            { role: "user", content: userContext },
          ],
          tools: [nudgeTool],
          tool_choice: { type: "function", function: { name: "emit_nudge" } },
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error(`AI error for ${profile.user_id}:`, aiResp.status, t);
        results.errors++;
        continue;
      }

      const aiData = await aiResp.json();
      const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        results.errors++;
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        results.errors++;
        continue;
      }

      const { error: insertErr } = await supabase.from("coach_nudges").insert({
        user_id: profile.user_id,
        headline: parsed.headline,
        content: parsed.content,
      });

      if (insertErr) {
        console.error(`Insert error for ${profile.user_id}:`, insertErr);
        results.errors++;
        continue;
      }

      results.generated++;

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, platform")
        .eq("user_id", profile.user_id);

      if (tokens && tokens.length > 0) {
        console.log(
          `Nudge push for ${profile.user_id}: title="Coach: ${parsed.headline}", body="${parsed.content.slice(0, 80)}", route=/coach, tokens=${tokens.length}`,
        );
      }
    } catch (e) {
      console.error(`Unexpected error for ${profile.user_id}:`, e);
      results.errors++;
    }
  }

  console.log("Coach nudge run complete:", results);

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
