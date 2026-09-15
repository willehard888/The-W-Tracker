// coach-build-session — today's session for the muscles the athlete picked,
// built in a moment from the same safe, drawable pool the 4-week generator
// uses. No model call. `commit: false` previews; `commit: true` stores a
// one-day program row (status "session") the runner can open. The active
// 4-week program is never touched.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSession, sessionPlan, FOCUSES, type Focus } from "../_shared/session-builder.ts";
import { normalizeInjuries } from "../_shared/injuries.ts";
import { clampTzOffset, localDayKey, localWeekday } from "../_shared/local-day.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    const day = buildSession({
      focus,
      minutes,
      goal: profile.primary_goal,
      experience: profile.training_experience,
      equipment: Array.isArray(profile.equipment) ? profile.equipment : [],
      injuries,
      seed,
    });
    if (day.blocks.length < 2) {
      return json({ error: "Not enough safe movements for that pick — try another muscle group or more equipment" }, 422);
    }

    if (!body?.commit) return json({ day, dayIndex });

    if (!SERVICE_KEY) return json({ error: "Server not configured" }, 500);
    // Service role for the insert: the table's INSERT policy predates the
    // trial and the athlete has already passed has_active_access above.
    const service = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
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
