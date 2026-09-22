import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PREMIUM_PRODUCT_IDS } from "../_shared/products.ts";
import { sendApnsBatch } from "../_shared/apns.ts";
import { getPushTargets } from "../_shared/push-targets.ts";
import { activeProducts, decideEntitlement, planTransfer, type LedgerRow, type ProductKind } from "../_shared/rc-entitlement.ts";

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

    // PRODUCT_CHANGE names the product being left in product_id and the one
    // chosen in new_product_id; the ledger and the flags follow the choice.
    const productId: string | undefined = event.new_product_id ?? event.product_id;
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

    const isUserId = (id: unknown): id is string =>
      typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const kindOf = (id: string): ProductKind =>
      APEX_PRODUCT_IDS.includes(id) ? "apex" : PREMIUM_PRODUCT_IDS.includes(id) ? "premium" : "unknown";
    const ledgerOf = async (ids: string[]): Promise<LedgerRow[]> => {
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("webhook_events")
        .select("product_id, event_ts, expires_at")
        .eq("source", "revenuecat")
        .in("app_user_id", ids)
        .order("event_ts", { ascending: false })
        .limit(50);
      return (data ?? []).map((r: { product_id: string | null; event_ts: number; expires_at: string | null }) => ({
        product_id: r.product_id,
        event_ts: Number(r.event_ts),
        expires_at_ms: r.expires_at ? Date.parse(r.expires_at) : null,
      }));
    };

    // A TRANSFER is the one event with no app_user_id: a subscription moved
    // between accounts (a restore on a second Apple ID). The function used to
    // answer 400 here, so RevenueCat retried for hours and the account the
    // subscription LEFT stayed Premium forever.
    if (event.type === "TRANSFER") {
      const from = (Array.isArray(event.transferred_from) ? event.transferred_from : []).filter(isUserId);
      const to = (Array.isArray(event.transferred_to) ? event.transferred_to : []).filter(isUserId);
      const sourceRows = await ledgerOf(from);
      const sourceWasActive = activeProducts(sourceRows, Date.now()).length > 0;
      const plan = planTransfer(from, to, sourceWasActive, isUserId);
      for (const id of plan.revoke) {
        await supabase.from("profiles").update({ is_elite: false, is_premium: false, is_apex_subscriber: false }).eq("user_id", id);
      }
      for (const id of plan.grant) {
        await supabase.from("profiles").update({ is_elite: true, is_premium: true }).eq("user_id", id);
      }
      // The ledger follows the subscription, so the next EXPIRATION is decided
      // against the account that now holds it.
      if (plan.ledgerTo && from.length > 0) {
        await supabase.from("webhook_events").update({ app_user_id: plan.ledgerTo }).eq("source", "revenuecat").in("app_user_id", from);
      }
      console.log("RevenueCat TRANSFER", JSON.stringify({ from, to, sourceWasActive, plan }));
      return new Response(JSON.stringify({ ok: true, transfer: plan }), { status: 200, headers: jsonHeaders });
    }

    const appUserId = event.app_user_id;
    if (!appUserId) {
      return new Response(JSON.stringify({ error: "No app_user_id" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // Sandbox purchases move entitlements exactly like money does. App Review
    // always buys in the sandbox: when sandbox events were dropped for anyone
    // but admins, a reviewer's purchase never unlocked the app and 1.0 would
    // have been rejected under guideline 2.1. The cost is that a TestFlight
    // tester can give themselves Premium for free, but a sandbox subscription
    // stops renewing on its own within days and its EXPIRATION revokes it.
    // The environment is still recorded on the ledger and the analytics row,
    // so sandbox never counts as revenue.
    const environment: string = event.environment ?? "PRODUCTION";
    if (environment !== "PRODUCTION") console.log(`RevenueCat: ${environment} event ${event.type} for ${appUserId}`);

    // Dedup + ordering guard. RevenueCat retries failed deliveries for hours
    // and makes no ordering promise: an EXPIRATION followed by a retried
    // older RENEWAL left is_elite = true forever. Every event id is recorded;
    // a duplicate is acknowledged without reprocessing, and an event older
    // than the newest one processed for this user must not mutate
    // entitlements. Fail-open on ledger errors — payments must never break
    // because bookkeeping did.
    const eventId: string | undefined = event.id;
    const eventTs = Number(event.event_timestamp_ms ?? 0);
    // The member's recent events, not just the newest timestamp: the decision
    // below asks "does this member still hold another product?".
    const rows = await ledgerOf([appUserId]);
    const decision = decideEntitlement(
      {
        type: String(event.type ?? ""),
        productId: productId ?? null,
        kind: productId ? kindOf(productId) : isApexProduct ? "apex" : "premium",
        eventTs,
        expirationAtMs: Number(event.expiration_at_ms ?? 0) || null,
        gracePeriodExpirationAtMs: Number(event.grace_period_expiration_at_ms ?? 0) || null,
        cancelReason: typeof event.cancel_reason === "string" ? event.cancel_reason : null,
      },
      rows,
      Date.now(),
      kindOf,
    );
    let staleEvent = decision.reason === "stale";
    if (eventId) {
      const { error: dedupErr } = await supabase.from("webhook_events").insert({
        event_id: eventId,
        source: "revenuecat",
        app_user_id: appUserId,
        event_ts: eventTs,
        event_type: String(event.type ?? ""),
        product_id: productId ?? null,
        environment,
        expires_at: decision.expiresAtMs ? new Date(decision.expiresAtMs).toISOString() : null,
      });
      if (dedupErr) {
        if ((dedupErr as { code?: string }).code === "23505") {
          console.log(`Duplicate delivery of event ${eventId} — acknowledged, not reprocessed`);
          return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
            status: 200,
            headers: jsonHeaders,
          });
        }
        console.warn("webhook_events insert failed (continuing):", dedupErr.message);
      }
    }

    // What this event does to the flags is decided in one tested place
    // (_shared/rc-entitlement.ts), from the event AND the member's ledger:
    // which product is expiring, whether another is still live, whether a
    // cancellation is a refund, and whether the event arrived out of order.
    const patch = decision.patch;
    const isElite = patch ? patch.is_elite ?? null : null;

    // The free trial is Apple's (a two-week introductory offer): the funnel's
    // trial events come from here now, not from Home. An INITIAL_PURCHASE in
    // period_type TRIAL is `trial_started`; a paid start is `purchase_completed`;
    // the first RENEWAL after a trial is the conversion (Apple charged); an
    // EXPIRATION in period_type TRIAL is `trial_expired` (never converted).
    // admin_metrics_overview and founder-digest read these names unchanged.
    const inTrial = String(event.period_type ?? "").toUpperCase() === "TRIAL";
    // The first RENEWAL of a product whose only earlier ledger row is its
    // INITIAL_PURCHASE is the trial converting — the first time Apple charged.
    const firstRenewal = async (): Promise<boolean> => {
      if (event.type !== "RENEWAL" || !productId) return false;
      const { data } = await supabase
        .from("webhook_events")
        .select("event_type")
        .eq("source", "revenuecat")
        .eq("app_user_id", appUserId)
        .eq("product_id", productId)
        .neq("event_id", eventId ?? "")
        .in("event_type", ["INITIAL_PURCHASE", "RENEWAL"]);
      const types = (data ?? []).map((r: { event_type: string }) => r.event_type);
      return types.includes("INITIAL_PURCHASE") && !types.includes("RENEWAL");
    };
    const funnelEvent =
      event.type === "INITIAL_PURCHASE" && patch?.is_elite === true ? (inTrial ? "trial_started" : "purchase_completed")
      : event.type === "RENEWAL" && patch?.is_elite === true && !inTrial && (await firstRenewal()) ? "purchase_completed"
      : event.type === "EXPIRATION" && inTrial ? "trial_expired"
      : null;
    if (funnelEvent) {
      // Server-truth funnel event — the client-side purchase_completed only
      // fires when the app is foregrounded through the whole flow; the webhook
      // is the ledger.
      const { error: evErr } = await supabase.from("analytics_events").insert({
        user_id: appUserId,
        event: funnelEvent,
        props: { source: "revenuecat_webhook", store: event.store ?? null, product_id: productId ?? null, environment, period_type: event.period_type ?? null },
      });
      if (evErr) console.warn("funnel analytics insert failed:", evErr.message);
    }

    if (event.type === "CANCELLATION") {
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
      // A voluntary cancellation keeps access to the end of the period, so the
      // decision's patch is null and there is nothing to write. A REFUND is a
      // cancellation too, and its patch revokes: fall through for that one.
      if (!patch) {
        return new Response(JSON.stringify({ success: true, action: "recorded" }), {
          status: 200,
          headers: jsonHeaders,
        });
      }
    }

    if (staleEvent) {
      console.log(`Stale event ${eventId} (ts ${eventTs}) — recorded, entitlements unchanged`);
      return new Response(JSON.stringify({ ok: true, skipped: "stale" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (patch) {
      const update: Record<string, any> = { ...patch };
      if (patch.is_apex_subscriber === true) update.apex_subscription_started_at = new Date().toISOString();
      console.log(`RevenueCat decision: ${decision.reason}`, JSON.stringify(update));

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(update)
        .eq("user_id", appUserId)
        .select("user_id");

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
      // Zero matched rows is not success: an anonymous or stale app_user_id
      // means the customer was charged and nothing was granted. Fail loudly
      // so RevenueCat retries and the log shows it.
      if (!updated || updated.length === 0) {
        console.error(`No profile row for app_user_id ${appUserId} — entitlement not applied`, update);
        return new Response(
          JSON.stringify({ error: "No profile for app_user_id" }),
          { status: 500, headers: jsonHeaders },
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
              const tokens = await getPushTargets(supabase, [referrerId], "social");
              if (tokens.length > 0) {
                const results = await sendApnsBatch(tokens, gotMonth
                  ? {
                      title: "+1 free month unlocked",
                      body: `@${(who as any)?.username ?? "A friend"} went Premium — 30 days of free membership added.`,
                      data: { route: "/referrals" },
                      threadId: "social",
                    }
                  : {
                      title: "Your recruit went Premium",
                      body: `@${(who as any)?.username ?? "A friend"} converted (+500 XP). ${toNext} more paid friend${toNext === 1 ? "" : "s"} until your next free month.`,
                      data: { route: "/referrals" },
                      threadId: "social",
                    }, { supabase, kind: "referral_converted" });
                void results;
              }
              // Track for the virality funnel (service role bypasses RLS).
              await supabase.from("notifications").insert({
                user_id: referrerId,
                kind: "referral_converted",
                title: gotMonth ? "+1 free month unlocked" : "Your recruit went Premium",
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
