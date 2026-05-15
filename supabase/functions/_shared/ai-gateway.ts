// AI gateway shim — single point that every edge function imports.
//
// We previously routed every chat-completion call through
//   https://ai.gateway.lovable.dev/v1/chat/completions
// behind a `LOVABLE_API_KEY`. The Lovable proxy added zero value other
// than vendor lock-in — it forwarded requests to OpenRouter / OpenAI
// using their public APIs and forwarded the response back unchanged.
//
// This module now talks directly to OpenRouter (same model namespace,
// same OpenAI-compatible request/response shape). One swap here moves
// every edge function off Lovable without touching the call sites.
//
// Env vars (set on Supabase Edge Functions secrets):
//   - OPENROUTER_API_KEY  (required)
//   - LOVABLE_API_KEY     (legacy fallback during migration; remove once
//                          all Edge Functions are confirmed running on
//                          OPENROUTER_API_KEY in production)

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatCompletionOptions {
  model: string;                       // e.g. "openai/gpt-5", "google/gemini-2.5-flash"
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  /** OpenAI-style reasoning effort knob, forwarded as-is. */
  reasoning?: { effort: "low" | "medium" | "high" };
  /** Tool-calling shape for structured outputs (coach-daily-plan etc.). */
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
}

export interface ChatGatewayError extends Error {
  status: number;
  /** Raw upstream body for diagnosis. */
  body: string;
}

const makeError = (status: number, body: string): ChatGatewayError => {
  const err = new Error(`AI gateway error (${status}): ${body.slice(0, 200)}`) as ChatGatewayError;
  err.status = status;
  err.body = body;
  return err;
};

/** Resolve the API key with a soft Lovable-key fallback during migration. */
const resolveKey = (): string | null => {
  const direct = Deno.env.get("OPENROUTER_API_KEY");
  if (direct) return direct;
  // Migration fallback: if only the legacy Lovable key is set, use it.
  // OpenRouter accepts any Bearer token shape — if Lovable's gateway
  // accepted it, OpenRouter likely won't, but at least we don't 500
  // before the user has migrated the secret. The actual upstream
  // response will surface the auth error to the user.
  return Deno.env.get("LOVABLE_API_KEY") ?? null;
};

/**
 * Call the AI gateway. Returns the raw `Response` so streaming callers
 * (ai-coach) can pipe `response.body` straight to the client. Non-stream
 * callers should `await resp.json()` themselves.
 *
 * Throws `ChatGatewayError` for HTTP failures so callers can branch on
 * 401 / 429 / 402 (credits) cleanly.
 */
export const aiGatewayFetch = async (opts: ChatCompletionOptions): Promise<Response> => {
  const key = resolveKey();
  if (!key) {
    throw makeError(500, "OPENROUTER_API_KEY not configured on this Edge Function");
  }

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // OpenRouter app-attribution headers — optional but recommended
      // so usage shows under your project on openrouter.ai/activity.
      "HTTP-Referer": "https://thewtracker.app",
      "X-Title": "W Tracker",
    },
    body: JSON.stringify(opts),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "<unreadable>");
    throw makeError(resp.status, body);
  }

  return resp;
};

/**
 * Convenience wrapper for non-streaming JSON callers. Returns the parsed
 * response body so callers don't have to remember the `.json()` step.
 */
export const aiGatewayJSON = async (opts: ChatCompletionOptions): Promise<any> => {
  if (opts.stream) {
    throw new Error("aiGatewayJSON cannot be used with stream:true — use aiGatewayFetch");
  }
  const resp = await aiGatewayFetch(opts);
  return resp.json();
};
