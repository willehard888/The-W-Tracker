import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_IDS = {
  elite: new Set([
    "price_1TOyJsBm4ZLIG9fvj0SVO7T5",
    "price_1TPdy3Bm4ZLIG9fv3ycnctke",
    "price_1TFEFvBm4ZLIG9fvnzdsqL6m",
  ]),
  apex: new Set([
    "price_1TOvvEBm4ZLIG9fvG3mE1Whe",
    "price_1TPdyPBm4ZLIG9fv1hGRAQ7X",
    "price_1TOvbkBm4ZLIG9fvoppvTJ7D",
  ]),
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !authUser) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userId = authUser.id;
    const userEmail = authUser.email;
    if (!userEmail) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
      timeout: 8000, // ms — never let a single Stripe call hang
      maxNetworkRetries: 1,
    });

    // Wrap any promise with an overall deadline so the edge function
    // can't sit at the 150s idle timeout when Stripe is slow / unreachable.
    function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
      return Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
        ),
      ]);
    }

    const customers = await withDeadline(
      stripe.customers.list({ email: userEmail, limit: 1 }),
      9000,
      "stripe.customers.list",
    );

    if (customers.data.length === 0) {
      // CRIT-1: do NOT wipe entitlements here. "No Stripe customer" is the
      // NORMAL state for every iOS/RevenueCat subscriber — this unconditional
      // clear was revoking Apple-paid memberships every 5 minutes from the web
      // app. Revocation authority lives in the webhooks (stripe-webhook /
      // revenuecat-webhook), each clearing only what it granted.
      return new Response(JSON.stringify({ subscribed: false, tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await withDeadline(
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 5 }),
      9000,
      "stripe.subscriptions.list",
    );

    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;
    let tier: "apex" | "elite" | null = null;

    if (hasActiveSub) {
      // Find the highest tier
      let isApex = false;
      let isElite = false;
      let endTs: number | null = null;
      const matchedPriceIds = new Set<string>();
      for (const sub of subscriptions.data) {
        for (const item of sub.items.data) {
          const priceId = item.price?.id;
          if (!priceId) continue;
          matchedPriceIds.add(priceId);
          if (PRICE_IDS.apex.has(priceId)) isApex = true;
          else if (PRICE_IDS.elite.has(priceId)) isElite = true;
        }
        // M2: on newer Stripe API versions (2025-08-27.basil+) current_period_end
        // moved onto the subscription ITEMS — read both so subscription_end is
        // never silently null.
        const subEnd = (sub as any).current_period_end;
        const itemEnds = sub.items.data
          .map((it: any) => it.current_period_end)
          .filter((v: any): v is number => typeof v === "number");
        const periodEnd = typeof subEnd === "number" ? subEnd : (itemEnds.length ? Math.max(...itemEnds) : null);
        if (periodEnd && (endTs === null || periodEnd > endTs)) {
          endTs = periodEnd;
        }
      }
      if (endTs) subscriptionEnd = new Date(endTs * 1000).toISOString();

      tier = isApex ? "apex" : isElite ? "elite" : null;
      const hasRecognizedAccess = tier !== null;

      if (!hasRecognizedAccess && matchedPriceIds.size > 0) {
        console.warn("check-subscription: active subscription found with unmapped price ids", [...matchedPriceIds]);
      }

      // GRANT-only sync (CRIT-1): this path may add entitlements it sees on
      // Stripe but must never clear flags another provider (RevenueCat) owns.
      const update: Record<string, any> = {};
      if (hasRecognizedAccess) {
        update.is_elite = true;
        // Any active recognized subscription grants Premium (Vault) access.
        update.is_premium = true;
      }
      if (isApex) {
        update.is_apex_subscriber = true;
        // M2 fix: this used to key on subscriptionEnd (which was always null on
        // the new API version) and so RESET Apex tenure on every single call.
        // Only stamp the start when it isn't already set.
        const { data: prof } = await serviceClient
          .from("profiles")
          .select("apex_subscription_started_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (!prof?.apex_subscription_started_at) {
          update.apex_subscription_started_at = new Date().toISOString();
        }
      }
      if (Object.keys(update).length > 0) {
        await serviceClient.from("profiles").update(update).eq("user_id", userId);
      }
      // Re-evaluate status tier (may promote to apex via guard rail)
      if (isApex) {
        await serviceClient.rpc("update_status_tier", { target_user_id: userId });
      }
    } else {
      // CRIT-1: no active STRIPE sub ≠ no membership — the user may be an
      // iOS/RevenueCat subscriber. Never clear flags here; webhooks revoke.
    }

    return new Response(JSON.stringify({
      subscribed: tier !== null,
      tier,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("check-subscription error:", error);
    // Return 200 with a safe default so the client doesn't surface a 5xx
    // every minute when Stripe is slow/unreachable.
    return new Response(JSON.stringify({ subscribed: false, error: String((error as Error)?.message ?? error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
