/**
 * "May we send this to an AI model?", askable from anywhere.
 *
 * The consent lives on the member's profile and the server refuses without it
 * (403 `ai_consent_required`), so the client needs one way to ask that works
 * from a page, from a button handler, and from code that is not a React
 * component. Same shape as `router-bridge.ts`: the mounted host registers
 * itself, everyone else calls `ensureAiConsent()`.
 */
import { hasAiConsent } from "@/lib/ai-consent";

interface Host {
  /** The member's stored version, kept current by the host. */
  version: () => number | null | undefined;
  /** Opens the sheet; resolves with the member's answer. */
  ask: () => Promise<boolean>;
}

let host: Host | null = null;
let pending: Promise<boolean> | null = null;

export const setAiConsentHost = (h: Host | null): void => { host = h; };

/** True when the member has already opted in (no sheet, no await of anything slow). */
export const aiConsentGranted = (): boolean => hasAiConsent(host?.version());

/**
 * Resolves true when the member has opted in, asking them if they have not.
 * False when they decline, when the sheet is dismissed, or when no host is
 * mounted (nothing should silently send data because the UI is missing).
 * One ask at a time: a second caller waits for the same answer.
 */
export const ensureAiConsent = (): Promise<boolean> => {
  if (aiConsentGranted()) return Promise.resolve(true);
  if (!host) return Promise.resolve(false);
  if (!pending) pending = host.ask().finally(() => { pending = null; });
  return pending;
};
