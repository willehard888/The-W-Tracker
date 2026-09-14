import { describe, it, expect } from "vitest";
import { shouldGateOnboarding } from "@/lib/onboarding-gate";

describe("shouldGateOnboarding", () => {
  it("never gates while the profile is unknown", () => {
    expect(shouldGateOnboarding(null, false)).toBe(false);
    expect(shouldGateOnboarding(undefined, false)).toBe(false);
  });
  it("gates a loaded profile that has not onboarded and has no local flag", () => {
    expect(shouldGateOnboarding({ onboarded_at: null }, false)).toBe(true);
    expect(shouldGateOnboarding({}, false)).toBe(true);
  });
  it("either flag is enough to skip the flow", () => {
    expect(shouldGateOnboarding({ onboarded_at: "2026-09-01T00:00:00Z" }, false)).toBe(false);
    expect(shouldGateOnboarding({ onboarded_at: null }, true)).toBe(false);
  });
});
