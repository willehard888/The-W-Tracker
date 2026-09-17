// coach-build-session — today's session for the muscles the athlete picked,
// built in a moment from the same safe, drawable pool the 4-week generator
// uses. No model call. `commit: false` previews; `commit: true` stores a
// one-day program row (status "session") the runner can open. The active
// 4-week program is never touched. `action: "swap"` trades one movement for
// another of the same pattern — in a preview (returns the block) or in a
// stored session (`program_id`: rewrites today's blocks, returns the program).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSession, prescribeSlugs, sessionMinutes, sessionPlan, swapBlock, FEELS, FOCUSES, type Feel, type Focus } from "../_shared/session-builder.ts";
import { normalizeInjuries } from "../_shared/injuries.ts";
import { clampTzOffset, localDayKey, localWeekday } from "../_shared/local-day.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * The one day a stored focus session holds. Found by its content, not by
 * today's weekday: after midnight the index has moved on, and a swap in a
 * session started the evening before answered "not in today's session".
 */
type DayBlocks = { blocks?: { slug: string; sets: number }[] };
const sessionDay = (plan: { weeks?: { days?: DayBlocks[] }[] } | null | undefined, todayIndex: number): DayBlocks | undefined => {
  const days = plan?.weeks?.[0]?.days ?? [];
  return days[todayIndex]?.blocks?.length ? days[todayIndex] : days.find((d) => (d.blocks?.length ?? 0) > 0);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // has_active_access, like the generator: the trial is sold as full access.
    const { data: hasAccess } = await supabase.rpc("has_active_access", { _user_id: userId });
    if (!hasAccess) return json({ error: "Active membership required" }, 403);

    const body = await req.json().catch(() => ({}));
    const focus = [...new Set((Array.isArray(body?.focus) ? body.focus : []) as unknown[])]
      .filter((f): f is Focus => typeof f === "string" && (FOCUSES as string[]).includes(f))
      .slice(0, 3);
    if (focus.length === 0) return json({ error: "Pick at least one muscle group" }, 400);

    const { data: profile } = await supabase
      .from("coach_athlete_profile")
      .select("onboarded, primary_goal, training_experience, equipment, injuries, preferred_session_length_min")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.onboarded) return json({ error: "Complete athlete profile first" }, 400);

    const tz = clampTzOffset(body?.tz_offset_minutes);
    const dayIndex = (localWeekday(tz) + 6) % 7; // 0 = Mon, the runner's convention
    const today = localDayKey(tz);
    const requested = Number(body?.minutes);
    const minutes = Math.min(120, Math.max(20, Number.isFinite(requested) && requested > 0
      ? requested
      : Number(profile.preferred_session_length_min) || 45));
    const seed = `${String(body?.seed ?? today).slice(0, 64)}:${userId}`;
    const injuries = normalizeInjuries(profile.injuries);

    const input = {
      focus,
      minutes,
      goal: profile.primary_goal,
      experience: profile.training_experience,
      equipment: Array.isArray(profile.equipment) ? profile.equipment : [],
      injuries,
      seed,
      // The day's feel (light / normal / hard); old builds send nothing.
      feel: (FEELS as string[]).includes(body?.feel) ? (body.feel as Feel) : undefined,
    };
    const strs = (v: unknown, cap: number) =>
      (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").slice(0, cap);

    if (!SERVICE_KEY) return json({ error: "Server not configured" }, 500);
    // Service role for writes: the table's INSERT policy predates the trial
    // and the athlete has already passed has_active_access above. Every
    // read/write below is still scoped to `user_id = userId`.
    const service = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    if (body?.action === "swap") {
      const current = String(body?.slug ?? "");
      const programId = typeof body?.program_id === "string" ? body.program_id : null;
      let exclude = strs(body?.exclude, 12);
      let sets = Number(body?.sets) || undefined;
      let stored: { plan_json: { weeks?: { days?: { blocks?: { slug: string; sets: number }[] }[] }[] } } | null = null;
      if (programId) {
        const { data } = await service
          .from("coach_programs")
          .select("plan_json")
          .eq("id", programId)
          .eq("user_id", userId)
          .eq("status", "session")
          .maybeSingle();
        if (!data) return json({ error: "Session not found" }, 404);
        stored = data as typeof stored;
        const todays = sessionDay(stored!.plan_json, dayIndex)?.blocks ?? [];
        exclude = todays.map((b) => b.slug);
        sets = todays.find((b) => b.slug === current)?.sets;
      }
      const block = swapBlock({ ...input, current, exclude, sets });
      if (!block) return json({ error: "No other movement fits here — try shuffling the session" }, 422);
      if (!programId || !stored) return json({ block, dayIndex });

      const plan = stored.plan_json;
      const blocks = sessionDay(plan, dayIndex)?.blocks ?? [];
      const at = blocks.findIndex((b) => b.slug === current);
      if (at < 0) return json({ error: "That movement is not in today's session" }, 409);
      blocks[at] = block;
      const { data: program, error: updErr } = await service
        .from("coach_programs")
        .update({ plan_json: plan })
        .eq("id", programId)
        .eq("user_id", userId)
        .select("id, user_id, status, goal, experience, days_per_week, equipment, body_focus, constraints, weeks, plan_json, ai_summary, started_on, created_at")
        .single();
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ block, program, dayIndex });
    }

    let day = buildSession(input);
    // A committed session may carry the athlete's swaps from the preview:
    // re-prescribe the chosen slugs from the same safe pool (anything the
    // pool refuses is dropped, so a hand-edited list can never smuggle a lift).
    const slugs = strs(body?.slugs, 12);
    if (body?.commit && slugs.length) {
      const blocks = prescribeSlugs(slugs, input);
      day = { ...day, blocks, duration_min: sessionMinutes(blocks) };
    }
    if (day.blocks.length < 2) {
      return json({ error: "Not enough safe movements for that pick — try another muscle group or more equipment" }, 422);
    }

    if (!body?.commit) return json({ day, dayIndex });
    const { data: program, error: insErr } = await service
      .from("coach_programs")
      .insert({
        user_id: userId,
        status: "session",
        goal: profile.primary_goal ?? "all",
        experience: profile.training_experience ?? "unknown",
        days_per_week: 1,
        equipment: (Array.isArray(profile.equipment) ? profile.equipment : []).join(", ") || "Full gym",
        body_focus: focus,
        constraints: injuries.size ? `injuries: ${[...injuries].join(", ")}` : null,
        weeks: 1,
        plan_json: sessionPlan(day, dayIndex),
        ai_summary: null,
        generated_with: "session_builder_v1",
        started_on: today,
      })
      .select("id, user_id, status, goal, experience, days_per_week, equipment, body_focus, constraints, weeks, plan_json, ai_summary, started_on, created_at")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ program, dayIndex });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
