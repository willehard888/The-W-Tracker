// Observability — error monitoring (Sentry) + product analytics (PostHog).
//
// Both are OFF by default and cost nothing (not even bundled) until the matching
// env var is present, so the app ships clean and lights up the moment you add a
// key. Set in .env:
//   VITE_SENTRY_DSN=https://...ingest...
//   VITE_POSTHOG_KEY=phc_...
//   VITE_POSTHOG_HOST=https://eu.posthog.com   (optional; defaults to EU cloud)

// deno-lint-ignore-file no-explicit-any
type SentryLike = { captureException: (e: unknown, ctx?: any) => void; setUser: (u: any) => void } | null;
type PosthogLike = { capture: (e: string, p?: any) => void; identify: (id: string, p?: any) => void; reset: () => void } | null;

let sentry: SentryLike = null;
let posthog: PosthogLike = null;

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://eu.posthog.com";

// Dev sessions (localhost + HMR + QA accounts) generate noise that pages the
// team — a hot-reload artifact once triggered a "new issue" alert email.
// Observability is production-only unless explicitly opted in.
const ENABLED = import.meta.env.PROD || import.meta.env.VITE_OBSERVABILITY_DEV === "1";

/** Fire-and-forget init at app start. Dynamic imports so unconfigured = no bundle cost. */
export async function initObservability(): Promise<void> {
  if (!ENABLED) return;
  if (DSN) {
    try {
      const S = await import("@sentry/react");
      S.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
        // Don't capture benign aborts / network noise.
        ignoreErrors: ["AbortError", "Non-Error promise rejection captured"],
      });
      sentry = S as unknown as SentryLike;
    } catch (e) {
      console.warn("Sentry init failed", e);
    }
  }
  if (PH_KEY) {
    try {
      const mod = await import("posthog-js");
      const ph = mod.default;
      ph.init(PH_KEY, { api_host: PH_HOST, capture_pageview: true, person_profiles: "identified_only" });
      posthog = ph as unknown as PosthogLike;
    } catch (e) {
      console.warn("PostHog init failed", e);
    }
  }
}

/** Report an error to Sentry (if configured) and always to the console. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try { sentry?.captureException(error, context ? { extra: context } : undefined); } catch { /* noop */ }
  console.error(error, context ?? "");
}

/** Send a product-analytics event to PostHog (if configured). */
export function captureEvent(event: string, props?: Record<string, unknown>): void {
  try { posthog?.capture(event, props); } catch { /* noop */ }
}

/** Tie events + errors to a user (call on sign-in). */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  try { sentry?.setUser({ id: userId }); } catch { /* noop */ }
  try { posthog?.identify(userId, traits); } catch { /* noop */ }
}

/** Clear identity on sign-out. */
export function resetIdentity(): void {
  try { sentry?.setUser(null); } catch { /* noop */ }
  try { posthog?.reset(); } catch { /* noop */ }
}
