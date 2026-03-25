import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook authorization
    const authHeader = req.headers.get("Authorization");
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error("Unauthorized webhook request");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const event = body.event;

    if (!event) {
      return new Response(JSON.stringify({ error: "No event in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`RevenueCat webhook: ${event.type}`, JSON.stringify({
      app_user_id: event.app_user_id,
      type: event.type,
      product_id: event.product_id,
    }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const appUserId = event.app_user_id;
    if (!appUserId) {
      return new Response(JSON.stringify({ error: "No app_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine if user should have elite access based on event type
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
      // For expiration/billing issues, check if entitlement is truly gone
      isElite = false;
    } else if (event.type === "CANCELLATION") {
      // Cancellation doesn't revoke immediately - user keeps access until period ends
      console.log("Cancellation received - user keeps access until expiration");
      return new Response(JSON.stringify({ success: true, action: "none" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isElite !== null) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_elite: isElite })
        .eq("user_id", appUserId);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update profile" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Updated user ${appUserId} is_elite=${isElite}`);
    }

    return new Response(
      JSON.stringify({ success: true, is_elite: isElite }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
