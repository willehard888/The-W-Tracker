/**
 * life-os-brief — Structured daily Life OS plan for the W Coach.
 *
 * Generates a 5-domain brief (Body · Recovery · Fuel · Mind · Adjustment)
 * using the Lovable AI Gateway. Cached once per user per calendar day in
 * coach_life_os_briefs. Pass { force: true } in the request body to regenerate.
 *
 * Auth: caller must supply a valid Supabase JWT (Authorization: Bearer …).
 * Access: active Elite / trial membership required (has_active_access RPC).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildPersonaBlock, buildHolisticContext } from "../_shared/coach-persona.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Domain {
  action: string; // ≤10 words imperative
  detail: string; // ≤18 words why/how
}

interface LifeOSBrief {
  focus: string;         // ≤7 words — day's core theme
  why: string;           // 1 sentence rationale
  body: Domain;          // Training / movement
  recovery: Domain;      // Sleep / rest / HRV
  fuel: Domain;          // Nutrition
  mind: Domain;          // Stress / focus / mindset
  adjustment: {
    label: "push" | "hold" | "deload" | "swap";
    detail: string;      // Context-specific note ≤18 words
    readiness: number;   // 0–100
  };
}

// Voice-only nuance — persona itself lives in ../_shared/coach-persona.ts.

const todayISO = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON       = Deno.env.get("SUPABASE_ANON_KEY")!;
    const AI_KEY     = Deno.env.get("OPENROUTER_API_KEY");
    if (!AI_KEY) return json({ error: "AI gateway not configured" }, 500);

    const sb = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });

    const { data: ud } = await sb.auth.getUser();
    if (!ud?.user) return json({ error: "Unauthorized" }, 401);
    const uid  = ud.user.id;
    const date = todayISO();

    // Access gate
    const { data: hasAccess } = await sb.rpc("has_active_access" as any, { _user_id: uid });
    if (!hasAccess) return json({ error: "Active membership required" }, 403);

    // Body
    const { force = false } = await req.json().catch(() => ({}));

    // Serve cached brief if it exists for today (unless forced)
    if (!force) {
      const { data: cached } = await sb
        .from("coach_life_os_briefs" as any)
        .select("*")
        .eq("user_id", uid)
        .eq("brief_date", date)
        .maybeSingle();
      if (cached) return json({ brief: cached, cached: true });
    }

    // ── Gather context ───────────────────────────────────────────────────────
    const sevenAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [profileRes, athleteRes, checkinsRes, planRes] = await Promise.all([
      sb.from("profiles")
        .select("username, streak, longest_streak, level, xp, status_tier")
        .eq("user_id", uid).maybeSingle(),
      sb.from("coach_athlete_profile" as any)
        .select("*")
        .eq("user_id", uid).maybeSingle(),
      sb.from("daily_checkins")
        .select("checked_in_at, sleep_hours, workout, protein_intake, healthy_food, hydration_liters, cold_shower, meditation_am, no_phone_morning, xp_earned")
        .eq("user_id", uid)
        .gte("checked_in_at", sevenAgo)
        .order("checked_in_at", { ascending: false })
        .limit(7),
      sb.from("coach_daily_plans" as any)
        .select("readiness_score, adjustment, headline")
        .eq("user_id", uid)
        .eq("plan_date", date)
        .maybeSingle(),
    ]);

    const profile  = profileRes.data  ?? {} as any;
    const athlete  = athleteRes.data  ?? {} as any;
    const checkins = (checkinsRes.data ?? []) as any[];
    const plan     = planRes.data     ?? null as any;

    // Quick derived stats
    const sleepVals    = checkins.map(c => Number(c.sleep_hours ?? 0)).filter(v => v > 0);
    const avgSleep     = sleepVals.length
      ? (sleepVals.reduce((s, v) => s + v, 0) / sleepVals.length).toFixed(1)
      : null;
    const lastCheckin  = checkins[0] ?? {};
    const workouts7d   = checkins.filter(c => c.workout).length;
    const protein7d    = checkins.filter(c => c.protein_intake).length;
    const healthyFood7d = checkins.filter(c => c.healthy_food).length;
    const readiness    = plan?.readiness_score ?? null;
    const planAdj      = plan?.adjustment ?? null;

    // ── Prompt construction ──────────────────────────────────────────────────
    const athleteCtx = [
      athlete.i_am           && `Self-description: "${athlete.i_am}"`,
      athlete.primary_goal   && `Primary goal: ${athlete.primary_goal}`,
      athlete.secondary_goal && `Secondary goal: ${athlete.secondary_goal}`,
      athlete.age            && athlete.sex && `${athlete.age}yo ${athlete.sex}`,
      athlete.weight_kg      && `Weight: ${athlete.weight_kg}kg`,
      athlete.wake_time      && `Wake: ${athlete.wake_time}, bedtime: ${athlete.sleep_time ?? "unknown"}`,
      athlete.training_days_pref?.length && `Trains: ${athlete.training_days_pref.length} days/week`,
      athlete.preferred_session_length_min && `Session length: ${athlete.preferred_session_length_min} min`,
      athlete.dietary?.length && `Dietary: ${athlete.dietary.join(", ")}`,
      athlete.injuries?.length && `Injuries/limits: ${athlete.injuries.join(", ")}`,
    ].filter(Boolean).join(" | ") || "No athlete profile yet";

    const dataCtx = [
      `Streak: ${profile.streak ?? 0}d (best: ${profile.longest_streak ?? 0}d)`,
      avgSleep    && `Avg sleep 7d: ${avgSleep}h`,
      lastCheckin.sleep_hours && `Last night: ${lastCheckin.sleep_hours}h sleep`,
      `Workouts this week: ${workouts7d}/7`,
      `Protein days: ${protein7d}/7`,
      `Healthy meals: ${healthyFood7d}/7`,
      readiness   != null && `Readiness score today: ${readiness}/100`,
      planAdj     && `AI adjustment today: ${planAdj}`,
    ].filter(Boolean).join(" | ");

    const personaBlock = buildPersonaBlock(athlete, undefined, {
      firstName: athlete.i_am ?? profile.username ?? "the athlete",
    });
    const holisticBlock = buildHolisticContext(athlete);
    const highChronicStress = (athlete.stress_baseline ?? 0) >= 4;

    const systemPrompt = `${personaBlock}

${holisticBlock}

Your task right now: generate today's Life OS brief — 5 domain cards (body / recovery / fuel / mind / adjustment) plus a single-line focus.

STRICT RULES:
• "focus"     — ≤7 words, today's single headline theme. ${highChronicStress ? "Chronic stress is high (≥4/5) — the focus MUST be a 'subtract one thing' framing, not an 'add'." : "Frame it as a verb the user can act on."}
• "why"       — 1 sentence, the evidence-based rationale, referencing one specific data point.
• "action"    — ≤10 words, imperative, specific and doable TODAY. Never generic.
• "detail"    — ≤18 words, explain the HOW or WHY briefly.
• The "mind" card AND the "adjustment.detail" MUST reference at least one of: a mental-health focus area, a hobby, or the life_context string. Make it personal — never generic mindfulness clichés.
• "adjustment.label" — one of: push | hold | deload | swap.
• "adjustment.readiness" — integer 0–100 matching the data (use readiness score if available).
• Never say "eat healthy", "sleep well", "stay motivated" — always name the exact action.
• Output ONLY valid JSON. No markdown fences, no explanatory text.`;

    const userPrompt = `Athlete context:
${athleteCtx}

Recent performance data:
${dataCtx}

Generate a Life OS brief in this exact JSON shape (no extra keys):
{
  "focus": "",
  "why": "",
  "body":     { "action": "", "detail": "" },
  "recovery": { "action": "", "detail": "" },
  "fuel":     { "action": "", "detail": "" },
  "mind":     { "action": "", "detail": "" },
  "adjustment": { "label": "hold", "detail": "", "readiness": 70 }
}`;

    // ── AI call ──────────────────────────────────────────────────────────────
    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:       "google/gemini-2.5-flash",
        temperature: 0.35,
        max_tokens:  600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("life-os-brief AI error", aiResp.status, txt.slice(0, 200));
      if (aiResp.status === 429) return json({ error: "Rate limited — try again in a moment" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted"                 }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiResp.json();
    const raw = (aiData?.choices?.[0]?.message?.content ?? "").trim();

    // Parse JSON — strip markdown fences if the model adds them
    let brief: LifeOSBrief;
    try {
      const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      brief = JSON.parse(clean);
    } catch (e) {
      console.error("Failed to parse AI JSON:", raw.slice(0, 300));
      // Fallback brief so the UI always has something to show
      brief = {
        focus:      "Stay consistent today",
        why:        "Consistency compounds — one good day builds the next.",
        body:       { action: "Complete your scheduled session",           detail: "Even 20 min is better than zero. Show up." },
        recovery:   { action: "Sleep at your usual bedtime tonight",       detail: "±30 min variance wrecks sleep quality over time." },
        fuel:       { action: "Hit protein target at every meal",          detail: "1.6 g/kg/day supports muscle and recovery equally." },
        mind:       { action: "5 min box breathing before bed",            detail: "4-4-4-4 cadence lowers cortisol and speeds sleep onset." },
        adjustment: { label: "hold", detail: "Maintain current load — consistent baseline beats random intensity.", readiness: readiness ?? 70 },
      };
    }

    // ── Persist to DB ────────────────────────────────────────────────────────
    const row = {
      user_id:      uid,
      brief_date:   date,
      focus:        brief.focus      ?? "",
      why:          brief.why        ?? "",
      body:         brief.body       ?? {},
      recovery:     brief.recovery   ?? {},
      fuel:         brief.fuel       ?? {},
      mind:         brief.mind       ?? {},
      adjustment:   brief.adjustment ?? {},
      generated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await (sb as any)
      .from("coach_life_os_briefs")
      .upsert(row, { onConflict: "user_id,brief_date" });

    if (upsertErr) {
      // Non-fatal — return the brief even if caching fails
      console.error("life-os-brief upsert error:", upsertErr.message);
    }

    return json({ brief: row, cached: false });
  } catch (e) {
    console.error("life-os-brief unhandled:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
