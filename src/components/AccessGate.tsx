import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Routes that are reachable WITHOUT a paid subscription.
 * Everything else is hard-gated behind the paywall — there is no free trial.
 */
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
