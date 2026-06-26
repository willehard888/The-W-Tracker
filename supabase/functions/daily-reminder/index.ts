import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get all push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("user_id, token, platform");

    if (tokensError) throw tokensError;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens to notify" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get users who already checked in today
    const { data: checkins } = await supabase
      .from("daily_checkins")
      .select("user_id")
      .gte("checked_in_at", todayStart.toISOString())
      .lte("checked_in_at", todayEnd.toISOString());

    const checkedInUserIds = new Set((checkins || []).map((c: any) => c.user_id));

    // Filter tokens for users who haven't checked in
    const tokensToNotify = tokens.filter((t: any) => !checkedInUserIds.has(t.user_id));

    console.log(`Sending reminders to ${tokensToNotify.length} users (${tokens.length} total tokens, ${checkedInUserIds.size} already checked in)`);

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
