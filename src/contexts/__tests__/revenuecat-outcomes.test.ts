import { describe, it, expect } from "vitest";
import { isCancellation, isPaymentPending, hasElite, purchaseSandboxFlag } from "@/contexts/RevenueCatContext";

// The two predicates every purchase outcome hangs on. `isCancellation` decides
// whether the Paywall goes idle (cancelled) or spins for 8 s into "Payment
// confirmed but we couldn't verify access"; `hasElite` decides whether Restore
// says "Purchases restored." or "No purchase found on this Apple ID."
describe("isCancellation", () => {
  it("recognises StoreKit's cancel in every shape RevenueCat hands over", () => {
    expect(isCancellation({ code: "1" })).toBe(true);
    expect(isCancellation({ code: 1 })).toBe(true);
    expect(isCancellation({ userCancelled: true })).toBe(true);
  });
  it("does not mistake a real failure for a cancel", () => {
    expect(isCancellation({ code: "2", message: "Store problem" })).toBe(false);
    expect(isCancellation(new Error("network"))).toBe(false);
    expect(isCancellation(null)).toBe(false);
    expect(isCancellation(undefined)).toBe(false);
  });
});

// Ask to Buy (a child account) and SCA both reject with PAYMENT_PENDING_ERROR.
// Read as a plain failure, it told a family the purchase failed while it sat
// in a parent's approval queue — and the membership then arrived anyway.
describe("isPaymentPending", () => {
  it("recognises a payment waiting on someone else's approval", () => {
    expect(isPaymentPending({ code: "20" })).toBe(true);
    expect(isPaymentPending({ code: 20 })).toBe(true);
    expect(isPaymentPending({ readableErrorCode: "PaymentPendingError" })).toBe(true);
  });
  it("is not a cancel and not a failure", () => {
    expect(isPaymentPending({ code: "1" })).toBe(false);
    expect(isPaymentPending({ code: "2", message: "Store problem" })).toBe(false);
    expect(isPaymentPending(new Error("network"))).toBe(false);
    expect(isPaymentPending(null)).toBe(false);
    // The two predicates must never both claim the same error.
    expect(isCancellation({ code: "20" })).toBe(false);
  });
});

describe("hasElite", () => {
  it("is true only when the elite entitlement is active", () => {
    expect(hasElite({ entitlements: { active: { "The W Tracker Pro": { isActive: true } } } })).toBe(true);
    expect(hasElite({ entitlements: { active: {} } })).toBe(false);
    expect(hasElite({ entitlements: { all: { "The W Tracker Pro": {} } } })).toBe(false);
    expect(hasElite(null)).toBe(false);
  });
});

describe("purchaseSandboxFlag", () => {
  it("reads the store environment off the active entitlement, null when inactive", () => {
    const active = (isSandbox: boolean) => ({ entitlements: { active: { "The W Tracker Pro": { isSandbox } } } });
    expect(purchaseSandboxFlag(active(true))).toBe(true);
    expect(purchaseSandboxFlag(active(false))).toBe(false);
    expect(purchaseSandboxFlag({ entitlements: { active: {} } })).toBeNull();
    expect(purchaseSandboxFlag(null)).toBeNull();
  });
});
