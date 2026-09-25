// What a crash report is allowed to carry off the device.
//
// Sentry had no beforeSend at all: whatever a thrown Error happened to hold in
// its message, and whatever sat in the URL at the time, went out verbatim. Most
// of the time that is a stack trace and nothing else — but the app has a
// /reset-password route whose token lives in the query string, Supabase errors
// quote row content, and `friendlyError` deliberately keeps raw messages around.
// None of that is needed to fix a crash.
//
// Pure functions, so the rules are unit-testable without booting Sentry.

const REDACTED = "[redacted]";

/** JWTs (Supabase keys and sessions are all `eyJ…`) and Bearer headers. */
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._-]+/gi;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g;

/**
 * Strip query and fragment, keep origin + path.
 *
 * Deliberately whole-sale: an allowlist of "safe" params is a list somebody has
 * to remember to update, and the path alone already answers "which screen".
 * UUIDs in the path stay — the report carries the user id anyway, and a route
 * without its ids is not worth reading.
 */
export const scrubUrl = (url: string): string => {
  if (!url) return url;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
};

/** Redact credential-shaped and address-shaped substrings from free text. */
export const scrubText = (text: string): string =>
  text.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`).replace(EMAIL, REDACTED);

/** True when a string changed under scrubbing — used by tests, not by the app. */
export const isClean = (text: string): boolean => scrubText(text) === text;
