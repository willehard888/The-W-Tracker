// What a RevenueCat event does to a member's flags, decided from the event and
// the member's own ledger (webhook_events), with no I/O so it can be tested.
//
// Why a ledger and not RevenueCat's REST API: no new secret, no network hop
// inside the webhook, and every rule below has a test. If the ledger ever
// proves too coarse, GET /v1/subscribers/{id} is the upgrade: decide from its
// `entitlements` instead of `activeProducts`.
//
// The rules this replaced decided per EVENT, not per member:
//  - one product's EXPIRATION revoked access while another was still live;
//  - a refund (CANCELLATION + CUSTOMER_SUPPORT) kept access until some later
//    expiry, which Apple does not promise to send promptly;
//  - the unknown-product guard covered grants only, so the expiry of a
//    product the app never sold still revoked membership;
//  - TRANSFER was ignored, so the account a subscription left stayed Premium.

export type ProductKind = "premium" | "apex" | "unknown";

/** One ledger row for the member, any order. `expires_at_ms` null = written before expiries were stored. */
export interface LedgerRow { product_id: string | null; event_ts: number; expires_at_ms: number | null }

export interface RcEvent {
  type: string;
  /** new_product_id ?? product_id */
  productId: string | null;
  /** From the product id and the event's entitlement ids. */
  kind: ProductKind;
  eventTs: number;
  expirationAtMs: number | null;
  gracePeriodExpirationAtMs?: number | null;
  cancelReason?: string | null;
}

export interface Patch { is_elite?: boolean; is_premium?: boolean; is_apex_subscriber?: boolean }
export interface Decision { patch: Patch | null; expiresAtMs: number | null; reason: string }

const GRANTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "PRODUCT_CHANGE"]);
const REVOKES = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

/** Products whose NEWEST ledger row has not expired yet, leaving `except` out. */
export const activeProducts = (rows: LedgerRow[], nowMs: number, except?: string | null): string[] => {
  const newest = new Map<string, LedgerRow>();
  for (const r of rows) {
    if (!r.product_id || r.product_id === except) continue;
    const seen = newest.get(r.product_id);
    if (!seen || r.event_ts > seen.event_ts) newest.set(r.product_id, r);
  }
  return [...newest.values()].filter((r) => (r.expires_at_ms ?? 0) > nowMs).map((r) => r.product_id!);
};

export const decideEntitlement = (
  e: RcEvent,
  rows: LedgerRow[],
  nowMs: number,
  kindOf: (productId: string) => ProductKind,
): Decision => {
  const newestTs = rows.reduce((m, r) => Math.max(m, r.event_ts), 0);
  // RevenueCat retries for hours and promises no order: an older event must
  // never undo what a newer one decided.
  if (e.eventTs > 0 && e.eventTs < newestTs) return { patch: null, expiresAtMs: e.expirationAtMs, reason: "stale" };
  // A product this app does not sell moves nothing, in either direction.
  if (e.productId && e.kind === "unknown") return { patch: null, expiresAtMs: e.expirationAtMs, reason: "unknown_product" };

  if (GRANTS.has(e.type)) {
    const patch: Patch = { is_elite: true, is_premium: true };
    if (e.kind === "apex") patch.is_apex_subscriber = true;
    return { patch, expiresAtMs: e.expirationAtMs, reason: "grant" };
  }

  const refund = e.type === "CANCELLATION" && e.cancelReason === "CUSTOMER_SUPPORT";
  if (e.type === "CANCELLATION" && !refund) return { patch: null, expiresAtMs: e.expirationAtMs, reason: "cancelled_runs_to_expiry" };
  if (e.type === "BILLING_ISSUE") {
    // Apple keeps retrying through the grace period; access holds until EXPIRATION.
    return { patch: null, expiresAtMs: Math.max(e.expirationAtMs ?? 0, e.gracePeriodExpirationAtMs ?? 0) || null, reason: "billing_grace" };
  }
  if (!refund && !REVOKES.has(e.type)) return { patch: null, expiresAtMs: e.expirationAtMs, reason: "ignored" };

  // A revoke. This product is over now (a refund ends it at once, so its row
  // stores no expiry); the member keeps whatever another live product gives.
  const others = activeProducts(rows, nowMs, e.productId);
  const expiresAtMs = refund ? null : e.expirationAtMs;
  if (others.length === 0) return { patch: { is_elite: false, is_premium: false, is_apex_subscriber: false }, expiresAtMs, reason: refund ? "refund" : "revoke" };
  if (e.kind === "apex" && !others.some((p) => kindOf(p) === "apex")) return { patch: { is_apex_subscriber: false }, expiresAtMs, reason: "apex_over_premium_remains" };
  return { patch: null, expiresAtMs, reason: "another_product_active" };
};

export interface TransferPlan { revoke: string[]; grant: string[]; ledgerTo: string | null }

/**
 * TRANSFER: a subscription moved between app users (a restore on a second
 * account). It carries no app_user_id, only the two lists. The source loses
 * its flags; the destination gains them only if the source really had a live
 * product; the ledger follows the subscription. Ids that are not our users
 * (RevenueCat's anonymous ids) are ignored.
 */
export const planTransfer = (from: string[], to: string[], sourceWasActive: boolean, isUserId: (id: string) => boolean): TransferPlan => {
  const src = from.filter(isUserId);
  const dst = to.filter(isUserId).filter((id) => !src.includes(id));
  if (dst.length === 0 && src.length > 0 && to.filter(isUserId).length > 0) return { revoke: [], grant: [], ledgerTo: null }; // moved onto itself
  return { revoke: src, grant: sourceWasActive ? dst : [], ledgerTo: dst[0] ?? null };
};
