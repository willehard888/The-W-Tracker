import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { useAuth } from "@/contexts/AuthContext";

const ALLOWED_PATHS = new Set([
  "/paywall",
  "/onboarding",
  "/apple-username",
  "/landing",
  "/auth",
  "/privacy",
  "/terms",
  "/reset-password",
  "/ios-debug",
  "/apple-auth-launch",
]);

/**
 * Per-user storage key — once a user has seen the entry paywall after login,
 * we don't redirect them again on subsequent navigations.
 */
const ENTRY_PAYWALL_SEEN_KEY = (uid: string) => `entry_paywall_seen:${uid}`;

const isAllowedPath = (pathname: string) =>
  ALLOWED_PATHS.has(pathname) ||
  pathname.startsWith("/oauth") ||
  pathname.startsWith("/callback") ||
  pathname.startsWith("/~oauth") ||
  pathname.startsWith("/auth/") ||
  pathname.startsWith("/u/");

/**
 * Hard entry paywall:
 *  1. Right after login, every non-subscriber is shown the Member paywall ONCE
 *     (regardless of trial status), so the offer is always the first thing
 *     they see post-auth.
 *  2. After the 7-day free trial expires, every protected route stays blocked
 *     until the user upgrades — no skip.
 */
const AccessGate = ({ children }: { children: ReactNode }) => {
  const { hasAccess, loading } = useTrialAccess();
  const { user, isElite } = useAuth();
  const location = useLocation();

  // Decide if we need to force the entry paywall this render.
  const [needsEntryPaywall, setNeedsEntryPaywall] = useState(false);

  useEffect(() => {
    if (!user || isElite) {
      setNeedsEntryPaywall(false);
      return;
    }
    try {
      const seen = window.localStorage.getItem(ENTRY_PAYWALL_SEEN_KEY(user.id));
      setNeedsEntryPaywall(!seen);
    } catch {
      setNeedsEntryPaywall(false);
    }
  }, [user, isElite]);

  // Mark paywall as seen the moment the user lands on /paywall — so they can
  // navigate away freely afterwards (still gated by trial expiry below).
  useEffect(() => {
    if (!user) return;
    if (location.pathname !== "/paywall") return;
    try {
      window.localStorage.setItem(ENTRY_PAYWALL_SEEN_KEY(user.id), "1");
      setNeedsEntryPaywall(false);
    } catch {
      /* ignore quota / privacy mode errors */
    }
  }, [location.pathname, user]);

  if (loading) return <>{children}</>;

  // Entry paywall: first visit after login → bounce to /paywall (unless we're
  // already on an allowed route like /auth, /paywall, /privacy, etc.).
  if (
    user &&
    !isElite &&
    needsEntryPaywall &&
    !isAllowedPath(location.pathname)
  ) {
    return <Navigate to="/paywall" replace />;
  }

  if (hasAccess) return <>{children}</>;

  // Trial expired: hard-gate every non-essential route.
  if (isAllowedPath(location.pathname)) return <>{children}</>;
  return <Navigate to="/paywall" replace />;
};

export default AccessGate;
