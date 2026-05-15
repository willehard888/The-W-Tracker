import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Routes that are reachable WITHOUT a paid subscription.
 *
 * After moving off Lovable + Vercel deploy we softened the hard paywall:
 * a freshly logged-in user now lands on the home page (`/`), the profile,
 * and other free surfaces. The paywall is still the gate that elevates
 * them to Coach / battles / feed, but it no longer ambushes them on the
 * very first authenticated render — that made the app feel like a
 * sales page, not a product.
 *
 * Premium-only routes (Coach chat, programs, etc.) still enforce their
 * own checks downstream (Coach.tsx renders an upsell card for non-Elite
 * users; coach-* edge functions return 403 for non-Elite).
 */
const ALLOWED_PATHS = new Set([
  "/",
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
  "/profile",
  "/checkin",
  "/leaderboard",
  "/badges/compare",
]);

const isAllowedPath = (pathname: string) =>
  ALLOWED_PATHS.has(pathname) ||
  pathname.startsWith("/oauth") ||
  pathname.startsWith("/callback") ||
  pathname.startsWith("/~oauth") ||
  pathname.startsWith("/auth/") ||
  pathname.startsWith("/u/");

/**
 * Hard paywall: the very first thing every logged-in non-subscriber sees is
 * the paywall, and they cannot reach any protected route until they pay.
 * No free trial. No skip.
 */
const AccessGate = ({ children }: { children: ReactNode }) => {
  const { user, isElite, loading, profile, subscriptionLoading } = useAuth();
  const location = useLocation();

  if (loading) return <>{children}</>;

  // Not logged in → let route-level guards (ProtectedRoute) handle redirects.
  if (!user) return <>{children}</>;

  // Paid subscribers (Elite/Apex/Legend, RevenueCat, credits) get full access.
  if (isElite) return <>{children}</>;

  // Allow auth-flow + legal + paywall pages through.
  if (isAllowedPath(location.pathname)) return <>{children}</>;

  // CRITICAL: never redirect a logged-in user to the paywall before we've
  // had a chance to load their profile or finish a subscription check.
  // Otherwise paid users see a flash of the paywall on cold start while
  // their is_elite / status_tier / apex_subscriber flags are still loading.
  if (profile === null || subscriptionLoading) return <>{children}</>;

  // Everything else is locked → bounce to paywall.
  return <Navigate to="/paywall" replace />;
};

export default AccessGate;
