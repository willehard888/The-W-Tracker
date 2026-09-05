import type { CheckinDay, DayRow, DiaryDay, NightRow, ReflectionRow, WhealthInputs } from "@/lib/whealth-index";

/**
 * Maps the `whealth_live_inputs()` RPC payload (one jsonb, own-row RLS) onto
 * the pure WhealthInputs the index core consumes. Same mapping the hook used
 * to run over 12 separate queries — kept here so every branch is unit-tested.
 */

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(isRow) : []);
const num = (v: unknown): number | null => (v != null ? Number(v) : null);
const text = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

const habitDone = (row: Row, legacyKeys: string[], habitKeys: string[]): boolean => {
  for (const k of legacyKeys) if (row[k] === true) return true;
  const h = isRow(row.habits) ? row.habits : {};
  for (const k of habitKeys) if (h[k] === true) return true;
  return false;
};

export function mapLiveInputs(raw: unknown): WhealthInputs {
  const p: Row = isRow(raw) ? raw : {};

  const checkins: CheckinDay[] = rows(p.checkins).map((c) => ({
    day: String(c.checked_in_at).slice(0, 10),
    sleepHours: num(c.sleep_hours),
    hydration: num(c.hydration_liters),
    workout: c.workout === true || habitDone(c, [], ["workout"]),
    meditation: habitDone(c, ["meditation_morning", "meditation_evening"], ["meditation", "meditation_pm"]),
    protein: habitDone(c, ["protein_intake"], ["protein"]),
    healthyFood: habitDone(c, ["healthy_food"], ["healthy_food"]),
    noPhone: habitDone(c, ["no_phone_morning", "no_phone_evening"], ["no_phone_am", "no_phone_pm"]),
    journal: text(c.journal_entry),
    verified: c.verified_at != null,
  }));

  const nights: NightRow[] = rows(p.nights).map((n) => ({
    day: String(n.night_date),
    restingHr: num(n.resting_hr),
    hrvSdnn: num(n.hrv_sdnn),
    respRate: num(n.respiratory_rate),
    sleepTotalMin: num(n.sleep_total_min),
    deepMin: num(n.sleep_deep_min),
    remMin: num(n.sleep_rem_min),
    sleepStart: n.sleep_start != null ? String(n.sleep_start) : null,
  }));

  const days: DayRow[] = rows(p.days).map((d) => ({
    day: String(d.snapshot_date),
    steps: num(d.steps),
    activeKcal: num(d.active_kcal),
    workoutMinutes: num(d.workout_minutes),
    mindfulMinutes: num(d.mindful_minutes),
  }));

  const reflections: ReflectionRow[] = rows(p.reflections).map((r) => ({
    day: String(r.reflection_date),
    energy: num(r.energy_1to5),
    mood: num(r.mood_1to5),
    hasWin: text(r.win),
    hasFriction: text(r.friction),
  }));

  // Lift progression — identical PR/stall logic to coach-insights.
  const e1rm = (w: number, r: number) => w * (1 + r / 30);
  const byExercise = new Map<string, number[]>();
  for (const row of rows(p.lifts)) {
    const key = String(row.exercise_slug ?? row.exercise_name ?? "");
    if (!key || row.weight == null) continue;
    const v = e1rm(Number(row.weight), Number(row.reps ?? 1));
    (byExercise.get(key) ?? byExercise.set(key, []).get(key)!).push(v);
  }
  let prs = 0, stalls = 0;
  for (const sets of byExercise.values()) {
    if (sets.length < 2) continue;
    const latest = sets[0]; // lifts are newest-first
    const priorBest = Math.max(...sets.slice(1));
    if (latest >= priorBest * 1.01) prs++;
    else if (latest <= priorBest * 0.97) stalls++;
  }

  const lessons = rows(p.lessons);
  const quizScores = lessons.map((l) => num(l.quiz_score)).filter((q): q is number => q != null);

  // Diary days: meal totals summed per local day, each against the protein
  // target in force that day (targets are newest-first). Mirrors coach-insights.
  const targetRows = rows(p.targets);
  const targetFor = (day: string): number | null => {
    const t = targetRows.find((r) => String(r.effective_from) <= day);
    return t?.protein_g != null && Number(t.protein_g) > 0 ? Number(t.protein_g) : null;
  };
  const dayAgg = new Map<string, { kcal: number; proteinG: number }>();
  for (const m of rows(p.meals)) {
    const day = String(m.log_date);
    const cur = dayAgg.get(day) ?? { kcal: 0, proteinG: 0 };
    cur.kcal += Number(m.kcal ?? 0);
    cur.proteinG += Number(m.protein_g ?? 0);
    dayAgg.set(day, cur);
  }
  const diary: DiaryDay[] = [...dayAgg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, kcal: v.kcal, proteinG: v.proteinG, targetProteinG: targetFor(day) }));

  return {
    checkins, nights, days, reflections, diary,
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
    lessonsCompleted: lessons.length,
    lessonsTotal: Number(p.lessons_total ?? 0),
    avgQuizScore: quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : null,
    liftPrs: prs, liftStalls: stalls, liftCount: byExercise.size,
    tribeCount: Number(p.tribe_count ?? 0),
    friendCount: Number(p.friend_count ?? 0),
    iAmSet: text(p.i_am),
  };
}
