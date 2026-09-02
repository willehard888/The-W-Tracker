import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";
import { getPushTargets } from "../_shared/push-targets.ts";

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

// Constant-time string compare — `===` short-circuits on the first differing
// byte, which leaks timing information about the expected HMAC.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  // During secret rotation Stripe sends MULTIPLE v1= signatures (old + new).
  // The old reduce kept only the LAST one, so rotation broke verification and
  // paid checkouts silently stopped granting access. Collect them all.
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of sigHeader.split(",")) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;
    if (key.trim() === "t") timestamp = value;
    if (key.trim() === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Reject requests older than 5 minutes. Number.isFinite guards a non-numeric
  // timestamp: parseInt → NaN, and `NaN > 300` is false, which would fall
  // through the freshness check open.
  const now = Math.floor(Date.now() / 1000);
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

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

  return signatures.some((s) => timingSafeEqual(expectedSig, s));
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

    // Dedup: Stripe retries deliveries for days; a retried
    // checkout.session.completed re-ran the referral conversion, notification
    // and analytics side effects. Fail-open on ledger errors.
    if (event.id) {
      const { error: dupErr } = await supabase.from("webhook_events").insert({
        event_id: event.id,
        source: "stripe",
        event_ts: Number(event.created ?? 0) * 1000,
      });
      if (dupErr) {
        if ((dupErr as { code?: string }).code === "23505") {
          console.log(`Duplicate delivery of ${event.id} — acknowledged, not reprocessed`);
          return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
            status: 200,
            headers: jsonHeaders,
          });
        }
        console.warn("webhook_events insert failed (continuing):", dupErr.message);
      }
    }

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
          const { data: refData, error: refErr } = await supabase.rpc("reward_referral_conversion", { p_user: uid });
          if (refErr) console.warn("reward_referral_conversion failed:", refErr.message);
          // Parity with the iOS webhook: push + funnel event for web
          // conversions too (these were silently invisible before).
          try {
            const referrerId = (refData as any)?.referrer_id;
            if ((refData as any)?.success && referrerId) {
              const paid = Number((refData as any)?.paid_count ?? 0);
              const gotMonth = Array.isArray((refData as any)?.rewards) && (refData as any).rewards.includes("free_month");
              const toNext = 3 - (paid % 3);
              const tokens = await getPushTargets(supabase, [referrerId], "social");
              if (tokens.length > 0) {
                const results = await sendApnsBatch(tokens, gotMonth
                  ? { title: "+1 free month unlocked! 🎁", body: "Your recruit went Premium — 30 days of free membership added.", data: { route: "/referrals" }, threadId: "social" }
                  : { title: "Your recruit went Premium 💎", body: `+500 XP. ${toNext} more paid friend${toNext === 1 ? "" : "s"} until your next free month.`, data: { route: "/referrals" }, threadId: "social" });
                const dead = results.filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered").map((r) => r.token);
                if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
              }
              await supabase.from("notifications").insert({
                user_id: referrerId,
                kind: "referral_converted",
                title: gotMonth ? "+1 free month unlocked! 🎁" : "Your recruit went Premium 💎",
                body: gotMonth ? "30 days of free membership added." : `${toNext} more paid friend${toNext === 1 ? "" : "s"} until your next free month.`,
                route: "/referrals",
                actor_id: uid,
              });
              await supabase.from("analytics_events").insert({
                user_id: referrerId,
                event: "referral_converted",
                props: { referred_id: uid, paid_count: paid, source: "stripe" },
              });
            }
          } catch (e) {
            console.warn("stripe referral notify failed:", e);
          }

          // Server-truth purchase event (the webhook is the ledger; the client
          // event only fires if the browser survives the redirect round-trip).
          const { error: evErr } = await supabase.from("analytics_events").insert({
            user_id: uid,
            event: "purchase_completed",
            props: { source: "stripe_webhook", tier },
          });
          if (evErr) console.warn("purchase analytics insert failed:", evErr.message);
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
