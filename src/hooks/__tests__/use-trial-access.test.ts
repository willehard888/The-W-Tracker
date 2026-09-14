import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// The hook owns the 14-day edge and had no test. Every case here is a
// boundary that was wrong at least once: a null profile after the 8 s
// subscription race, the last hour of day 14, clock skew that ceiled to
// "15D", an unparseable timestamp that rendered "NaNd".
const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));

import { useTrialAccess } from "@/hooks/use-trial-access";

const DAY = 24 * 60 * 60 * 1000;
const profileStarted = (msAgo: number) => ({
  created_at: new Date(Date.now() - msAgo).toISOString(),
  trial_started_at: new Date(Date.now() - msAgo).toISOString(),
});
const run = (state: Record<string, unknown>) => {
  auth.state = { loading: false, isElite: false, ...state };
  return renderHook(() => useTrialAccess()).result.current;
};

afterEach(() => { auth.state = {}; });

describe("useTrialAccess", () => {
  it("is loading, not expired, while the profile has not arrived", () => {
    const r = run({ profile: null });
    expect(r.loading).toBe(true);
    expect(r.hasAccess).toBe(false);
    expect(r.isExpired).toBe(false);
  });

  it("still loads while auth says loading even with a profile", () => {
    expect(run({ loading: true, profile: profileStarted(0) }).loading).toBe(true);
  });

  it("Elite has access regardless of the trial clock", () => {
    const r = run({ isElite: true, profile: profileStarted(40 * DAY) });
    expect(r.hasAccess).toBe(true);
    expect(r.isInTrial).toBe(false);
    expect(r.daysRemaining).toBe(0);
  });

  it("the last hour of day 14 is still inside the trial", () => {
    const r = run({ profile: profileStarted(14 * DAY - 30 * 60 * 1000) });
    expect(r.hasAccess).toBe(true);
    expect(r.daysRemaining).toBe(1);
    expect(r.hoursRemaining).toBe(1);
  });

  it("expires at exactly 14 days", () => {
    const r = run({ profile: profileStarted(14 * DAY) });
    expect(r.isExpired).toBe(true);
    expect(r.hasAccess).toBe(false);
    expect(r.msRemaining).toBe(0);
    expect(r.daysRemaining).toBe(0);
  });

  it("a start stamped seconds in the future reads 14 days, never 15", () => {
    expect(run({ profile: profileStarted(-5_000) }).daysRemaining).toBe(14);
  });

  it("falls back to created_at when trial_started_at is missing", () => {
    const r = run({ profile: { created_at: new Date(Date.now() - 3 * DAY).toISOString(), trial_started_at: null } });
    expect(r.daysRemaining).toBe(11);
  });

  it("an unparseable timestamp counts as a fresh start, not NaN", () => {
    const r = run({ profile: { created_at: "not a date", trial_started_at: "also not" } });
    expect(Number.isNaN(r.daysRemaining)).toBe(false);
    expect(r.daysRemaining).toBe(14);
    expect(r.isExpired).toBe(false);
  });
});
