import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send the streak reminder at 20:00 in the user's OWN local time. The cron
// fires this hourly; users_due_for_streak_reminder returns only the users for
// whom it's currently 20:00 local, have a live streak, and haven't checked in
// on their local calendar day — so each user is nudged exactly once, in their
// evening, with time to still check in before their local midnight.
const REMINDER_LOCAL_HOUR = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // DB decides who's due right now (DST-correct, set-based).
    const { data: dueUsers, error: dueError } = await supabase
      .rpc("users_due_for_streak_reminder", { p_target_hour: REMINDER_LOCAL_HOUR });
    if (dueError) throw dueError;

    const dueUserIds = (dueUsers || []).map((u: any) => u.user_id);
    if (dueUserIds.length === 0) {
      return new Response(JSON.stringify({ message: "No users due this hour" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the push tokens for just those users.
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("user_id, token, platform")
      .in("user_id", dueUserIds);

    if (tokensError) throw tokensError;
    const tokensToNotify = tokens || [];
    if (tokensToNotify.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens for due users" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending local-evening reminders to ${tokensToNotify.length} tokens across ${dueUserIds.length} due users`);

    // Actually deliver via APNs (iOS). sendApnsBatch filters to platform==='ios'.
    const pushResults = await sendApnsBatch(tokensToNotify as any, {
      title: "Don't break the chain 🔥",
      body: "You haven't checked in yet today — lock it in before midnight.",
      data: { route: "/" },
    });
    const sent = pushResults.filter((r) => r.status === 200).length;
    const dead = pushResults
      .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
      .map((r) => r.token);
    if (dead.length > 0) {
      await supabase.from("push_tokens").delete().in("token", dead);
    }
    console.log(`Daily reminder push: sent=${sent}/${pushResults.length}, cleaned=${dead.length}`);

    return new Response(
      JSON.stringify({
        message: `Sent ${sent} reminders`,
        attempted: pushResults.length,
        sent,
        cleaned: dead.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Reminder error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
