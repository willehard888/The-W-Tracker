import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tier × Plan → Stripe price ID map
const PRICE_IDS = {
  elite: {
    monthly: "price_1TOyJsBm4ZLIG9fvj0SVO7T5",        // 4.99€/mo Member (entry paywall)
    yearly:  "price_1TPdy3Bm4ZLIG9fv3ycnctke",        // 49.99€/yr Member yearly
  },
  apex: {
    monthly: "price_1TOvvEBm4ZLIG9fvG3mE1Whe",        // 17.99€/mo Apex Instant
    yearly:  "price_1TPdyPBm4ZLIG9fv1hGRAQ7X",        // 172.99€/yr Apex Instant yearly
  },
} as const;

type Tier = keyof typeof PRICE_IDS;
type Plan = "monthly" | "yearly";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    let tier: Tier = "elite";
    let plan: Plan = "monthly";
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.tier === "apex" || body?.tier === "elite") tier = body.tier;
      if (body?.plan === "yearly" || body?.plan === "monthly") plan = body.plan;
    } catch (_) { /* no body */ }

    const priceId = PRICE_IDS[tier][plan];

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata: { tier, plan, user_id: user.id },
      // Also stamp the user id onto the subscription so revoke events
      // (customer.subscription.deleted/updated) can resolve the user reliably.
      subscription_data: { metadata: { tier, plan, user_id: user.id } },
      success_url: `${req.headers.get("origin")}/profile?checkout=success`,
      cancel_url: `${req.headers.get("origin")}/paywall`,
    });

    return new Response(JSON.stringify({ url: session.url, tier, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("create-checkout error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
