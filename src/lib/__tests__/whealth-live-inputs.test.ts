// mapLiveInputs turns the whealth_live_inputs() jsonb into WhealthInputs.
// Every branch of the old 12-query hook mapping is pinned here: legacy check-in
// columns vs the habits jsonb, whitespace-only text, lift PR/stall math over a
// newest-first list, diary sums against the newest-first target list, the
// Core-4 streaks, and the "nothing there yet" shape.
import { describe, it, expect } from "vitest";
import { mapLiveInputs } from "@/lib/whealth-live-inputs";

const EMPTY = {
  checkins: [], nights: [], days: [], reflections: [], diary: [],
  habitStreaks: [0, 0, 0, 0],
  lessonsCompleted: 0, lessonsTotal: 0, avgQuizScore: null,
  liftPrs: 0, liftStalls: 0, liftCount: 0,
  tribeCount: 0, friendCount: 0, iAmSet: false,
};

describe("mapLiveInputs — payload shape", () => {
  it("null / non-object / array payloads map to empty inputs", () => {
    expect(mapLiveInputs(null)).toEqual(EMPTY);
    expect(mapLiveInputs("nope")).toEqual(EMPTY);
    expect(mapLiveInputs([1])).toEqual(EMPTY);
  });

  it("non-array list fields and non-object rows are ignored", () => {
    const out = mapLiveInputs({
      checkins: "x", nights: 3, days: null, reflections: {}, lifts: undefined, lessons: [null, 1], meals: [], targets: [],
    });
    expect(out).toEqual(EMPTY);
  });

  it("counts, lessons_total and i_am come through", () => {
    const out = mapLiveInputs({ tribe_count: 2, friend_count: "3", lessons_total: 20, i_am: "a builder" });
    expect(out.tribeCount).toBe(2);
    expect(out.friendCount).toBe(3);
    expect(out.lessonsTotal).toBe(20);
    expect(out.iAmSet).toBe(true);
  });

  it("i_am: null, whitespace and non-string are not set", () => {
    expect(mapLiveInputs({ i_am: null }).iAmSet).toBe(false);
    expect(mapLiveInputs({ i_am: "   " }).iAmSet).toBe(false);
    expect(mapLiveInputs({ i_am: 7 }).iAmSet).toBe(false);
  });
});

describe("mapLiveInputs — check-ins", () => {
  it("maps legacy boolean columns", () => {
    const [c] = mapLiveInputs({
      checkins: [{
        checked_in_at: "2026-07-01T06:00:00+00:00", sleep_hours: 8, hydration_liters: "3.5",
        workout: true, meditation_morning: false, meditation_evening: true, protein_intake: true,
        healthy_food: true, no_phone_morning: true, no_phone_evening: false,
        journal_entry: "  wrote something ", habits: {}, verified_at: "2026-07-01T07:00:00+00:00",
      }],
    }).checkins;
    expect(c).toEqual({
      day: "2026-07-01", sleepHours: 8, hydration: 3.5, workout: true, meditation: true, protein: true,
      healthyFood: true, noPhone: true, journal: true, verified: true,
    });
  });

  it("maps the habits jsonb when the legacy columns are false", () => {
    const [c] = mapLiveInputs({
      checkins: [{
        checked_in_at: "2026-07-02T06:00:00+00:00", sleep_hours: null, hydration_liters: null,
        workout: false, meditation_morning: false, meditation_evening: false, protein_intake: false,
        healthy_food: false, no_phone_morning: false, no_phone_evening: false,
        journal_entry: "   ", verified_at: null,
        habits: { workout: true, meditation_pm: true, protein: true, healthy_food: true, no_phone_pm: true },
      }],
    }).checkins;
    expect(c).toEqual({
      day: "2026-07-02", sleepHours: null, hydration: null, workout: true, meditation: true, protein: true,
      healthyFood: true, noPhone: true, journal: false, verified: false,
    });
  });

  it("habits.meditation / no_phone_am count too; a null habits column and a non-string journal are fine", () => {
    const out = mapLiveInputs({
      checkins: [
        { checked_in_at: "2026-07-03T06:00:00+00:00", habits: { meditation: true, no_phone_am: true }, journal_entry: 5 },
        { checked_in_at: "2026-07-04T06:00:00+00:00", habits: null },
      ],
    }).checkins;
    expect(out[0]).toMatchObject({ meditation: true, noPhone: true, journal: false, workout: false, protein: false, healthyFood: false });
    expect(out[1]).toMatchObject({ day: "2026-07-04", meditation: false, noPhone: false, workout: false, verified: false });
  });
});

