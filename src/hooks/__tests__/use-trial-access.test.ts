import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Access is membership: the free trial is an App Store introductory offer and
// RevenueCat grants is_elite when it starts. The only boundary left is the
// loading one — the router must never gate before the profile is known.
const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));

import { useTrialAccess } from "@/hooks/use-trial-access";

const run = (state: Record<string, unknown>) => {
  auth.state = { loading: false, isElite: false, ...state };
  return renderHook(() => useTrialAccess()).result.current;
};

afterEach(() => { auth.state = {}; });

describe("useTrialAccess", () => {
  it("is loading, never gating, while the profile has not arrived", () => {
    expect(run({ profile: null })).toEqual({ hasAccess: false, loading: true });
    expect(run({ profile: null, loading: true })).toEqual({ hasAccess: false, loading: true });
  });

  it("a member (paid, on the store trial, credits, apex, legend — all isElite) passes", () => {
    expect(run({ profile: { user_id: "u1" }, isElite: true })).toEqual({ hasAccess: true, loading: false });
  });

  it("a signed-up account without membership is gated — no in-app trial any more", () => {
    const fresh = { user_id: "u1", trial_started_at: new Date().toISOString(), created_at: new Date().toISOString() };
    expect(run({ profile: fresh })).toEqual({ hasAccess: false, loading: false });
  });
});
