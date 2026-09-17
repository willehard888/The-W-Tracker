// The ONE door to the model provider. Every function that sends a member's
// data to an AI model calls openrouterFetch, so three things are true
// everywhere at once:
//   1. Consent (App Review 5.1.2(i)): without the member's opt-in nothing
//      leaves, and the caller gets a 403 Response it already knows how to
//      handle (its !ok path, or its deterministic fallback).
//   2. The provider is told not to retain or train on the request.
//   3. The call has a timeout: a hung socket used to hold a cron isolate to
//      the wall-clock limit and the night's job produced nothing.
// A test (src/lib/__tests__/openrouter-chokepoint.test.ts) fails if any other
// file under supabase/functions names the provider's host.
//
// deno-lint-ignore-file no-explicit-any

/** Bump when what is sent, or to whom, changes: members are asked again. Mirrored in src/lib/ai-consent.ts. */
export const AI_CONSENT_VERSION = 1;

/** NULL = never asked, 0 = declined or withdrawn, n = accepted version n. */
export const consentOk = (version: number | null | undefined): boolean => (version ?? 0) >= AI_CONSENT_VERSION;

/** The member's stored choice. Fails closed: no row, no consent. */
export const hasAiConsent = async (sb: any, userId: string): Promise<boolean> => {
  const { data } = await sb.from("profiles").select("ai_consent_version").eq("user_id", userId).maybeSingle();
  return consentOk(data?.ai_consent_version);
};

export const AI_CONSENT_REQUIRED = "ai_consent_required";

export interface OpenRouterOptions {
  /** Moderation passes true: it is the safety screen guideline 1.2 requires, disclosed but not switchable. */
  consent: boolean;
  timeoutMs?: number;
  /** For a caller that aborts on its own (a client disconnect on a stream). */
  signal?: AbortSignal;
}

export const openrouterFetch = (apiKey: string, body: Record<string, unknown>, o: OpenRouterOptions): Promise<Response> => {
  if (!o.consent) {
    return Promise.resolve(new Response(JSON.stringify({ error: AI_CONSENT_REQUIRED }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }));
  }
  const timeout = AbortSignal.timeout(o.timeoutMs ?? 60_000);
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: o.signal ? AbortSignal.any([o.signal, timeout]) : timeout,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.whealthfactory.com",
      "X-Title": "Whealth Factory",
    },
    // Only route to providers that do not retain or train on the request.
    body: JSON.stringify({ ...body, provider: { ...(body.provider as object | undefined), data_collection: "deny" } }),
  });
};
