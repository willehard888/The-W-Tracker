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
 * Hard paywall: once the 9-day trial expires (and user is not Elite),
 * everything except essential auth/legal/paywall routes is blocked.
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
