// coach-generate-program — Premium-only. Designs a fully personalized 4-week program
// using the user's athlete profile, last 30d check-ins, last 14d reflections and active goals.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildAllowedMovementCatalog,
  filterMovements,
  normalizeEquipment,
  normalizeInjuries,
  validateProgram,
} from "./movements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "emit_program",
    description: "Emit a structured, personalized 4-week training, recovery and nutrition program.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        ai_summary: {
          type: "string",
          description:
            "3–4 sentence coach overview written in the user's preferred tone. Address the athlete directly, name the goal, the periodization choice, and the single biggest leverage point.",
        },
        coach_signature: {
          type: "string",
          description: "One short closing line in the coach's voice. Max 90 chars.",
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
                  progression_note: {
                    type: "string",
                    description:
                      "1–2 sentences explaining what changes vs the previous week (load, density, volume, intent) and why.",
                  },
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
                        warmup: {
                          type: "string",
                          description: "3–5 min specific warm-up. Empty string for rest days.",
                        },
                        cooldown: {
                          type: "string",
                          description: "2–5 min cooldown / mobility. Empty string for rest days.",
                        },
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
                              rest_sec: { type: "integer", description: "Rest between sets in seconds." },
                              tempo: {
                                type: "string",
                                description: "Eccentric-pause-concentric-pause, e.g. '3-1-1-0'. Empty if not relevant.",
                              },
                              alt: {
                                type: "string",
                                description:
                                  "One swap option that respects the user's equipment + injuries. Empty string if not needed.",
                              },
                              notes: { type: "string" },
                            },
                            required: ["name", "sets", "reps", "rest_sec", "tempo", "alt", "notes"],
                          },
                        },
                        conditioning: { type: "string" },
                      },
                      required: ["day", "focus", "duration_min", "warmup", "cooldown", "blocks"],
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
                required: ["week", "theme", "progression_note", "days", "nutrition", "recovery"],
              },
            },
          },
          required: ["weeks", "weekly_check_targets"],
        },
      },
      required: ["ai_summary", "coach_signature", "plan"],
    },
  },
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  calm_mentor: "Calm, precise mentor. Steady, supportive, unhurried. No hype.",
  drill_sergeant: "Direct drill sergeant. Short. No excuses. Command voice.",
  scientist: "Scientist. Cite mechanisms briefly (e.g. mechanical tension, RPE management). Numbers over feelings.",
  hype: "High-energy hype coach. Punchy. Momentum-building. Never cheesy.",
};

