import { describe, it, expect } from "vitest";
import { isCancellation, hasElite } from "@/contexts/RevenueCatContext";

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

describe("hasElite", () => {
  it("is true only when the elite entitlement is active", () => {
    expect(hasElite({ entitlements: { active: { "The W Tracker Pro": { isActive: true } } } })).toBe(true);
    expect(hasElite({ entitlements: { active: {} } })).toBe(false);
    expect(hasElite({ entitlements: { all: { "The W Tracker Pro": {} } } })).toBe(false);
    expect(hasElite(null)).toBe(false);
  });
});
