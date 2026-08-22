import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeWhealthIndexDetailed,
  type WhealthInputs,
  type CheckinDay,
  type NightRow,
  type DayRow,
  type ReflectionRow,
  type WhealthResultDetailed,
} from "@/lib/whealth-index";

// LIVE Whealth Index — the same pure core the nightly coach-insights engine
// runs, executed client-side over the user's own data (everything here is
// own-row RLS / auth.uid() RPCs). The index moves the moment you check in,
// instead of waiting for the 03:15 UTC cron.

const habitDone = (row: Record<string, unknown>, legacyKeys: string[], habitKeys: string[]): boolean => {
  for (const k of legacyKeys) if (row[k] === true) return true;
  const h = (row.habits ?? {}) as Record<string, unknown>;
  for (const k of habitKeys) if (h[k] === true) return true;
  return false;
};

async function gatherLiveInputs(userId: string): Promise<WhealthInputs> {
  const since = new Date(Date.now() - 28 * 86400_000).toISOString();
  const sinceDay = since.slice(0, 10);
  const db = supabase as never as { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown }> };

  const [checkinsR, nightsR, daysR, reflR, lessonsR, lessonsTotalR, liftsR, tribesR, friendsR, athleteR] =
    await Promise.all([
      supabase
        .from("daily_checkins")
        .select("checked_in_at, sleep_hours, hydration_liters, workout, meditation_morning, meditation_evening, protein_intake, healthy_food, no_phone_morning, no_phone_evening, journal_entry, habits, verified_at")
        .eq("user_id", userId).gte("checked_in_at", since).order("checked_in_at", { ascending: true }),
      db.rpc("recent_night_metrics", { p_days: 28 }),
      supabase
        .from("health_sync_snapshots")
        .select("snapshot_date, steps, active_kcal, workout_minutes, mindful_minutes")
        .eq("user_id", userId).gte("snapshot_date", sinceDay),
      supabase
        .from("coach_reflections")
        .select("reflection_date, energy_1to5, mood_1to5, win, friction")
        .eq("user_id", userId).gte("reflection_date", sinceDay),
      supabase.from("vault_lesson_progress").select("quiz_score").eq("user_id", userId),
      supabase.from("vault_articles").select("id", { count: "exact", head: true }),
      db.rpc("recent_workout_logs", { p_limit: 120 }),
      supabase.from("tribe_members").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("friendships").select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).eq("status", "accepted"),
      supabase.from("coach_athlete_profile").select("i_am").eq("user_id", userId).maybeSingle(),
    ]);

  const checkins: CheckinDay[] = ((checkinsR.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    day: String(c.checked_in_at).slice(0, 10),
    sleepHours: c.sleep_hours != null ? Number(c.sleep_hours) : null,
    hydration: c.hydration_liters != null ? Number(c.hydration_liters) : null,
    workout: c.workout === true || habitDone(c, [], ["workout"]),
    meditation: habitDone(c, ["meditation_morning", "meditation_evening"], ["meditation", "meditation_pm"]),
    protein: habitDone(c, ["protein_intake"], ["protein"]),
    healthyFood: habitDone(c, ["healthy_food"], ["healthy_food"]),
    noPhone: habitDone(c, ["no_phone_morning", "no_phone_evening"], ["no_phone_am", "no_phone_pm"]),
    journal: typeof c.journal_entry === "string" && c.journal_entry.trim().length > 0,
    verified: c.verified_at != null,
  }));

  const nights: NightRow[] = ((Array.isArray(nightsR.data) ? nightsR.data : []) as Array<Record<string, unknown>>).map((n) => ({
    day: String(n.night_date),
    restingHr: n.resting_hr != null ? Number(n.resting_hr) : null,
    hrvSdnn: n.hrv_sdnn != null ? Number(n.hrv_sdnn) : null,
    respRate: n.respiratory_rate != null ? Number(n.respiratory_rate) : null,
    sleepTotalMin: n.sleep_total_min != null ? Number(n.sleep_total_min) : null,
    deepMin: n.sleep_deep_min != null ? Number(n.sleep_deep_min) : null,
    remMin: n.sleep_rem_min != null ? Number(n.sleep_rem_min) : null,
    sleepStart: n.sleep_start != null ? String(n.sleep_start) : null,
  }));

  const days: DayRow[] = ((daysR.data ?? []) as Array<Record<string, unknown>>).map((d) => ({
    day: String(d.snapshot_date),
    steps: d.steps != null ? Number(d.steps) : null,
    activeKcal: d.active_kcal != null ? Number(d.active_kcal) : null,
    workoutMinutes: d.workout_minutes != null ? Number(d.workout_minutes) : null,
    mindfulMinutes: d.mindful_minutes != null ? Number(d.mindful_minutes) : null,
  }));

  const reflections: ReflectionRow[] = ((reflR.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    day: String(r.reflection_date),
    energy: r.energy_1to5 != null ? Number(r.energy_1to5) : null,
    mood: r.mood_1to5 != null ? Number(r.mood_1to5) : null,
    hasWin: typeof r.win === "string" && r.win.trim().length > 0,
    hasFriction: typeof r.friction === "string" && r.friction.trim().length > 0,
  }));

  // Lift progression — identical PR/stall logic to coach-insights.
  const e1rm = (w: number, r: number) => w * (1 + r / 30);
  const byExercise = new Map<string, number[]>();
  for (const row of (Array.isArray(liftsR.data) ? liftsR.data : []) as Array<Record<string, unknown>>) {
    const key = String(row.exercise_slug ?? row.exercise_name ?? "");
    if (!key || row.weight == null) continue;
    const v = e1rm(Number(row.weight), Number(row.reps ?? 1));
    (byExercise.get(key) ?? byExercise.set(key, []).get(key)!).push(v);
  }
  let prs = 0, stalls = 0;
  for (const sets of byExercise.values()) {
    if (sets.length < 2) continue;
    const latest = sets[0]; // recent_workout_logs is newest-first
    const priorBest = Math.max(...sets.slice(1));
    if (latest >= priorBest * 1.01) prs++;
    else if (latest <= priorBest * 0.97) stalls++;
  }

  const quizScores = ((lessonsR.data ?? []) as Array<{ quiz_score: number | null }>)
    .map((l) => l.quiz_score)
    .filter((q): q is number => q != null);

  return {
    checkins, nights, days, reflections,
    // Habits live in the check-in now: streaks = consecutive logged days
    // (ending on the latest check-in) for each Core 4 habit.
    habitStreaks: (["sleep", "workout", "hydration", "meditation"] as const).map((k) => {
      let run = 0;
      for (let i = checkins.length - 1; i >= 0; i--) {
        const c = checkins[i];
        const ok = k === "sleep" ? (c.sleepHours != null && c.sleepHours >= 7.5 && c.sleepHours <= 9)
          : k === "workout" ? c.workout
          : k === "hydration" ? (c.hydration != null && c.hydration >= 3)
          : c.meditation;
        if (!ok) break;
        run++;
      }
      return run;
    }),
    lessonsCompleted: (lessonsR.data ?? []).length,
    lessonsTotal: lessonsTotalR.count ?? 0,
    avgQuizScore: quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : null,
    liftPrs: prs, liftStalls: stalls, liftCount: byExercise.size,
    tribeCount: tribesR.count ?? 0,
    friendCount: friendsR.count ?? 0,
    iAmSet: !!(athleteR.data?.i_am && String(athleteR.data.i_am).trim().length > 0),
  };
}

/** Live Whealth Index computed on-device from the user's own data. */
export const useLiveWhealthIndex = () => {
  const { user } = useAuth();
  return useQuery<WhealthResultDetailed>({
    queryKey: ["whealth-live", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => computeWhealthIndexDetailed(await gatherLiveInputs(user!.id)),
  });
};