describe("mapLiveInputs — nights, days, reflections", () => {
  it("maps numeric fields and keeps nulls", () => {
    const out = mapLiveInputs({
      nights: [
        { night_date: "2026-07-01", resting_hr: "52", hrv_sdnn: 60, respiratory_rate: 14.5, sleep_total_min: 450, sleep_deep_min: 80, sleep_rem_min: 90, sleep_start: "2026-06-30T22:10:00+00:00" },
        { night_date: "2026-07-02", resting_hr: null, hrv_sdnn: null, respiratory_rate: null, sleep_total_min: null, sleep_deep_min: null, sleep_rem_min: null, sleep_start: null },
      ],
      days: [
        { snapshot_date: "2026-07-01", steps: 9000, active_kcal: "500", workout_minutes: 45, mindful_minutes: 10 },
        { snapshot_date: "2026-07-02", steps: null, active_kcal: null, workout_minutes: null, mindful_minutes: null },
      ],
      reflections: [
        { reflection_date: "2026-07-01", energy_1to5: 4, mood_1to5: "5", win: "shipped", friction: "  " },
        { reflection_date: "2026-07-02", energy_1to5: null, mood_1to5: null, win: null, friction: "tired" },
      ],
    });
    expect(out.nights).toEqual([
      { day: "2026-07-01", restingHr: 52, hrvSdnn: 60, respRate: 14.5, sleepTotalMin: 450, deepMin: 80, remMin: 90, sleepStart: "2026-06-30T22:10:00+00:00" },
      { day: "2026-07-02", restingHr: null, hrvSdnn: null, respRate: null, sleepTotalMin: null, deepMin: null, remMin: null, sleepStart: null },
    ]);
    expect(out.days).toEqual([
      { day: "2026-07-01", steps: 9000, activeKcal: 500, workoutMinutes: 45, mindfulMinutes: 10 },
      { day: "2026-07-02", steps: null, activeKcal: null, workoutMinutes: null, mindfulMinutes: null },
    ]);
    expect(out.reflections).toEqual([
      { day: "2026-07-01", energy: 4, mood: 5, hasWin: true, hasFriction: false },
      { day: "2026-07-02", energy: null, mood: null, hasWin: false, hasFriction: true },
    ]);
  });
});

describe("mapLiveInputs — lifts (newest-first)", () => {
  it("PR when the latest e1rm beats the prior best by ≥1%, stall when ≤97%, otherwise neither", () => {
    const out = mapLiveInputs({
      lifts: [
        // squat: latest 110x5 vs prior 100x5 → PR
        { exercise_slug: "squat", exercise_name: "Squat", weight: 110, reps: 5 },
        { exercise_slug: "squat", exercise_name: "Squat", weight: 100, reps: 5 },
        // bench: latest 80x5 vs prior 100x5 → stall
        { exercise_slug: "bench", exercise_name: "Bench", weight: 80, reps: 5 },
        { exercise_slug: "bench", exercise_name: "Bench", weight: 100, reps: 5 },
        // row: latest 100x5 vs prior 100x5 → neither
        { exercise_slug: "row", exercise_name: "Row", weight: 100, reps: 5 },
        { exercise_slug: "row", exercise_name: "Row", weight: 100, reps: 5 },
      ],
    });
    expect(out).toMatchObject({ liftPrs: 1, liftStalls: 1, liftCount: 3 });
  });

  it("falls back to exercise_name, defaults reps to 1, skips null weight and nameless rows, ignores single-set exercises", () => {
    const out = mapLiveInputs({
      lifts: [
        { exercise_slug: null, exercise_name: "Curl", weight: 20, reps: null },
        { exercise_slug: null, exercise_name: "Curl", weight: 20, reps: 1 },
        { exercise_slug: "dead", exercise_name: "Deadlift", weight: null, reps: 5 },
        { exercise_slug: "dead", exercise_name: "Deadlift", weight: 140, reps: 5 },
        { exercise_slug: null, exercise_name: null, weight: 50, reps: 5 },
      ],
    });
    // Curl: 2 sets equal → neither; Deadlift: 1 usable set → skipped but counted.
    expect(out).toMatchObject({ liftPrs: 0, liftStalls: 0, liftCount: 2 });
  });
});

