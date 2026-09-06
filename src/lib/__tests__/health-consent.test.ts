import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  markHealthConnected,
  hasHealthConsent,
  clearHealthConsent,
  markWorkoutWriteEnabled,
  hasWorkoutWriteConsent,
  clearWorkoutWriteConsent,
  WORKOUT_WRITE_CONSENT_KEY,
} from "@/lib/health/health-consent";

describe("health-consent", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("reports no consent before the user connects", () => {
    expect(hasHealthConsent()).toBe(false);
  });

  it("reports consent once connected", () => {
    markHealthConnected();
    expect(hasHealthConsent()).toBe(true);
  });

  it("clears consent on sign-out", () => {
    markHealthConnected();
    clearHealthConsent();
    expect(hasHealthConsent()).toBe(false);
  });

  // The whole point of the gate: an unreadable store must never be treated as
  // "already consented", or the background sync raises an unexplained iOS
  // Health prompt — the exact failure this module exists to prevent.
  it("fails closed when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(hasHealthConsent()).toBe(false);
  });

  it("does not throw when storage is unwritable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => markHealthConnected()).not.toThrow();
  });
});

describe("workout write consent", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("is off until the athlete turns it on, independent of the read consent", () => {
    expect(hasWorkoutWriteConsent()).toBe(false);
    markHealthConnected();
    expect(hasWorkoutWriteConsent()).toBe(false);
    markWorkoutWriteEnabled();
    expect(hasWorkoutWriteConsent()).toBe(true);
    expect(localStorage.getItem(WORKOUT_WRITE_CONSENT_KEY)).toBe("1");
  });

  it("clears on sign-out without touching the read consent", () => {
    markHealthConnected();
    markWorkoutWriteEnabled();
    clearWorkoutWriteConsent();
    expect(hasWorkoutWriteConsent()).toBe(false);
    expect(hasHealthConsent()).toBe(true);
  });

  it("fails closed when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(hasWorkoutWriteConsent()).toBe(false);
  });

  it("does not throw when storage is unwritable or unremovable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => markWorkoutWriteEnabled()).not.toThrow();
    expect(() => clearWorkoutWriteConsent()).not.toThrow();
  });
});
