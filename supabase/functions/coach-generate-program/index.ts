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
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
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

    // Movement catalog grounded to this athlete
    const eqSet = normalizeEquipment(equipment_arr);
    const injSet = normalizeInjuries(injuries);
    const allowedMovements = filterMovements(eqSet, injSet);
    const allowedNames = new Set(allowedMovements.map((m) => m.name));
    const catalogText = buildAllowedMovementCatalog(allowedMovements);
    const trainDayNames: string[] = (profile.training_days_pref ?? [1, 2, 4, 5]).map((n: number) => DAY_NAMES[n]);

    // ── Prompts ──────────────────────────────────────────────────────────────
    const systemPrompt = `You are W Coach — a senior strength & conditioning coach with 20 years of experience.
You design programs that real coaches would sign off on. Every prescription is specific, not generic.

VOICE: ${toneRule}

HARD CONSTRAINTS (violating any of these is a failure):
- Schedule training sessions ONLY on these weekdays: ${train_days}. Every other day must be focus="Rest", duration_min=0, blocks=[].
- duration_min must be ≤ ${session_min} on every training day.
- You may ONLY pick movement "name" values from the allowed catalog below — exact spelling. Never invent movements.
- Same primary (first-block) movement cannot appear on two consecutive training days within a week.
- Never prescribe contraindicated movements; the catalog already excludes them. For each working block also provide a sensible "alt" from the same allowed catalog.

PROGRAM DESIGN RULES:
- Periodization model for this goal: ${periodization}
- Pattern coverage per training week: include at minimum squat, hinge, a horizontal push, a horizontal pull, a vertical push OR vertical pull, and one core/anti pattern. Add lunge/carry/rotation when ≥4 days/wk.
- Week 4: deload (volume −40%, RPE −1) ONLY if recent avg RPE > 8 OR avg sleep < 6.5 OR avg energy ≤ 2. Otherwise week 4 = consolidation/test week with ONE PR or AMRAP opportunity on the main lift.
- Conditioning across the 4 weeks should rotate styles (e.g. Z2, threshold, VO2, finisher complex, mobility flow) — do not prescribe the same style every week.
- Every working set: prescribe sets, reps, RPE (6–9), rest_sec, and tempo (use "" if tempo isn't meaningful, e.g. running).
- Per-exercise progression: for the 1–2 main lifts of each session, write the next-week progression in "notes" using a concrete delta (e.g. "+2.5 kg top set", "+1 rep across all sets", "−10s rest", "RPE +0.5").
- Per-day warmup: 3–5 min including (a) a general RAMP (raise/activate/mobilize/potentiate) and (b) 2–3 ramp sets of the day's main lift at 40/60/80%.
- Per-day cooldown: 2–5 min mobility specific to what was trained.
- Per-week progression_note: explicitly describe WHAT changed vs prior week (load %, sets, density, intent) and WHY in 1–2 sentences.
- ai_summary: 3–4 sentences in the athlete's preferred voice, naming their goal AND one real datapoint from the data block.
- coach_signature: one short closing sentence in the same voice (≤90 chars).
- weekly_check_targets must be realistic given days_per_week and current trailing averages.

ALLOWED MOVEMENT CATALOG (name → typical reps, rest, tempo):
${catalogText}

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

DESIGN A 4-WEEK BLOCK that progressively pushes this athlete toward their goal, respects every hard constraint,
explains the progression each week, and includes warm-up, cooldown, rest, tempo, and an injury/equipment-aware
alternative for every working block. Address the athlete in their preferred voice.`;

    // ── Generate (with one auto-retry on validation failure) ─────────────────
    const callAi = async (corrections: string[]): Promise<{ parsed: any; rawErr?: string }> => {
      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];
      if (corrections.length) {
        messages.push({
          role: "user",
          content: `Your previous draft failed validation. Fix exactly these issues and resubmit via emit_program:\n- ${corrections.join("\n- ")}`,
        });
      }
      // Hard timeout so a slow generation returns a clear error instead of
      // hanging until the platform/gateway kills it (which surfaces as an
      // opaque "non-2xx" with no body on the client).
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120_000);
      let aiResp: Response;
      try {
        aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // gpt-4o-mini: fast, strong at structured JSON, and far less likely
            // to truncate a full 4-week program than the slower reasoning model.
            model: "openai/gpt-4o-mini",
            messages,
            max_tokens: 16000,
            tools: [TOOL],
            tool_choice: { type: "function", function: { name: "emit_program" } },
          }),
        });
      } catch (err) {
        clearTimeout(timer);
        if ((err as any)?.name === "AbortError") {
          return { parsed: null, rawErr: "AI timed out (>75s). Try again — generation can be heavy." };
        }
        throw err;
      }
      clearTimeout(timer);
      if (!aiResp.ok) {
        if (aiResp.status === 429) throw new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) throw new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await aiResp.text();
        return { parsed: null, rawErr: `AI gateway ${aiResp.status}: ${t.slice(0, 300)}` };
      }
      const aiJson = await aiResp.json();
      const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) return { parsed: null, rawErr: "No tool call returned" };
      try { return { parsed: JSON.parse(toolCall.function.arguments) }; }
      catch { return { parsed: null, rawErr: "Invalid program JSON" }; }
    };

    let parsed: any = null;
    // Single AI attempt only. Two sequential generations blow the edge
    // function's compute budget (WORKER_RESOURCE_LIMIT / 546). And we ACCEPT
    // the program even if validation flags minor issues — a usable plan beats
    // a hard failure for the user.
    let lastErr = "";
    let result;
    try { result = await callAi([]); }
    catch (resp) { return resp as Response; }
    if (result.parsed) {
      parsed = result.parsed;
      // gpt-4o-mini sometimes omits the (schema-required) nutrition/recovery
      // objects. Backfill sensible defaults so the "Week details" panel always
      // has content instead of being an empty/dead control.
      for (const w of (parsed?.plan?.weeks ?? [])) {
        if (!w.nutrition) {
          w.nutrition = {
            protein_g_per_kg: 1.8,
            daily_kcal_band: "Eat at maintenance; slight surplus on training days",
            notes: "Prioritize whole foods, 4–5 protein feedings, hydrate well.",
          };
        }
        if (!w.recovery) {
          w.recovery = {
            sleep_target_h: 8,
            mobility_min: 10,
            breathwork: "5 min slow nasal breathing post-session",
          };
        }
      }
      const violations = validateProgram(result.parsed.plan, {
        trainDayNames,
        sessionMinCap: session_min,
        allowedNames,
      });
      if (violations.length) {
        console.warn("Program validation warnings (accepted anyway):", violations.slice(0, 5));
      }
    } else {
      lastErr = result.rawErr ?? "unknown";
    }

    if (!parsed) {
      console.error("Program generation failed:", lastErr);
      return new Response(JSON.stringify({ error: `Coach couldn't finalize a clean program (${lastErr}). Try again.` }), {
        status: 422,
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
