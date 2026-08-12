// Raw Postgres/RLS/exception messages must never reach a toast — they leak
// internals and sometimes the wrong product language (a DB constraint once
// told users about "clubs" in an app that calls them Tribes). Map known
// signatures to app-voice copy; everything else gets a calm generic line and
// the technical detail goes to the console for debugging.

const KNOWN: Array<{ pattern: RegExp; copy: string }> = [
  { pattern: /up to 25 clubs|up to \d+ clubs/i, copy: "You can be in up to 25 tribes — leave one first." },
  { pattern: /already.*member/i, copy: "You're already in this tribe." },
  { pattern: /duplicate key/i, copy: "That already exists — try a different name." },
  { pattern: /row-level security|permission denied/i, copy: "You don't have access to do that." },
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
