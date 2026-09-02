import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";
import { getPushTargets } from "../_shared/push-targets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only: cron invokes with the service-role key. Accept an exact env
// match OR any JWT whose role claim is service_role (verify_jwt defaults to true,
// so the signature is already validated) — robust to key rotation / whitespace.
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

// Tiered win-back: the message escalates the longer someone has been gone. Each
// tier fires once (exact-day match in users_lapsed), so a user gets at most one
// of these on days 3, 7, and 14 after their last active day.
const TIERS: Array<{ daysAgo: number; title: string; body: string }> = [
  { daysAgo: 3,  title: "Your streak misses you 🔥",   body: "It's been 3 days. One check-in gets you right back on track." },
  { daysAgo: 7,  title: "The climb continued 🏔️",      body: "Your tribe kept stacking Ws this week. Jump back in — you haven't lost your spot." },
  { daysAgo: 14, title: "Restart everything in 60s ⚡", body: "Two weeks out, but momentum is one check-in away. Come reclaim it." },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token, serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, serviceKey);
    const results: Record<string, number> = {};

    for (const tier of TIERS) {
      const { data: lapsed, error } = await supabase
        .rpc("users_lapsed", { p_days_ago: tier.daysAgo });
      if (error) throw error;

      const userIds = (lapsed || []).map((u: any) => u.user_id);
      if (userIds.length === 0) { results[`d${tier.daysAgo}`] = 0; continue; }

      const tokens = await getPushTargets(supabase, userIds, "winback");

      if (tokens.length === 0) { results[`d${tier.daysAgo}`] = 0; continue; }

      const pushResults = await sendApnsBatch(tokens, {
        title: tier.title,
        body: tier.body,
        data: { route: "/" },
        threadId: "winback",
        // Escalating tiers supersede each other — an unopened d3 banner should
        // be replaced by d7, not stack under it.
        collapseId: "winback",
      });
      const sent = pushResults.filter((r) => r.status === 200).length;
      const dead = pushResults
        .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
        .map((r) => r.token);
      if (dead.length > 0) {
        await supabase.from("push_tokens").delete().in("token", dead);
      }
      results[`d${tier.daysAgo}`] = sent;
      console.log(`Win-back d${tier.daysAgo}: sent=${sent}/${pushResults.length}, cleaned=${dead.length}`);

      // Attribution: without a sent-event, win-back effectiveness is
      // unmeasurable (join winback_sent → next app_opened per user).
      if (userIds.length > 0) {
        const { error: evErr } = await supabase.from("analytics_events").insert(
          userIds.map((uid: string) => ({
            user_id: uid,
            event: "winback_sent",
            props: { tier: `d${tier.daysAgo}` },
          })),
        );
        if (evErr) console.warn("winback analytics insert failed:", evErr.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("winback-lapsed error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
