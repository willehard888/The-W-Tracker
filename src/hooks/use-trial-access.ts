import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Mirrors the server gate has_active_access(): referred users get 14 days,
// organic signups 7. The client showing 14 to everyone meant an organic user's
// Vault and AI coach went silently dark on day 8 while the header still said
// "Full access · 6d".
export const TRIAL_DURATION_DAYS = 14;
const trialDurationMs = (referred: boolean) => (referred ? 14 : 7) * 24 * 60 * 60 * 1000;

interface TrialAccess {
  /** True if user is subscribed OR is within the 14-day free trial */
  hasAccess: boolean;
  /** True only when on free trial (not Elite) */
  isInTrial: boolean;
  /** Whole days remaining in trial (0 when expired or Elite) */
  daysRemaining: number;
  /** Hours remaining in trial (0 when expired or Elite) */
  hoursRemaining: number;
  /** Total ms remaining (0 when expired or Elite) */
  msRemaining: number;
  /** Trial expired AND not Elite */
  isExpired: boolean;
  loading: boolean;
}

/**
 * Computes trial status purely on the client from `profile.trial_started_at`.
 * Server-side enforcement lives in `has_active_access(user_id)` SQL function.
 */
export const useTrialAccess = (): TrialAccess => {
  const { profile, isElite, loading } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (isElite || !profile) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [isElite, profile]);

  return useMemo(() => {
    if (loading || !profile) {
      return {
        hasAccess: false,
        isInTrial: false,
        daysRemaining: 0,
        hoursRemaining: 0,
        msRemaining: 0,
        isExpired: false,
        loading: true,
      };
    }

    if (isElite) {
      return {
        hasAccess: true,
        isInTrial: false,
        daysRemaining: 0,
        hoursRemaining: 0,
        msRemaining: 0,
        isExpired: false,
        loading: false,
      };
    }

    const startedAtRaw = profile.trial_started_at
      ? new Date(profile.trial_started_at).getTime()
      : new Date(profile.created_at).getTime();
    // NaN guard: a missing/invalid timestamp otherwise rendered "NaNd" in the
    // trial pill and made isExpired permanently false.
    const startedAt = Number.isFinite(startedAtRaw) ? startedAtRaw : now;

    const elapsed = now - startedAt;
    const msRemaining = Math.max(0, trialDurationMs(!!profile.referred_by) - elapsed);
    const isExpired = msRemaining <= 0;
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.ceil(msRemaining / (60 * 60 * 1000));

    return {
      hasAccess: !isExpired,
      isInTrial: !isExpired,
      daysRemaining,
      hoursRemaining,
      msRemaining,
      isExpired,
      loading: false,
    };
  }, [profile, isElite, loading, now]);
};