const GOAL_PERIODIZATION: Record<string, string> = {
  all: "Concurrent block: full-body strength + hypertrophy + 1–2 conditioning slots. Balance over specialization.",
  strength: "Linear strength block. 3–6 reps on main lifts, RPE 7–8.5, longer rests, week 4 = light testing/deload.",
  hypertrophy: "DUP hypertrophy: alternate moderate (8–12) and high-rep (12–20) days, RPE 7–9, short-medium rests.",
  fat_loss: "Hybrid block: keep strength stimulus 2–3×/wk (RPE 7), add 2 conditioning sessions, daily NEAT target.",
  endurance: "Aerobic base + tempo + intervals. Strength 2× as support. Manage HR zones.",
  longevity: "Movement-first. Zone 2 cardio 2×, strength 2× (RPE 6–7), mobility daily.",
  focus: "Lower-volume training to protect cognition. AM cardio or strength, PM mobility/breathwork.",
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

    const { data: isPremium } = await supabase.rpc("has_premium", { _user_id: userId });
    if (!isPremium) {
      return new Response(JSON.stringify({ error: "Premium membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Pull full personal context ───────────────────────────────────────────
    const [profileRes, checksRes, reflectionsRes, goalsRes] = await Promise.all([
      supabase.from("coach_athlete_profile").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("daily_checkins")
        .select("workout, sleep_hours, hydration_liters, protein_intake")
        .eq("user_id", userId)
        .gte("checked_in_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      supabase
        .from("coach_reflections")
        .select("rpe_1to10, energy_1to5, sleep_quality_1to5, mood_1to5, friction")
        .eq("user_id", userId)
        .gte("reflection_date", new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)),
      supabase
        .from("coach_goals")
        .select("title, metric, unit, baseline_value, current_value, target_value, deadline")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

    const profile: any = profileRes.data;
    if (!profile?.onboarded) {
      return new Response(JSON.stringify({ error: "Complete athlete profile first" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block-specific inputs (only thing we trust from client)
    const body = await req.json().catch(() => ({}));
    const body_focus: string[] = Array.isArray(body?.body_focus)
      ? body.body_focus.slice(0, 8).map((s: any) => String(s).slice(0, 40))
      : [];
    const block_notes = String(body?.block_notes ?? "").slice(0, 280);

    // Derive context from profile
    const goal = String(profile.primary_goal ?? "all");
    const secondary_goal = profile.secondary_goal ? String(profile.secondary_goal) : null;
    const days_per_week = Math.max(2, Math.min(7, (profile.training_days_pref ?? []).length || 4));
    const session_min = Math.max(15, Math.min(180, profile.preferred_session_length_min ?? 45));
    const equipment_arr: string[] = profile.equipment ?? [];
    const equipment = equipment_arr.length ? equipment_arr.join(", ") : "Bodyweight only";
    const injuries: string[] = profile.injuries ?? [];
    const dietary: string[] = profile.dietary ?? [];
    const tone = String(profile.tone_pref ?? "calm_mentor");
    const horizon = profile.target_horizon_weeks ?? 12;

    // Map training_days_pref ints → day names. profile uses 0=Sun..6=Sat.
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const train_days = (profile.training_days_pref ?? [1, 2, 4, 5])
      .map((n: number) => DAY_NAMES[n])
      .join(", ");

    // Aggregate check-ins
    const checks = checksRes.data ?? [];
    const n = checks.length;
    const avgSleep = n
      ? (checks.reduce((s: number, c: any) => s + Number(c.sleep_hours ?? 0), 0) / n).toFixed(1)
      : "n/a";
    const avgHydr = n
      ? (checks.reduce((s: number, c: any) => s + Number(c.hydration_liters ?? 0), 0) / n).toFixed(1)
      : "n/a";
    const wkts = checks.filter((c: any) => c.workout).length;
    const proteinHits = checks.filter((c: any) => c.protein_intake).length;

    // Aggregate reflections
    const refs = reflectionsRes.data ?? [];
    const r = refs.length;
    const avg = (k: string) =>
      r ? (refs.reduce((s: number, x: any) => s + Number(x[k] ?? 0), 0) / r).toFixed(1) : "n/a";
    const avgRpe = avg("rpe_1to10");
    const avgEnergy = avg("energy_1to5");
    const avgSleepQ = avg("sleep_quality_1to5");
    const avgMood = avg("mood_1to5");
    const frictions = refs
      .map((x: any) => (x.friction ?? "").toString().trim())
      .filter(Boolean)
      .slice(0, 6);

    const goals = (goalsRes.data ?? []).map((g: any) =>
      `- ${g.title}: ${g.current_value ?? "?"} → ${g.target_value} ${g.unit ?? ""}${g.deadline ? ` by ${g.deadline}` : ""}`,
    );

    const periodization = GOAL_PERIODIZATION[goal] ?? GOAL_PERIODIZATION.all;
    const toneRule = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.calm_mentor;

    // ── Prompts ──────────────────────────────────────────────────────────────
    const systemPrompt = `You are W Coach — a senior strength & conditioning coach with 20 years of experience.
You design programs that real coaches would sign off on. Every prescription is specific, not generic.

VOICE: ${toneRule}

NON-NEGOTIABLES:
- Schedule training sessions ONLY on these weekdays: ${train_days}. Every other day must be focus="Rest", duration_min=0, blocks=[].
- duration_min must be ≤ ${session_min} on every training day.
- For each injury in the athlete profile, NEVER prescribe contraindicated movements. Always provide a safe "alt" swap respecting their actual equipment.
- Use ONLY equipment the athlete actually has: ${equipment}.
- Periodization model for this goal: ${periodization}
- Week 4: deload (volume −40%, RPE −1) ONLY if recent avg RPE > 8 OR avg sleep < 6.5 OR avg energy ≤ 2. Otherwise week 4 = consolidation/test week with PR opportunity.
- Every working set: prescribe sets, reps, RPE (6–9), rest_sec, and tempo (use "" if tempo isn't meaningful for that movement, e.g. running).
- Provide a per-day warmup (3–5 min, specific to the focus) and cooldown (2–5 min). Empty strings on rest days.
- Per-week progression_note: explain WHAT changed vs prior week (load %, set count, density, intent) and WHY.
- ai_summary must be in the athlete's voice/tone preference and reference their actual goal and a real personal datapoint from below.
- coach_signature: one short closing sentence in the same voice.

EMIT VIA THE emit_program TOOL. Never reply in plain text.`;

    const userPrompt = `ATHLETE
- Identity: ${profile.i_am || "n/a"}
- Sex/Age: ${profile.sex ?? "n/a"} / ${profile.age ?? "n/a"} yrs
- Body: ${profile.height_cm ?? "?"} cm, ${profile.weight_kg ?? "?"} kg${profile.body_fat_pct ? `, ${profile.body_fat_pct}% BF` : ""}
- Primary goal: ${goal}${secondary_goal ? ` · Secondary: ${secondary_goal}` : ""}
- Horizon: ${horizon} weeks
- Sleep window: ${profile.sleep_time?.slice(0, 5) ?? "23:00"} → ${profile.wake_time?.slice(0, 5) ?? "07:00"}
- Preferred training days: ${train_days} (${days_per_week}/week)
- Preferred session length cap: ${session_min} min
- Equipment available: ${equipment}
- Injuries / no-go zones: ${injuries.length ? injuries.join(", ") : "none reported"}
- Dietary: ${dietary.length ? dietary.join(", ") : "no restrictions"}
- Voice preference: ${tone}

THIS BLOCK
- Body emphasis: ${body_focus.length ? body_focus.join(", ") : "balanced"}
- Athlete notes for this block: ${block_notes || "none"}

ACTIVE GOALS
${goals.length ? goals.join("\n") : "- (none set)"}

LAST 30 DAYS (check-ins, n=${n})
- Workouts logged: ${wkts}
- Avg sleep: ${avgSleep} h
- Avg hydration: ${avgHydr} L
- Days hitting protein target: ${proteinHits}/${n}

LAST 14 DAYS (reflections, n=${r})
- Avg RPE: ${avgRpe}/10
- Avg energy: ${avgEnergy}/5
- Avg sleep quality: ${avgSleepQ}/5
- Avg mood: ${avgMood}/5
- Recurring frictions: ${frictions.length ? frictions.join(" | ") : "none reported"}

DESIGN A 4-WEEK BLOCK that progressively pushes this athlete toward their goal, respects every constraint above,
explains the progression each week, and includes warm-up, cooldown, rest, tempo, and an injury/equipment-aware
alternative for every working block. Address the athlete in their preferred voice.`;

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

    // Attach coach_signature into plan_json so it travels with the program.
    const planWithSig = { ...parsed.plan, coach_signature: parsed.coach_signature };

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
        experience: "auto",
        days_per_week,
        equipment,
        body_focus,
        constraints: block_notes,
        plan_json: planWithSig,
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
