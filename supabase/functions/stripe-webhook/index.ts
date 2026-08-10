import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Webhooks are server-to-server — no CORS headers needed.
const jsonHeaders = { "Content-Type": "application/json" };

// Resolve the Supabase user id. The GoTrue admin API has NO getUserByEmail
// (the previous code called a non-existent method → every webhook 500'd and no
// Stripe purchase ever granted access). Prefer the user_id we stamp into the
// checkout/subscription metadata; fall back to scanning listUsers by email.
// deno-lint-ignore no-explicit-any
async function resolveUserId(admin: any, opts: { userId?: string; email?: string }): Promise<string | null> {
  if (opts.userId) return opts.userId;
  const email = opts.email?.toLowerCase();
  if (!email) return null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u: any) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const signature = parts["v1"];

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === signature;
}

Deno.serve(async (req) => {
  // Stripe doesn't send OPTIONS — reject non-POST immediately.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const body = await req.text();
    const sigHeader = req.headers.get("stripe-signature");

    if (!sigHeader) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const isValid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error("Invalid Stripe signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const event = JSON.parse(body);
    console.log("Stripe event:", event.type);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // Only grant on a genuinely paid checkout.
      if (session.payment_status && session.payment_status !== "paid") {
        console.warn("Checkout not paid, skipping:", session.id, session.payment_status);
      } else {
        const uid = await resolveUserId(supabase, {
          userId: session.metadata?.user_id,
          email: session.customer_email || session.customer_details?.email,
        });
        if (!uid) {
          console.warn("No user resolved for checkout session:", session.id);
        } else {
          // Grant the FULL entitlement set (mirrors check-subscription). The old
          // `{ is_elite: true }`-only write left Apex buyers under-provisioned
          // and is_premium (the Vault gate) unset for everyone.
          const tier = session.metadata?.tier === "apex" ? "apex" : "elite";
          const { error } = await supabase
            .from("profiles")
            .update({
              is_elite: true,
              is_premium: true,
              ...(tier === "apex" ? { is_apex_subscriber: true } : {}),
            })
            .eq("user_id", uid);
          if (error) console.error("Failed to update profile:", error);
          else console.log(`${tier} activated for ${uid}`);

          // Web conversions must reward the referrer too — this was only wired
          // into the RevenueCat (iOS) webhook, silently stiffing web referrals.
          const { error: refErr } = await supabase.rpc("reward_referral_conversion", { p_user: uid });
          if (refErr) console.warn("reward_referral_conversion failed:", refErr.message);
        }
      }
    }

    if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      // Grace period: past_due means Stripe is still retrying the card — do NOT
      // revoke yet (matches the deliberate RevenueCat BILLING_ISSUE policy).
      // Revoke on genuinely terminal states only.
      const stillEntitled =
        subscription.status === "active" ||
        subscription.status === "trialing" ||
        subscription.status === "past_due";

      if (!stillEntitled) {
        const uid = await resolveUserId(supabase, {
          userId: subscription.metadata?.user_id,
          email: subscription.metadata?.email,
        });
        if (uid) {
          // Revoke the FULL set — `is_elite`-only left is_premium/apex true
          // forever, i.e. cancellers kept Vault + Apex free permanently.
          await supabase
            .from("profiles")
            .update({ is_elite: false, is_premium: false, is_apex_subscriber: false })
            .eq("user_id", uid);
          console.log(`Membership deactivated for ${uid} (${subscription.status})`);
        } else {
          console.warn("No user resolved for subscription:", subscription.id);
        }
      }
    }

    // Dunning signal — payment failed but the sub is in grace. Recorded as an
    // analytics event so churn/dunning becomes measurable (and later, a push).
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const uid = await resolveUserId(supabase, {
        userId: invoice.subscription_details?.metadata?.user_id ?? invoice.metadata?.user_id,
        email: invoice.customer_email,
      });
      if (uid) {
        await supabase.from("analytics_events").insert({
          user_id: uid,
          event: "payment_failed",
          props: { invoice_id: invoice.id, attempt: invoice.attempt_count ?? null },
        });
        console.log(`payment_failed recorded for ${uid}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
