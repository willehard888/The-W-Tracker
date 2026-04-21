import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTrialAccess } from "@/hooks/use-trial-access";

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
 * Hard entry paywall: the entire app requires an active membership
 * (€4.99/mo or 7-day trial). Once the trial expires (and the user
 * does not have an active subscription), every route except essential
 * auth/legal/paywall routes is blocked. There is no skip.
 */
const AccessGate = ({ children }: { children: ReactNode }) => {
  const { hasAccess, loading } = useTrialAccess();
  const location = useLocation();

  if (loading) return <>{children}</>;
  if (hasAccess) return <>{children}</>;

  const isAllowed = ALLOWED_PATHS.has(location.pathname) ||
    location.pathname.startsWith("/oauth") ||
    location.pathname.startsWith("/callback") ||
    location.pathname.startsWith("/~oauth") ||
    location.pathname.startsWith("/auth/") ||
    location.pathname.startsWith("/u/");

  if (isAllowed) return <>{children}</>;
  return <Navigate to="/paywall" replace />;
};

export default AccessGate;
