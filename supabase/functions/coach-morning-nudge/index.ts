// Coach Morning Nudge — runs daily 07:00 UTC via pg_cron
// Generates short proactive AI message for each Elite user with a checkin yesterday
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gatherSituation, buildSituationBlock } from "../_shared/situation.ts";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Internal-only: cron invokes with the service-role key. Without this, ANY
// project JWT (incl. the anon key in the app bundle) could trigger a full
// LLM + push blast over every Elite user.
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

// Deliver the morning nudge at 07:00 in the user's local time. Cron fires this
// hourly; we skip any user for whom it isn't 07:00 locally right now. NULL tz
// (hasn't opened the updated app yet) falls back to UTC so they still get one.
const NUDGE_LOCAL_HOUR = 7;

function localHour(tz: string | null): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz || "UTC",
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    ) % 24;
  } catch {
    // Bad/unknown tz string → treat as UTC.
    return new Date().getUTCHours();
  }
}

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
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token, SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
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
    .select("user_id, username, status_tier, level, streak, timezone")
    // Paid members OR live membership credits (referral rewards + pilot
    // codes) — pilot testers should wake up to the same nudge.
    .or(`is_elite.eq.true,membership_credits_until.gt.${new Date().toISOString()}`);

  if (usersErr) {
    return new Response(JSON.stringify({ error: usersErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = { processed: 0, skipped: 0, errors: 0, generated: 0 };

  for (const profile of eliteUsers ?? []) {
    // Only nudge users for whom it's ~07:00 local right now.
    if (localHour((profile as any).timezone ?? null) !== NUDGE_LOCAL_HOUR) {
      results.skipped++;
      continue;
    }
    results.processed++;

    try {
      // Skip if a daily-slot nudge already exists today. limit(1)+array (NOT
      // maybeSingle): once duplicates exist, maybeSingle returns a PGRST116
      // error with data=null, which read as "no nudge" and spammed more pushes.
      const { data: existingRows, error: dedupErr } = await supabase
        .from("coach_nudges")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("kind", "daily")
        .gte("created_at", todayStartISO)
        .limit(1);

      if (dedupErr || (existingRows?.length ?? 0) > 0) {
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

      // Cross-domain situation (tribe event today, live battle, rank) — best-effort.
      const situation = await gatherSituation(supabase, profile.user_id, { streak: profile.streak ?? null }).catch(() => null);
      const situationBlock = situation ? buildSituationBlock(situation) : "";
      const fullContext = situationBlock ? `${userContext}\n\n${situationBlock}` : userContext;

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
              content: `You are AI Coach. Generate today's morning nudge based on yesterday's data.
Rules:
- Reply in user's language (detect from journal; default English).
- Direct, no clichés. Reference yesterday's data specifically.
- If a "wider situation" block is present (tribe event today, live battle, leaderboard rank, streak at risk), you MAY hook the nudge to the most motivating one — rally before a tribe event, fire them up to win a battle, protect a streak. Pick at most one; never list them.
- Prescribe ONE concrete action for today (sets/reps/minutes/specific habit).
- Max 2 sentences. No greetings.
- You are an AI coach. Never claim or imply you are human; if the user asks, say
  so plainly. (This replaces a "never mention you are an AI" rule that
  contradicted _shared/coach-persona.ts and the app's AI-transparency stance.)`,
            },
            { role: "user", content: fullContext },
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

      // kind='daily' + the unique (user, kind, day) index = race-proof dedup:
      // a concurrent coach-proactive morning insert loses cleanly here.
      const { error: insertErr } = await supabase.from("coach_nudges").insert({
        user_id: profile.user_id,
        headline: parsed.headline,
        content: parsed.content,
        kind: "daily",
      });

      if (insertErr) {
        // unique_violation = the other engine already nudged today — not an error.
        if ((insertErr as any).code !== "23505") {
          console.error(`Insert error for ${profile.user_id}:`, insertErr);
          results.errors++;
        } else {
          results.skipped++;
        }
        continue;
      }

      results.generated++;

      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, platform")
        .eq("user_id", profile.user_id);

      if (tokens && tokens.length > 0) {
        const pushResults = await sendApnsBatch(tokens, {
          title: `AI Coach: ${parsed.headline}`,
          body: parsed.content,
          data: { route: "/coach" },
        });
        const sent = pushResults.filter((r) => r.status === 200).length;
        const dead = pushResults
          .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
          .map((r) => r.token);
        if (dead.length > 0) {
          await supabase.from("push_tokens").delete().in("token", dead);
        }
        console.log(`Nudge push for ${profile.user_id}: sent=${sent}/${pushResults.length}, cleaned=${dead.length}`);
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
