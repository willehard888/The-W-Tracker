import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Webhooks are server-to-server — no CORS headers needed.
const jsonHeaders = { "Content-Type": "application/json" };

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

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
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

    const revokeEvents = [
      "EXPIRATION",
      "BILLING_ISSUE",
      "SUBSCRIPTION_PAUSED",
    ];

    let isElite: boolean | null = null;

    if (grantEvents.includes(event.type)) {
      isElite = true;
    } else if (revokeEvents.includes(event.type)) {
      isElite = false;
    } else if (event.type === "CANCELLATION") {
      console.log("Cancellation received - user keeps access until expiration");
      return new Response(JSON.stringify({ success: true, action: "none" }), {
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
