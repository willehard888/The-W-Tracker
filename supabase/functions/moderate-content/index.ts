// AI moderator for proof photos and Elite Feed posts.
// Optimized: client-thumbnail support, hash cache, severity, fail-closed for images.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ModerationResult {
  is_safe: boolean;
  categories: string[];
  confidence: number;
  reason: string;
  action: "allow" | "flag" | "block";
  severity?: "low" | "medium" | "high" | "critical";
}

const MODEL = "google/gemini-2.5-flash";
const AI_TIMEOUT_MS = 8_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Per-instance ad-hoc rate limit. Backend doesn't have a dedicated rate-limit
// primitive yet (see internal guidance) — this is a best-effort throttle.
const rateBuckets = new Map<string, number[]>();

function checkRate(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (arr.length >= RATE_LIMIT_MAX) {
    const oldest = arr[0];
    return {
      allowed: false,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000),
    };
  }
  arr.push(now);
  rateBuckets.set(userId, arr);
  return { allowed: true, retryAfter: 0 };
}

const SYSTEM_PROMPT = `You are the moderation AI for "W Tracker", a discipline & fitness gamification app.
You review user-submitted proof photos (workouts, cold showers, healthy meals, journals, etc.) and Elite Feed posts.

ALLOW (action=allow, severity=low):
- Workout, gym, sport, run, hike, yoga, combat training, swimming photos
- Cold shower / sauna / ice bath (clothed or modestly framed)
- Healthy meals, water bottles, supplement labels
- Books, journals, planners
- Selfies after training (clothed)
- Screenshots of fitness watches, run apps, calorie counters
- Motivational text-only posts about discipline

FLAG (action=flag, is_safe=true, severity=low|medium): low effort, off-topic but harmless (random pets, memes, food unrelated to fitness)

BLOCK (action=block, is_safe=false, severity=high|critical):
- Nudity, sexual content, explicit body exposure (critical)
- Violence, gore, weapons aimed at people (critical)
- Hate speech, slurs, discriminatory imagery (critical)
- Drugs, alcohol promotion, smoking (high)
- Obviously fake / AI-generated proof (high)
- Spam, advertising external products/services (high)
- Watermarks of other apps used as fake proof (high)
- Self-harm content (critical)

Always return via the report_moderation tool. Be reasonably permissive — fitness content is the norm. Reject only when clearly violating. Provide a confidence score reflecting how certain you are.`;

