// coach-generate-program — Premium-only. Generates a personalized 4-week program via Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "emit_program",
    description: "Emit a structured 4-week training, recovery and nutrition program.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        ai_summary: {
          type: "string",
          description: "2–3 sentence coach-style overview of the block, what it targets, and how to use it.",
        },
        plan: {
          type: "object",
          additionalProperties: false,
          properties: {
            weekly_check_targets: {
              type: "object",
              additionalProperties: false,
              properties: {
                workouts: { type: "integer" },
                sleep_avg_h: { type: "number" },
                hydration_l: { type: "number" },
                perfect_days: { type: "integer" },
              },
              required: ["workouts", "sleep_avg_h", "hydration_l", "perfect_days"],
            },
            weeks: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  week: { type: "integer" },
                  theme: { type: "string" },
                  days: {
                    type: "array",
                    minItems: 7,
                    maxItems: 7,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        day: { type: "string", description: "Mon/Tue/Wed/Thu/Fri/Sat/Sun" },
                        focus: { type: "string", description: "Session focus or 'Rest'" },
                        duration_min: { type: "integer" },
                        blocks: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              name: { type: "string" },
                              sets: { type: "integer" },
                              reps: { type: "string" },
                              rpe: { type: "number" },
                              notes: { type: "string" },
                            },
                            required: ["name", "sets", "reps", "notes"],
                          },
                        },
                        conditioning: { type: "string" },
                      },
                      required: ["day", "focus", "duration_min", "blocks"],
                    },
                  },
                  nutrition: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      protein_g_per_kg: { type: "number" },
                      daily_kcal_band: { type: "string" },
                      notes: { type: "string" },
                    },
                    required: ["protein_g_per_kg", "daily_kcal_band", "notes"],
                  },
                  recovery: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      sleep_target_h: { type: "number" },
                      mobility_min: { type: "integer" },
                      breathwork: { type: "string" },
                    },
                    required: ["sleep_target_h", "mobility_min", "breathwork"],
                  },
                },
                required: ["week", "theme", "days", "nutrition", "recovery"],
              },
            },
          },
          required: ["weeks", "weekly_check_targets"],
        },
      },
      required: ["ai_summary", "plan"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Premium gate
    const { data: isPremium } = await supabase.rpc("has_premium", { _user_id: userId });
    if (!isPremium) {
      return new Response(JSON.stringify({ error: "Premium membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const goal = String(body?.goal ?? "").slice(0, 80);
    const experience = String(body?.experience ?? "").slice(0, 40);
    const days_per_week = Math.min(7, Math.max(2, Number(body?.days_per_week ?? 4)));
    const equipment = String(body?.equipment ?? "bodyweight").slice(0, 80);
    const constraints = String(body?.constraints ?? "").slice(0, 400);
    const body_focus: string[] = Array.isArray(body?.body_focus)
      ? body.body_focus.slice(0, 8).map((s: any) => String(s).slice(0, 40))
      : [];

    if (!goal || !experience) {
      return new Response(JSON.stringify({ error: "goal and experience required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull last 30d check-in averages for context
    const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: checks } = await supabase
      .from("daily_checkins")
      .select("workout, sleep_hours, hydration_liters, protein_intake")
      .eq("user_id", userId)
      .gte("checked_in_at", monthAgo);

    const n = checks?.length ?? 0;
    const avgSleep = n ? (checks!.reduce((s, c: any) => s + Number(c.sleep_hours ?? 0), 0) / n).toFixed(1) : "n/a";
    const avgHydr = n ? (checks!.reduce((s, c: any) => s + Number(c.hydration_liters ?? 0), 0) / n).toFixed(1) : "n/a";
    const wkts = n ? checks!.filter((c: any) => c.workout).length : 0;

    const systemPrompt = `You are W Coach, an elite digital personal trainer.
Design a structured, progressive 4-week program tailored to the user's goal, experience and equipment.
Be specific, prescriptive, and conservative on volume. Use RPE 6–9 for working sets.
For rest days set focus = "Rest", duration_min = 0, blocks = [].
Distribute training across exactly ${days_per_week} active day(s) per week, the rest are Rest days.
Include light mobility/breathwork on rest days inside the recovery field, not as blocks.
Always emit the program via the emit_program tool.`;

    const userPrompt = `User profile:
- Goal: ${goal}
- Experience: ${experience}
- Available days/week: ${days_per_week}
- Equipment: ${equipment}
- Body focus emphasis: ${body_focus.join(", ") || "balanced"}
- Constraints / injuries: ${constraints || "none stated"}

Last 30 days check-in averages:
- Workouts logged: ${wkts}
- Avg sleep: ${avgSleep} h
- Avg hydration: ${avgHydr} L

Generate a 4-week block with progressive overload. Week 1 = foundation, Week 2 = build, Week 3 = push, Week 4 = consolidate/deload.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_program" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned:", JSON.stringify(aiJson).slice(0, 500));
      return new Response(JSON.stringify({ error: "Coach failed to draft a program" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid program JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supersede previous active program
    await supabase
      .from("coach_programs")
      .update({ status: "superseded" })
      .eq("user_id", userId)
      .eq("status", "active");

    const { data: inserted, error: insertErr } = await supabase
      .from("coach_programs")
      .insert({
        user_id: userId,
        goal,
        experience,
        days_per_week,
        equipment,
        body_focus,
        constraints,
        plan_json: parsed.plan,
        ai_summary: parsed.ai_summary,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ program: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-generate-program error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
