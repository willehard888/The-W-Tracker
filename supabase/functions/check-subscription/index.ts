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

serve(async (req) => {
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
    const withDeadline = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
        ),
      ]);

    const customers = await withDeadline(
      stripe.customers.list({ email: userEmail, limit: 1 }),
      9000,
      "stripe.customers.list",
    );

    if (customers.data.length === 0) {
      await serviceClient.from("profiles").update({
        is_elite: false,
        is_apex_subscriber: false,
      }).eq("user_id", userId);
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
        const periodEnd = sub.current_period_end;
        if (periodEnd && typeof periodEnd === "number" && (endTs === null || periodEnd > endTs)) {
          endTs = periodEnd;
        }
      }
      if (endTs) subscriptionEnd = new Date(endTs * 1000).toISOString();

      tier = isApex ? "apex" : isElite ? "elite" : null;
      const hasRecognizedAccess = tier !== null;

      if (!hasRecognizedAccess && matchedPriceIds.size > 0) {
        console.warn("check-subscription: active subscription found with unmapped price ids", [...matchedPriceIds]);
      }

      const update: Record<string, any> = { is_elite: hasRecognizedAccess };
      if (isApex) {
        update.is_apex_subscriber = true;
        if (!subscriptionEnd) update.apex_subscription_started_at = new Date().toISOString();
      } else {
        update.is_apex_subscriber = false;
      }
      await serviceClient.from("profiles").update(update).eq("user_id", userId);
      // Re-evaluate status tier (may promote to apex via guard rail)
      if (isApex) {
        await serviceClient.rpc("update_status_tier", { target_user_id: userId });
      }
    } else {
      await serviceClient.from("profiles").update({
        is_elite: false,
        is_apex_subscriber: false,
      }).eq("user_id", userId);
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
