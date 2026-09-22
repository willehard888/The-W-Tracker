// Raw Postgres/RLS/exception messages must never reach a toast — they leak
// internals and sometimes the wrong product language (a DB constraint once
// told users about "clubs" in an app that calls them Tribes). Map known
// signatures to app-voice copy; everything else gets a calm generic line and
// the technical detail goes to the console for debugging.

const KNOWN: Array<{ pattern: RegExp; copy: string }> = [
  { pattern: /up to 25 clubs|up to \d+ clubs/i, copy: "You can be in up to 25 tribes — leave one first." },
  { pattern: /already.*member/i, copy: "You're already in this tribe." },
  // Must precede the generic duplicate-key line — reporting twice is not a naming clash.
  { pattern: /tribe_post_reports_post_reporter_key/, copy: "You already reported this post — the owner is on it." },
  { pattern: /duplicate key/i, copy: "That already exists — try a different name." },
  { pattern: /row-level security|permission denied/i, copy: "You don't have access to do that." },
  // The server's machine code for "this member has never been asked whether a
  // model may see their data". It reached the brief and the progress read as
  // the literal string `ai_consent_required` before this line existed.
  { pattern: /^ai_consent_required$/, copy: "AI features are off. Turn them on in Profile, or open the coach and say yes." },
  { pattern: /rate limit/i, copy: "Slow down a moment and try again." },
  { pattern: /load failed|failed to fetch|network|timeout/i, copy: "Connection hiccup — try again." },
  { pattern: /ALREADY_CHECKED_IN_TODAY/, copy: "Today is already locked in. Come back tomorrow." },
];

/** App-voice message for a caught error; logs the raw detail to console. */
export function friendlyError(err: unknown, fallback = "Something went wrong. Try again."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : (err as { message?: string })?.message ?? "";
  if (typeof console !== "undefined" && raw) console.error("friendlyError:", raw);
  for (const k of KNOWN) {
    if (k.pattern.test(raw)) return k.copy;
  }
  return fallback;
}

/** What the server actually said, once the Response has been read. */
export type EdgeError = { status?: number; code?: string; message: string };

const BY_STATUS: Record<number, string> = {
  401: "Sign in again to continue.",
  403: "Your membership doesn't cover this yet.",
  429: "Slow down a moment and try again.",
};

/**
 * `supabase.functions.invoke` rejects any non-2xx as a FunctionsHttpError whose
 * message is always the same sentence — "Edge Function returned a non-2xx
 * status code". The function's own words (the daily AI limit and when it
 * resets, membership required, the consent prompt) sit unread in the Response
 * hanging off `context`, so the screens that only showed `error.message` told
 * the member nothing, or showed a blank card. Read the body, keep the code the
 * caller may want to branch on, and put the sentence through the same copy map
 * as every other error.
 */
export async function readEdgeError(err: unknown, fallback?: string): Promise<EdgeError> {
  const ctx = (err as { context?: { status?: number; json?: () => Promise<unknown> } } | null)?.context;
  const status = ctx?.status;
  let code: string | undefined;
  try {
    const body = await ctx?.json?.();
    if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
      code = (body as { error: string }).error;
    }
  } catch {
    /* no JSON body — the status decides */
  }
  const generic = fallback ?? (status !== undefined ? BY_STATUS[status] : undefined) ?? "Something went wrong. Try again.";
  return { status, code, message: code ? friendlyError(new Error(code), code) : generic };
}

/**
 * What KIND of failure this was.
 *
 * "Connection hiccup — try again." is honest only for a transport failure, and
 * an evening reflection that failed to save showed exactly that with no way to
 * tell whether the phone was offline, the session had expired, or a constraint
 * had rejected the row. The copy is the same sentence either way; the category
 * is what decides whether a retry button makes sense, whether the member should
 * be sent to sign in again, and whether an engineer should ever hear about it.
 */
export type ErrorCategory = "validation" | "auth" | "permission" | "network" | "conflict" | "server" | "unknown";

const CATEGORY: Array<{ pattern: RegExp; category: ErrorCategory }> = [
  // WKWebView says "Load failed" for any fetch that never completed; Chrome
  // says "Failed to fetch". Both mean the request did not reach the server.
  // iOS says "The request timed out", not "timeout" — the tense matters.
  { pattern: /load failed|failed to fetch|network|time[d]? ?out|aborted|offline/i, category: "network" },
  { pattern: /jwt|token|not authenticated|invalid.*session|refresh.*token/i, category: "auth" },
  { pattern: /row-level security|permission denied|not authorized/i, category: "permission" },
  { pattern: /duplicate key|already exists|_key\b|conflict/i, category: "conflict" },
  { pattern: /violates|constraint|invalid input|out of range|null value/i, category: "validation" },
  { pattern: /internal server|pgrst|function.*does not exist|schema cache/i, category: "server" },
];

/** Category for a caught error — decides retry, sign-in and whether to report. */
export function errorCategory(err: unknown): ErrorCategory {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : (err as { message?: string })?.message ?? "";
  for (const c of CATEGORY) if (c.pattern.test(raw)) return c.category;
  return "unknown";
}

/**
 * Categories worth waking someone up for.
 *
 * A member on a train in a tunnel is not a defect and must not become alert
 * noise; a constraint violation or a missing function is our mistake and would
 * otherwise be invisible, because the only trace today is a console line on a
 * phone nobody is holding.
 */
export const isOurFault = (c: ErrorCategory): boolean =>
  c === "server" || c === "validation" || c === "permission" || c === "unknown";

/** True when trying the same thing again could plausibly work. */
export const isRetryable = (c: ErrorCategory): boolean => c === "network" || c === "server" || c === "unknown";
