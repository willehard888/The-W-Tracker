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
          const { error } = await supabase
            .from("profiles")
            .update({ is_elite: true })
            .eq("user_id", uid);
          if (error) console.error("Failed to update profile:", error);
          else console.log(`Elite activated for ${uid}`);
        }
      }
    }

    if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      const isActive =
        subscription.status === "active" || subscription.status === "trialing";

      if (!isActive) {
        const uid = await resolveUserId(supabase, {
          userId: subscription.metadata?.user_id,
          email: subscription.metadata?.email,
        });
        if (uid) {
          await supabase
            .from("profiles")
            .update({ is_elite: false })
            .eq("user_id", uid);
          console.log(`Elite deactivated for ${uid}`);
        } else {
          console.warn("No user resolved for subscription:", subscription.id);
        }
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