async function callModerator(
  imageRef: { url?: string | null; b64?: string | null },
  text: string | null,
  kind: string,
  signal: AbortSignal,
): Promise<ModerationResult> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

  const userContent: any[] = [];
  if (text) {
    userContent.push({
      type: "text",
      text: `Content type: ${kind}\nUser text: """${text.slice(0, 1000)}"""`,
    });
  } else {
    userContent.push({ type: "text", text: `Content type: ${kind}. Review the image.` });
  }
  const imageUrl = imageRef.b64 ?? imageRef.url;
  if (imageUrl) {
    userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_moderation",
            description: "Return moderation verdict for the submitted content.",
            parameters: {
              type: "object",
              properties: {
                is_safe: { type: "boolean" },
                categories: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: [
                      "safe_fitness",
                      "safe_lifestyle",
                      "low_effort",
                      "off_topic",
                      "nudity",
                      "violence",
                      "hate",
                      "drugs",
                      "self_harm",
                      "spam",
                      "advertising",
                      "fake_screenshot",
                      "ai_generated",
                      "watermark",
                    ],
                  },
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string" },
                action: { type: "string", enum: ["allow", "flag", "block"] },
                severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              },
              required: ["is_safe", "categories", "confidence", "reason", "action", "severity"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_moderation" } },
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    console.error("AI gateway error", response.status, t);
    if (response.status === 429) throw new Error("rate_limited");
    if (response.status === 402) throw new Error("payment_required");
    throw new Error("ai_gateway_error");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call returned");

  const args = JSON.parse(toolCall.function.arguments);
  return args as ModerationResult;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ad-hoc per-instance throttle. Best-effort only.
    const rate = checkRate(user.id);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({
          action: "block",
          is_safe: false,
          reason: "rate_limited",
          retry_after: rate.retryAfter,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const {
      image_url,
      image_b64,
      image_hash,
      text,
      kind,
      content_id,
    } = body as {
      image_url?: string | null;
      image_b64?: string | null;
      image_hash?: string | null;
      text?: string | null;
      kind: "proof" | "feed_post";
      content_id?: string | null;
    };

    if (kind !== "proof" && kind !== "feed_post") {
      return new Response(JSON.stringify({ error: "Invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasImage = !!(image_b64 || image_url);
    if (!hasImage && !text) {
      return new Response(
        JSON.stringify({ action: "allow", is_safe: true, severity: "low" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseService);

    // SECURITY: never trust the client-supplied image_hash — an attacker could
    // submit an abusive image under a hash that was previously cached as
    // "allow" and skip the model entirely. Compute the hash from the actual
    // bytes server-side; for URL-only submissions (no bytes here) skip the
    // cache and always run the model.
    let effective_hash: string | null = null;
    if (image_b64) {
      try {
        const raw = image_b64.includes(",") ? image_b64.slice(image_b64.indexOf(",") + 1) : image_b64;
        const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        effective_hash = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        effective_hash = null; // undecodable → no cache, model decides
      }
    }
    // Note: `image_hash` from the body is deliberately ignored from here on.
    void image_hash;

    // 1. Cache lookup by SERVER-computed image hash
    if (effective_hash) {
      const { data: cached } = await adminClient
        .from("moderation_cache")
        .select("action, categories, confidence, severity, reason")
        .eq("image_hash", effective_hash)
        .maybeSingle();

      if (cached) {
        const latency = Date.now() - startedAt;
        await adminClient.from("content_moderations").insert({
          content_type: kind,
          content_id: content_id ?? null,
          image_url: image_url ?? null,
          text_content: text ?? null,
          is_safe: cached.action !== "block",
          categories: cached.categories,
          confidence: cached.confidence,
          reason: cached.reason,
          action: cached.action,
          severity: cached.severity,
          model: MODEL,
          cache_hit: true,
          latency_ms: latency,
        });

        return new Response(
          JSON.stringify({
            action: cached.action,
            is_safe: cached.action !== "block",
            categories: cached.categories,
            confidence: cached.confidence,
            severity: cached.severity,
            reason: cached.reason,
            cache_hit: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 2. AI call with timeout
    let result: ModerationResult;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      result = await callModerator(
        { url: image_url ?? null, b64: image_b64 ?? null },
        text ?? null,
        kind,
        controller.signal,
      );
    } catch (e: any) {
      clearTimeout(timeoutHandle);
      console.error("moderation failed:", e?.message);
      // Fail-CLOSED for images on proofs/feed posts.
      if (hasImage) {
        const latency = Date.now() - startedAt;
        await adminClient.from("content_moderations").insert({
          content_type: kind,
          content_id: content_id ?? null,
          image_url: image_url ?? null,
          text_content: text ?? null,
          is_safe: false,
          categories: [],
          confidence: 0,
          reason: "moderation_unavailable_retry",
          action: "block",
          severity: "medium",
          model: MODEL,
          cache_hit: false,
          latency_ms: latency,
        });
        return new Response(
          JSON.stringify({
            action: "block",
            is_safe: false,
            severity: "medium",
            reason: "moderation_unavailable_retry",
            categories: [],
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      // Fail-OPEN for text only.
      return new Response(
        JSON.stringify({
          action: "allow",
          is_safe: true,
          severity: "low",
          error: e?.message ?? "moderation_failed",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    clearTimeout(timeoutHandle);

    // 3. Confidence-based routing — low-confidence blocks → admin queue, allow content through as flag
    let finalAction = result.action;
    if (result.action === "block" && result.confidence < 0.85) {
      finalAction = "flag";
      await adminClient.from("moderation_queue").insert({
        content_type: kind,
        content_id: content_id ?? null,
        image_url: image_url ?? null,
        text_content: text ?? null,
        user_id: user.id,
        ai_action: "block",
        ai_confidence: result.confidence,
        ai_categories: result.categories,
        ai_reason: result.reason,
        severity: result.severity,
        status: "pending",
      });
    }

    // 4. Persist cache
    if (effective_hash) {
      await adminClient.from("moderation_cache").upsert({
        image_hash: effective_hash,
        action: finalAction,
        categories: result.categories,
        confidence: result.confidence,
        severity: result.severity,
        reason: result.reason,
      });
    }

    // 5. Persist moderation log
    const latency = Date.now() - startedAt;
    await adminClient.from("content_moderations").insert({
      content_type: kind,
      content_id: content_id ?? null,
      image_url: image_url ?? null,
      text_content: text ?? null,
      is_safe: finalAction !== "block",
      categories: result.categories,
      confidence: result.confidence,
      reason: result.reason,
      action: finalAction,
      severity: result.severity,
      model: MODEL,
      cache_hit: false,
      latency_ms: latency,
    });

    // 6. Enforcement
    if (finalAction === "block" && content_id && kind === "feed_post") {
      await adminClient.from("feed_posts").delete().eq("id", content_id).eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({
        action: finalAction,
        is_safe: finalAction !== "block",
        categories: result.categories,
        confidence: result.confidence,
        severity: result.severity,
        reason: result.reason,
        cache_hit: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("moderate-content error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
