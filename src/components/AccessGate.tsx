import { ReactNode } from "react";

/**
 * AccessGate — pass-through (paywall removed).
 *
 * The historical implementation hard-gated every protected route behind a
 * paid subscription and bounced non-subscribers to /paywall on every
 * render. That hard funnel was removed when the project moved off Lovable
 * and decided to ship an open product instead of a sales funnel.
 *
 * The wrapper is kept (rather than deleted from App.tsx) so future
 * subscription / role-based gating has an obvious place to live. If you
 * want to bring the paywall back, restore the original implementation
 * from git history — it lives in commit b386bba and earlier.
 */
const AccessGate = ({ children }: { children: ReactNode }) => <>{children}</>;

export default AccessGate;
