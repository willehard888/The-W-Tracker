import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only: the referrals trigger invokes this with the service-role key.
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

// Referral engine v2: every 3 PAID friends = 1 free month (keep in sync with
// src/lib/referral-rewards.ts + reward_referral_conversion).
const CREDIT_EVERY = 3;

// Close the referral loop: when a friend joins with your code, the referrer
// gets a push — that acknowledgement is what makes people invite again (drives
// k-factor). Conversion is already notified inline in revenuecat-webhook; this
// handles the join half.
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
    const { referrer_id, referred_id, kind } = await req.json();
    if (!referrer_id) {
      return new Response(JSON.stringify({ error: "referrer_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, serviceKey);

    // Who joined, and how close is the referrer to their next reward?
    const [{ data: referred }, { count: converted }] = await Promise.all([
      referred_id
        ? supabase.from("profiles").select("username").eq("user_id", referred_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("referrals").select("id", { count: "exact", head: true })
        .eq("referrer_id", referrer_id).eq("converted", true),
    ]);

    const name = (referred as any)?.username ? `@${(referred as any).username}` : "A friend";
    const paid = converted ?? 0;
    const toNext = CREDIT_EVERY - (paid % CREDIT_EVERY);
    const progress = ` ${toNext} paid friend${toNext === 1 ? "" : "s"} until your next free month.`;

    const isActivated = kind === "activated";
    const push = isActivated
      ? {
          title: "Your recruit is locked in 🔥",
          body: `${name} hit 3 check-ins — +250 XP for you.${progress}`,
          data: { route: "/referrals" },
        }
      : {
          title: "New recruit joined 🔥",
          body: `${name} signed up with your code — +50 XP.${progress}`,
          data: { route: "/referrals" },
        };

    const { data: tokens } = await supabase
      .from("push_tokens").select("token, platform").eq("user_id", referrer_id);

    let sent = 0;
    if (tokens && tokens.length > 0) {
      const results = await sendApnsBatch(tokens as any, push);
      sent = results.filter((r) => r.status === 200).length;
      const dead = results
        .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
        .map((r) => r.token);
      if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
    }

    // Track for measurement (service role bypasses RLS). Feeds the virality funnel.
    await supabase.from("analytics_events").insert({
      user_id: referrer_id,
      event: isActivated ? "referral_activated" : "referral_joined",
      props: { referred_id: referred_id ?? null },
    });

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-referral error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