describe("mapLiveInputs — lessons", () => {
  it("counts rows, averages non-null quiz scores, and returns null with no scores", () => {
    expect(mapLiveInputs({ lessons: [{ quiz_score: 80 }, { quiz_score: null }, { quiz_score: "100" }] }))
      .toMatchObject({ lessonsCompleted: 3, avgQuizScore: 90 });
    expect(mapLiveInputs({ lessons: [{ quiz_score: null }] }))
      .toMatchObject({ lessonsCompleted: 1, avgQuizScore: null });
  });
});

describe("mapLiveInputs — diary", () => {
  it("sums meals per day (nulls as 0), sorts by day, and picks the newest target in force", () => {
    const out = mapLiveInputs({
      meals: [
        { log_date: "2026-07-05", kcal: 600, protein_g: 40 },
        { log_date: "2026-07-05", kcal: null, protein_g: null },
        { log_date: "2026-07-05", kcal: "400", protein_g: "30" },
        { log_date: "2026-07-01", kcal: 500, protein_g: 20 },
        { log_date: "2026-07-03", kcal: 500, protein_g: 20 },
        { log_date: "2026-06-01", kcal: 500, protein_g: 20 },
      ],
      targets: [
        { effective_from: "2026-07-04", protein_g: 150 },
        { effective_from: "2026-07-03", protein_g: null },
        { effective_from: "2026-07-02", protein_g: 0 },
        { effective_from: "2026-07-01", protein_g: 120 },
      ],
    }).diary;
    expect(out).toEqual([
      { day: "2026-06-01", kcal: 500, proteinG: 20, targetProteinG: null }, // no target yet
      { day: "2026-07-01", kcal: 500, proteinG: 20, targetProteinG: 120 },
      { day: "2026-07-03", kcal: 500, proteinG: 20, targetProteinG: null }, // newest in force has null protein
      { day: "2026-07-05", kcal: 1000, proteinG: 70, targetProteinG: 150 },
    ]);
  });
});

describe("mapLiveInputs — Core-4 streaks", () => {
  const ci = (day: string, over: Record<string, unknown>) => ({ checked_in_at: `${day}T06:00:00+00:00`, ...over });

  it("counts consecutive qualifying check-ins from the latest one backwards", () => {
    const out = mapLiveInputs({
      checkins: [
        ci("2026-07-01", { sleep_hours: 6, hydration_liters: 1, workout: false, meditation_morning: false }),
        ci("2026-07-02", { sleep_hours: 8, hydration_liters: 3, workout: true, meditation_morning: true }),
        ci("2026-07-03", { sleep_hours: 9, hydration_liters: 3.2, workout: true, habits: { meditation: true } }),
      ],
    });
    expect(out.habitStreaks).toEqual([2, 2, 2, 2]);
  });

  it("null sleep / hydration and out-of-band sleep break the run", () => {
    const out = mapLiveInputs({
      checkins: [
        ci("2026-07-01", { sleep_hours: 8, hydration_liters: 3, workout: true, meditation_morning: true }),
        ci("2026-07-02", { sleep_hours: null, hydration_liters: null, workout: true, meditation_morning: true }),
        ci("2026-07-03", { sleep_hours: 9.5, hydration_liters: 2.9, workout: false, meditation_morning: false }),
      ],
    });
    expect(out.habitStreaks).toEqual([0, 0, 0, 0]);
  });
});
