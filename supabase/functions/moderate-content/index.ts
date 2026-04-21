// AI moderator for proof photos and Elite Feed posts.
// Uses Lovable AI Gateway with google/gemini-2.5-flash (vision + tool calling).
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
}

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the moderation AI for "W Tracker", a discipline & fitness gamification app.
You review user-submitted proof photos (workouts, cold showers, healthy meals, journals, etc.) and Elite Feed posts.

ALLOW:
- Workout, gym, sport, run, hike, yoga, combat training, swimming photos
- Cold shower / sauna / ice bath (clothed or modestly framed)
- Healthy meals, water bottles, supplement labels
- Books, journals, planners
- Selfies after training (clothed)
- Screenshots of fitness watches, run apps, calorie counters
- Motivational text-only posts about discipline

FLAG (action=flag, is_safe=true): low effort, off-topic but harmless (random pets, memes, food unrelated to fitness)

BLOCK (action=block, is_safe=false):
- Nudity, sexual content, explicit body exposure
- Violence, gore, weapons aimed at people
- Hate speech, slurs, discriminatory imagery
- Drugs, alcohol promotion, smoking
- Obviously fake / AI-generated proof (detect generic stock-like or clearly synthesized)
- Spam, advertising external products/services, unrelated promotional content
- Watermarks of other apps used as fake proof
- Self-harm content

Always return via the report_moderation tool. Be reasonably permissive — fitness content is the norm. Reject only when clearly violating.`;

async function callModerator(imageUrl: string | null, text: string | null, kind: string): Promise<ModerationResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const userContent: any[] = [];
  if (text) {
    userContent.push({
      type: "text",
      text: `Content type: ${kind}\nUser text: """${text.slice(0, 1000)}"""`,
    });
  } else {
    userContent.push({ type: "text", text: `Content type: ${kind}. Review the image.` });
  }
  if (imageUrl) {
    userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
              },
              required: ["is_safe", "categories", "confidence", "reason", "action"],
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

    const body = await req.json();
    const { image_url, text, kind, content_id } = body as {
      image_url?: string | null;
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
    if (!image_url && !text) {
      // Nothing to moderate, allow.
      return new Response(JSON.stringify({ action: "allow", is_safe: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: ModerationResult;
    try {
      result = await callModerator(image_url ?? null, text ?? null, kind);
    } catch (e: any) {
      console.error("moderation failed:", e?.message);
      // Fail-open: don't block users when moderator itself fails.
      return new Response(
        JSON.stringify({ action: "allow", is_safe: true, error: e?.message ?? "moderation_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persist result with service role
    const adminClient = createClient(supabaseUrl, supabaseService);
    await adminClient.from("content_moderations").insert({
      content_type: kind,
      content_id: content_id ?? null,
      image_url: image_url ?? null,
      text_content: text ?? null,
      is_safe: result.is_safe,
      categories: result.categories,
      confidence: result.confidence,
      reason: result.reason,
      action: result.action,
      model: MODEL,
    });

    // Enforcement: if blocked and content_id given, delete/flag the content
    if (result.action === "block" && content_id) {
      if (kind === "feed_post") {
        await adminClient.from("feed_posts").delete().eq("id", content_id).eq("user_id", user.id);
      }
      // For proofs we don't auto-delete the check-in; just return block so client doesn't submit.
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("moderate-content error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
