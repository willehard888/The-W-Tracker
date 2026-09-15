/**
 * Whether a RevenueCat event from a non-production store environment may
 * change entitlements. Sandbox purchases fire the same authentic webhooks
 * as money does but cost nothing, so a sandbox event grants access only to
 * the app's own testers: an app_user_id that holds the admin role, or when
 * DEBUG_ALLOW_SANDBOX=true opts the whole project in (TestFlight sessions).
 * Production events never reach this rule.
 */
export const allowSandboxEvent = (o: { environment?: string | null; isAdmin: boolean; debugAllow: boolean }): boolean => {
  const env = (o.environment ?? "PRODUCTION").toUpperCase();
  if (env === "PRODUCTION") return true;
  return o.debugAllow || o.isAdmin;
};
