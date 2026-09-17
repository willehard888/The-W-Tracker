import { describe, expect, it } from "vitest";
import { activeProducts, decideEntitlement, planTransfer, type LedgerRow, type ProductKind, type RcEvent } from "../../../supabase/functions/_shared/rc-entitlement";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const kindOf = (id: string): ProductKind => (id.startsWith("apex") ? "apex" : id === "tip_jar" ? "unknown" : "premium");
const ev = (type: string, productId: string | null, over: Partial<RcEvent> = {}): RcEvent => ({
  type, productId, kind: productId ? kindOf(productId) : "premium", eventTs: NOW, expirationAtMs: NOW + 30 * DAY, ...over,
});
const row = (product_id: string, event_ts: number, expires_at_ms: number | null): LedgerRow => ({ product_id, event_ts, expires_at_ms });
const decide = (e: RcEvent, rows: LedgerRow[] = []) => decideEntitlement(e, rows, NOW, kindOf);
const ALL_OFF = { is_elite: false, is_premium: false, is_apex_subscriber: false };

describe("decideEntitlement", () => {
  it("a purchase grants and its expiry revokes everything", () => {
    expect(decide(ev("INITIAL_PURCHASE", "monthly")).patch).toEqual({ is_elite: true, is_premium: true });
    expect(decide(ev("EXPIRATION", "monthly"), [row("monthly", NOW - DAY, NOW - 1)]).patch).toEqual(ALL_OFF);
  });

  it("the monthly expiring after a change to yearly keeps access", () => {
    const rows = [row("monthly", NOW - 40 * DAY, NOW - DAY), row("yearly", NOW - DAY, NOW + 364 * DAY)];
    expect(decide(ev("EXPIRATION", "monthly"), rows)).toMatchObject({ patch: null, reason: "another_product_active" });
  });

  it("a legacy yearly in another group holds access until it expires too", () => {
    const rows = [row("eliteyearly", NOW - 10 * DAY, NOW + 300 * DAY), row("monthly", NOW - 30 * DAY, NOW - 1)];
    expect(decide(ev("EXPIRATION", "monthly"), rows).patch).toBeNull();
    expect(decide(ev("EXPIRATION", "eliteyearly"), [row("eliteyearly", NOW - 10 * DAY, NOW - 1), row("monthly", NOW - 30 * DAY, NOW - 2)]).patch).toEqual(ALL_OFF);
  });

  it("another product whose newest row has already expired does not hold access", () => {
    const rows = [row("yearly", NOW - 400 * DAY, NOW + DAY), row("yearly", NOW - 5 * DAY, NOW - DAY)];
    expect(activeProducts(rows, NOW)).toEqual([]);
    expect(decide(ev("EXPIRATION", "monthly"), rows).patch).toEqual(ALL_OFF);
  });

  it("a row from before expiries were stored counts as inactive (the documented ceiling)", () => {
    expect(decide(ev("EXPIRATION", "monthly"), [row("yearly", NOW - DAY, null)]).patch).toEqual(ALL_OFF);
  });

  it("a voluntary cancel keeps access and the product stays active until its expiry", () => {
    const d = decide(ev("CANCELLATION", "monthly", { cancelReason: "UNSUBSCRIBE" }));
    expect(d).toMatchObject({ patch: null, expiresAtMs: NOW + 30 * DAY });
  });

  it("a refund revokes at once, unless another product is live, and a later expiry changes nothing", () => {
    const refund = ev("CANCELLATION", "monthly", { cancelReason: "CUSTOMER_SUPPORT" });
    expect(decide(refund)).toMatchObject({ patch: ALL_OFF, expiresAtMs: null, reason: "refund" });
    expect(decide(refund, [row("yearly", NOW - DAY, NOW + 300 * DAY)]).patch).toBeNull();
    expect(decide(ev("EXPIRATION", "monthly"), [row("monthly", NOW - 1, null)]).patch).toEqual(ALL_OFF);
  });

  it("a billing issue holds access through the grace period", () => {
    const d = decide(ev("BILLING_ISSUE", "monthly", { expirationAtMs: NOW + DAY, gracePeriodExpirationAtMs: NOW + 16 * DAY }));
    expect(d).toMatchObject({ patch: null, expiresAtMs: NOW + 16 * DAY });
  });

  it("a product the app does not sell moves nothing, granted or expired; an event with no product still grants", () => {
    expect(decide(ev("INITIAL_PURCHASE", "tip_jar")).patch).toBeNull();
    expect(decide(ev("EXPIRATION", "tip_jar"), [row("monthly", NOW - DAY, NOW + DAY)]).patch).toBeNull();
    expect(decide(ev("RENEWAL", null)).patch).toEqual({ is_elite: true, is_premium: true });
  });

  it("apex ending while premium runs drops only the apex flag; premium ending under a live apex drops nothing", () => {
    expect(decide(ev("INITIAL_PURCHASE", "apexmonthly")).patch).toEqual({ is_elite: true, is_premium: true, is_apex_subscriber: true });
    expect(decide(ev("EXPIRATION", "apexmonthly"), [row("monthly", NOW - DAY, NOW + 20 * DAY)]).patch).toEqual({ is_apex_subscriber: false });
    expect(decide(ev("EXPIRATION", "monthly"), [row("apexmonthly", NOW - DAY, NOW + 20 * DAY)]).patch).toBeNull();
  });

  it("a pause revokes like an expiry; uncancel and extend grant with the new expiry", () => {
    expect(decide(ev("SUBSCRIPTION_PAUSED", "monthly")).patch).toEqual(ALL_OFF);
    expect(decide(ev("UNCANCELLATION", "monthly", { expirationAtMs: NOW + 9 * DAY }))).toMatchObject({ patch: { is_elite: true }, expiresAtMs: NOW + 9 * DAY });
    expect(decide(ev("SUBSCRIPTION_EXTENDED", "monthly", { expirationAtMs: NOW + 40 * DAY })).expiresAtMs).toBe(NOW + 40 * DAY);
  });

  it("an older renewal retried after the expiry does not grant again", () => {
    const rows = [row("monthly", NOW, NOW - 1)];
    expect(decide(ev("RENEWAL", "monthly", { eventTs: NOW - 2 * DAY }), rows)).toMatchObject({ patch: null, reason: "stale" });
  });

  it("events it has no opinion on change nothing", () => {
    expect(decide(ev("TEST", "monthly")).patch).toBeNull();
  });
});

describe("planTransfer", () => {
  const isUser = (id: string) => /^[0-9a-f-]{36}$/.test(id);
  const A = "00000000-0000-0000-0000-00000000000a";
  const B = "00000000-0000-0000-0000-00000000000b";

  it("moves a live subscription's flags and its ledger to the new account", () => {
    expect(planTransfer([A], [B], true, isUser)).toEqual({ revoke: [A], grant: [B], ledgerTo: B });
  });
  it("a source that was not live still loses its flags but grants nothing", () => {
    expect(planTransfer([A], [B], false, isUser)).toEqual({ revoke: [A], grant: [], ledgerTo: B });
  });
  it("ignores RevenueCat's anonymous ids", () => {
    expect(planTransfer(["$RCAnonymousID:abc"], [B], true, isUser)).toEqual({ revoke: [], grant: [B], ledgerTo: B });
  });
  it("a transfer onto the same account is a no-op", () => {
    expect(planTransfer([A], [A], true, isUser)).toEqual({ revoke: [], grant: [], ledgerTo: null });
  });
});
