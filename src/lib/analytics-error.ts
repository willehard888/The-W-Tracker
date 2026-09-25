// What an error is ALLOWED to tell analytics.
//
// checkin_failed shipped `message: rpcError.message?.slice(0, 120)`. A 120-char
// slice is a length cap, not a filter: PostgREST echoes constraint names, column
// values and row contents in the message, and `track` mirrors every prop to
// PostHog. So a failed check-in could carry a fragment of somebody's row to a
// third party, forever, and nobody would ever look at the string anyway — the
// question a funnel answers is "how often, and which kind", not "what did
// Postgres say".
//
// This returns only values drawn from a closed set: a token the app itself
// raises, a coarse bucket, or an SQLSTATE. Free text cannot get through, which
// is a property pilot-leakage.test.ts asserts rather than a habit we maintain.

/** Tokens the app's own SQL raises via `RAISE EXCEPTION '<TOKEN>'`. */
const APP_TOKENS = [
  "ALREADY_CHECKED_IN_TODAY",
  "BAD_ACTION",
  "BAD_INPUT",
  "FOOD_NOT_FOUND",
  "FORBIDDEN",
  "INVALID_GRAMS",
  "INVALID_INPUT",
  "INVALID_ITEMS",
  "INVALID_KIND",
  "INVALID_QUICK",
  "INVALID_RANGE",
  "INVALID_SERVING",
  "INVALID_SLOT",
  "INVALID_SOURCE",
  "MEMBERSHIP_REQUIRED",
  "PREMIUM_REQUIRED",
  "RECIPE_NOT_FOUND",
  "TOO_MANY_ROWS",
  "UNAUTHENTICATED",
  "ai_consent_required",
] as const;

/** Coarse buckets for everything the app does not raise itself. */
const BUCKETS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /load failed|failed to fetch|networkerror|timeout|aborted/i, reason: "network" },
  { pattern: /row-level security|permission denied|not authorized/i, reason: "rls" },
  { pattern: /jwt|token.*expired|invalid.*claim/i, reason: "auth" },
  { pattern: /duplicate key|unique constraint/i, reason: "duplicate" },
  { pattern: /rate limit|too many/i, reason: "rate_limit" },
];

/** SQLSTATE ("23505") or a PostgREST code ("PGRST301") — structured, never prose. */
const SAFE_CODE = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/;

const messageOf = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
};

const codeOf = (err: unknown): string | null => {
  if (err && typeof err === "object") {
    const c = (err as { code?: unknown }).code;
    if (typeof c === "string" && SAFE_CODE.test(c)) return c;
  }
  return null;
};

export interface ErrorClass {
  /** A token from APP_TOKENS, a bucket name, or "other". Never free text. */
  reason: string;
  /** SQLSTATE / PostGREST code when it is shaped like one, else null. */
  code: string | null;
}

/**
 * Classify an error into props that are safe to send anywhere.
 *
 * Deliberately returns "other" rather than a truncated message for anything
 * unrecognised: an unknown error is a signal to go and read the logs, not a
 * reason to copy the logs into an analytics table.
 */
export const classifyError = (err: unknown): ErrorClass => {
  const raw = messageOf(err);
  const code = codeOf(err);
  for (const token of APP_TOKENS) {
    if (raw.includes(token)) return { reason: token, code };
  }
  for (const b of BUCKETS) {
    if (b.pattern.test(raw)) return { reason: b.reason, code };
  }
  return { reason: "other", code };
};
