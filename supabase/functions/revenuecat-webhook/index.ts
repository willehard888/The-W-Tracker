import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";

// Webhooks are server-to-server — no CORS headers needed.
const jsonHeaders = { "Content-Type": "application/json" };

// Constant-time string compare (the bearer secret is static; avoid leaking
// length/prefix via early-exit ===). Same primitive stripe-webhook uses.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

// Premium replaces Apex purchase. Apex IDs kept as legacy fallback.
const PREMIUM_PRODUCT_IDS = [
  // Current product (4.99 €/mo, App Store Connect / RevenueCat)
  "WhealthFactory499", "com.app.WhealthFactory499",
  // Legacy
  "premiummonthly1799", "com.app.premiummonthly1799",
  "premiumyearly17299", "com.app.premiumyearly17299",
];
const APEX_PRODUCT_IDS = ["Apex888", "com.app.Apex888", "apexmonthly1599", "com.app.apexmonthly1599", "apexyearly17299", "com.app.apexyearly17299"];
const APEX_ENTITLEMENT = "apex_subscriber";
// Must match the RevenueCat entitlement the client checks (RevenueCatContext
// ENTITLEMENT = "The W Tracker Pro"). "premium" kept as a legacy alias.
const PREMIUM_ENTITLEMENT = "The W Tracker Pro";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

    // Fail CLOSED: without a configured secret we cannot trust any payload.
    // A missing secret previously meant "skip auth", which let anyone forge
    // events and grant themselves Premium/Apex. Reject until it is set.
    if (!webhookSecret) {
      console.error("REVENUECAT_WEBHOOK_SECRET is not configured — rejecting webhook");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${webhookSecret}`)) {
      console.error("Unauthorized webhook request");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const body = await req.json();
    const event = body.event;

    if (!event) {
      return new Response(JSON.stringify({ error: "No event in payload" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // SECURITY: sandbox purchases fire the same authentic INITIAL_PURCHASE /
    // RENEWAL webhooks as production but cost nothing (a free Apple sandbox
    // account, or a StoreKit-hooked device, buys the €4.99 product for €0 and
    // it "renews" every few minutes). Never grant a real entitlement from a
    // sandbox event. DEBUG_ALLOW_SANDBOX lets our own TestFlight testing opt in.
    if (event.environment && event.environment !== "PRODUCTION"
        && Deno.env.get("DEBUG_ALLOW_SANDBOX") !== "true") {
      console.log(`RevenueCat: ignoring ${event.environment} event ${event.type}`);
      return new Response(JSON.stringify({ ok: true, skipped: "non-production" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const productId: string | undefined = event.product_id;
    const entitlementIds: string[] = Array.isArray(event.entitlement_ids)
      ? event.entitlement_ids
      : [];
    const isApexProduct =
      (productId && APEX_PRODUCT_IDS.includes(productId)) ||
      entitlementIds.includes(APEX_ENTITLEMENT);
    const isPremiumProduct =
      (productId && PREMIUM_PRODUCT_IDS.includes(productId)) ||
      entitlementIds.includes(PREMIUM_ENTITLEMENT) ||
      entitlementIds.includes("premium") || // legacy alias
      // Legacy Apex purchases also grant Premium content access.
      isApexProduct;

    console.log(`RevenueCat webhook: ${event.type}`, JSON.stringify({
      app_user_id: event.app_user_id,
      type: event.type,
      product_id: productId,
      isApexProduct,
      isPremiumProduct,
    }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const appUserId = event.app_user_id;
    if (!appUserId) {
      return new Response(JSON.stringify({ error: "No app_user_id" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const grantEvents = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "NON_RENEWING_PURCHASE",
      "SUBSCRIPTION_EXTENDED",
      "PRODUCT_CHANGE",
    ];

    // NOTE: BILLING_ISSUE is intentionally NOT here. With a billing grace period
    // enabled, a failed charge must NOT revoke access — the entitlement stays
    // active while Apple retries. Revoking on BILLING_ISSUE would defeat the
    // grace period. Access is only revoked on EXPIRATION (fires after the grace
    // period ends without a successful renewal).
    const revokeEvents = [
      "EXPIRATION",
      "SUBSCRIPTION_PAUSED",
    ];

    let isElite: boolean | null = null;

    if (grantEvents.includes(event.type)) {
      isElite = true;
      // Server-truth purchase event — the client-side purchase_completed only
      // fires when the app is foregrounded through the whole flow; the webhook
      // is the ledger. INITIAL_PURCHASE only (renewals aren't conversions).
      if (event.type === "INITIAL_PURCHASE") {
        const { error: evErr } = await supabase.from("analytics_events").insert({
          user_id: appUserId,
          event: "purchase_completed",
          props: { source: "revenuecat_webhook", store: event.store ?? null, product_id: productId ?? null },
        });
        if (evErr) console.warn("purchase analytics insert failed:", evErr.message);
      }
    } else if (revokeEvents.includes(event.type)) {
      isElite = false;
    } else if (event.type === "CANCELLATION") {
      // Access correctly continues until EXPIRATION — but the signal must be
      // COUNTED. This was a pure no-op before: churn wasn't even measurable
      // (admin metrics read these events).
      console.log("Cancellation received - user keeps access until expiration");
      const { error: evErr } = await supabase.from("analytics_events").insert({
        user_id: appUserId,
        event: "subscription_cancelled",
        props: {
          store: event.store ?? null,
          product_id: event.product_id ?? null,
          period_type: event.period_type ?? null,
        },
      });
      if (evErr) console.warn("cancellation analytics insert failed:", evErr.message);
      return new Response(JSON.stringify({ success: true, action: "recorded" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (isElite !== null) {
      const update: Record<string, any> = { is_elite: isElite };

      // Premium flag mirrors any active subscription (premium or legacy apex).
      if (isPremiumProduct) {
        update.is_premium = isElite;
      } else if (!isElite) {
        update.is_premium = false;
      }

      if (isApexProduct) {
        update.is_apex_subscriber = isElite;
        if (isElite) {
          update.apex_subscription_started_at = new Date().toISOString();
        }
      } else if (!isElite) {
        update.is_apex_subscriber = false;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(update)
        .eq("user_id", appUserId);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update profile" }),
          {
            status: 500,
            headers: jsonHeaders,
          }
        );
      }

      console.log(`Updated user ${appUserId}`, update);

      // If apex was granted, immediately promote tier
      if (isApexProduct && isElite) {
        await supabase.rpc("update_status_tier", { target_user_id: appUserId });
      }

      // On successful paid activation, fire referral conversion reward (idempotent)
      if (isElite === true) {
        const { data: rewardData, error: rewardError } = await supabase.rpc(
          "reward_referral_conversion",
          { p_user: appUserId },
        );
        if (rewardError) {
          console.warn("reward_referral_conversion error:", rewardError);
        } else {
          console.log("Referral conversion result:", rewardData);
          // Close the loop — tell the referrer their recruit converted (+ how close
          // they are to the next reward). Best-effort.
          const referrerId = (rewardData as any)?.referrer_id;
          if ((rewardData as any)?.success && referrerId) {
            try {
              const { data: who } = await supabase
                .from("profiles").select("username").eq("user_id", appUserId).maybeSingle();
              const paid = Number((rewardData as any)?.paid_count ?? 0);
              // Engine v2: every 3 paid friends = 1 free month (no cap).
              const gotMonth = Array.isArray((rewardData as any)?.rewards) && (rewardData as any).rewards.includes("free_month");
              const toNext = 3 - (paid % 3);
              const { data: tokens } = await supabase
                .from("push_tokens").select("token, platform").eq("user_id", referrerId);
              if (tokens && tokens.length > 0) {
                const results = await sendApnsBatch(tokens as any, gotMonth
                  ? {
                      title: "+1 free month unlocked! 🎁",
                      body: `@${(who as any)?.username ?? "A friend"} went Premium — 30 days of free membership added.`,
                      data: { route: "/referrals" },
                    }
                  : {
                      title: "Your recruit went Premium 💎",
                      body: `@${(who as any)?.username ?? "A friend"} converted (+500 XP). ${toNext} more paid friend${toNext === 1 ? "" : "s"} until your next free month.`,
                      data: { route: "/referrals" },
                    });
                const dead = results.filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered").map((r) => r.token);
                if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
              }
              // Track for the virality funnel (service role bypasses RLS).
              await supabase.from("notifications").insert({
                user_id: referrerId,
                kind: "referral_converted",
                title: gotMonth ? "+1 free month unlocked! 🎁" : "Your recruit went Premium 💎",
                body: gotMonth ? "30 days of free membership added." : `${toNext} more paid friend${toNext === 1 ? "" : "s"} until your next free month.`,
                route: "/referrals",
                actor_id: appUserId,
              });
              await supabase.from("analytics_events").insert({
                user_id: referrerId,
                event: "referral_converted",
                props: { referred_id: appUserId, paid_count: paid },
              });
            } catch (e) {
              console.error("referral conversion notify failed:", e);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, is_elite: isElite, apex: isApexProduct }),
      {
        status: 200,
        headers: jsonHeaders,
      }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
