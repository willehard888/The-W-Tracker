import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APEX_PRICE_ID = "price_1TOvbkBm4ZLIG9fvoppvTJ7D";
const ELITE_PRICE_ID = "price_1TFEFvBm4ZLIG9fvnzdsqL6m";

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

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
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;
    let tier: "apex" | "elite" | null = null;

    if (hasActiveSub) {
      // Find the highest tier
      let isApex = false;
      let isElite = false;
      let endTs: number | null = null;
      for (const sub of subscriptions.data) {
        const priceId = sub.items.data[0]?.price?.id;
        if (priceId === APEX_PRICE_ID) isApex = true;
        else if (priceId === ELITE_PRICE_ID) isElite = true;
        const periodEnd = sub.current_period_end;
        if (periodEnd && typeof periodEnd === "number" && (endTs === null || periodEnd > endTs)) {
          endTs = periodEnd;
        }
      }
      if (endTs) subscriptionEnd = new Date(endTs * 1000).toISOString();

      tier = isApex ? "apex" : isElite ? "elite" : null;

      const update: Record<string, any> = { is_elite: tier !== null };
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
      subscribed: hasActiveSub,
      tier,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("check-subscription error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
