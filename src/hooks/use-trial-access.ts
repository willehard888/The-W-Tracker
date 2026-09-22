import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Can this member walk the app? Mirrors the server gate `has_active_access()`
 * (migration 20260923110000): membership, apex, or credits. The in-app
 * 14-day trial is gone — the free trial is an App Store introductory offer,
 * started on the paywall right after sign-up, and RevenueCat's
 * INITIAL_PURCHASE grants membership like any purchase (`period_type` TRIAL
 * shows in `useStoreTrial`, RevenueCatContext).
 *
 * `loading` is true until the profile is known: the router never gates on a
 * cold start — a flash-redirect to /paywall taught members to distrust it.
 */
interface TrialAccess {
  hasAccess: boolean;
  loading: boolean;
}

export const useTrialAccess = (): TrialAccess => {
  const { profile, isElite, loading } = useAuth();
  return useMemo(
    () => (loading || !profile ? { hasAccess: false, loading: true } : { hasAccess: isElite, loading: false }),
    [profile, isElite, loading],
  );
};
