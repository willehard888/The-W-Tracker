/**
 * The member's choice about third-party AI (App Review 5.1.2(i)).
 *
 * Stored on the profile (`ai_consent_version`: null never asked, 0 declined or
 * withdrawn, n accepted version n) so the server can honour it in cron jobs
 * too; this file is the client's reading of it. The constant mirrors
 * supabase/functions/_shared/openrouter.ts: client code reachable from Home
 * may not import from supabase/functions, so a parity test keeps them equal.
 */
export const AI_CONSENT_VERSION = 1;

export type AiConsentState = "unasked" | "declined" | "granted";

export const aiConsentState = (version: number | null | undefined): AiConsentState =>
  version == null ? "unasked" : version >= AI_CONSENT_VERSION ? "granted" : "declined";

export const hasAiConsent = (version: number | null | undefined): boolean => aiConsentState(version) === "granted";

/** The profile patch for a choice made now. */
export const aiConsentPatch = (granted: boolean, now: Date = new Date()) => ({
  ai_consent_version: granted ? AI_CONSENT_VERSION : 0,
  ai_consent_at: now.toISOString(),
});

/** What an edge function answers when the member has not opted in. */
export const AI_CONSENT_REQUIRED = "ai_consent_required";
