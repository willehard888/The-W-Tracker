/**
 * Retry an async op on TRANSIENT network failures (WKWebView's classic
 * "TypeError: Load failed" on flaky cellular, fetch aborts, gateway blips).
 * Non-network errors (RLS, validation, 4xx business errors) are NOT retried —
 * they rethrow immediately so real failures stay visible.
 */
const TRANSIENT_PATTERNS = [
  "load failed",          // WKWebView / Safari fetch network drop
  "failed to fetch",      // Chromium fetch network drop
  "network request failed",
  "networkerror",
  "timed out",
  "timeout",
  "socket",
  "econnreset",
];

export const isTransientNetworkError = (err: unknown): boolean => {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
};

export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 800,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts || !isTransientNetworkError(e)) throw e;
      await new Promise((r) => setTimeout(r, baseDelayMs * i));
    }
  }
  throw lastErr;
}
