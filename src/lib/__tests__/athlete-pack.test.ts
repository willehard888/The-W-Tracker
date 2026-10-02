import { describe, it, expect } from "vitest";
import {
  buildPackBlocks,
  emptyPack,
  gatherAthletePack,
  gatherDaySignals,
  gatherDiet,
  gatherReflectionTrend,
  type AthletePack,
} from "../../../supabase/functions/_shared/athlete-pack";

/**
 * A stub PostgREST client: every builder method chains, `await` resolves to
 * `{ data }` for the table (or the first matching table/select pair). Enough
 * to exercise the readers' arithmetic without a database.
 */
const stubClient = (tables: Record<string, unknown>) => {
  const builder = (table: string) => {
    const result = { data: tables[table] ?? null, error: null };
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["select", "eq", "gte", "lte", "order", "limit", "in"]) b[m] = chain;
    b.maybeSingle = () => Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: null });
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
    return b;
  };
  return { from: builder, rpc: () => Promise.resolve({ data: [], error: null }) };
};

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

describe("gatherDaySignals", () => {
  it("averages a week of steps, keeps yesterday, and reads the weight trend from the oldest to the newest row", async () => {
    const rows = [
      { snapshot_date: day(1), steps: 9000, active_kcal: 500, workout_minutes: 40, mindful_minutes: 10, flights: 8, body_mass_kg: 81.2, body_fat_pct: null, vo2max: 44, sources: ["Apple Watch"] },
      { snapshot_date: day(2), steps: 7000, active_kcal: 400, workout_minutes: 0, mindful_minutes: 0, flights: 4, body_mass_kg: null, body_fat_pct: 18, vo2max: null, sources: [] },
      { snapshot_date: day(20), steps: 11000, active_kcal: 600, workout_minutes: 60, mindful_minutes: 0, flights: 12, body_mass_kg: 82.4, body_fat_pct: null, vo2max: null, sources: ["Polar"] },
    ];
    const d = await gatherDaySignals(stubClient({ health_sync_snapshots: rows }), "u");
    expect(d).toMatchObject({ days: 3, steps: { yesterday: 9000, avg7: 9000, avg28: 9000 }, activeKcalAvg7: 500, workoutMin7: 100, mindfulMin7: 10 });
    expect(d!.body).toMatchObject({ massKg: 81.2, on: day(1), delta28: -1.2, fatPct: 18, vo2max: 44 });
    expect(d!.sources).toEqual(["Apple Watch", "Polar"]);
    expect(await gatherDaySignals(stubClient({}), "u")).toBeNull();
  });
});

describe("gatherDiet", () => {
  it("sums the diary per day, averages the logged days, counts protein-target days, reads fibre from item snapshots and names the usual foods", async () => {
    const meals = [
      { log_date: day(1), kcal: 800, protein_g: 60, carbs_g: 80, fat_g: 20 },
      { log_date: day(1), kcal: 1200, protein_g: 90, carbs_g: 120, fat_g: 40 },
      { log_date: day(3), kcal: 1500, protein_g: 100, carbs_g: 150, fat_g: 50 },
    ];
    const items = [
      { display_name: "Kaurapuuro", snapshot: { fiber_g: 8 }, created_at: `${day(1)}T07:00:00Z` },
      { display_name: "Kaurapuuro", snapshot: { fiber_g: 8 }, created_at: `${day(3)}T07:00:00Z` },
      { display_name: "Broileri, rintafilee", snapshot: { fiber_g: 0 }, created_at: `${day(1)}T12:00:00Z` },
    ];
    const diet = await gatherDiet(stubClient({ meal_logs: meals, meal_log_items: items, nutrition_targets: [{ kcal: 2400, protein_g: 150, carbs_g: 250, fat_g: 80, fiber_g: 30, water_ml: 2500 }] }), "u");
    expect(diet).toMatchObject({ daysLogged7: 2, meals7: 3, proteinDaysHit: 1 });
    expect(diet!.avg).toEqual({ kcal: 1750, protein: 125, carbs: 175, fat: 55, fiber: 8 });
    expect(diet!.yesterday).toMatchObject({ kcal: 2000, protein: 150, fiber: 8 });
    expect(diet!.target).toMatchObject({ protein: 150, waterMl: 2500 });
    expect(diet!.topFoods).toEqual(["Kaurapuuro", "Broileri, rintafilee"]);
    expect(await gatherDiet(stubClient({ meal_logs: [] }), "u")).toBeNull();
  });
});

describe("gatherReflectionTrend", () => {
  it("averages this week against the week before and keeps the last win and friction", async () => {
    const rows = [
      { reflection_date: day(1), energy_1to5: 4, mood_1to5: 4, sleep_quality_1to5: 3, rpe_1to10: 8, win: "Hit the squat", friction: null },
      { reflection_date: day(2), energy_1to5: 2, mood_1to5: 3, sleep_quality_1to5: 3, rpe_1to10: null, win: null, friction: "Late night" },
      { reflection_date: day(9), energy_1to5: 3, mood_1to5: 3, sleep_quality_1to5: 4, rpe_1to10: 7, win: null, friction: null },
    ];
    const t = await gatherReflectionTrend(stubClient({ coach_reflections: rows }), "u");
    expect(t).toMatchObject({ n7: 2, avg7: { energy: 3, mood: 3.5, sleepQ: 3, rpe: 8 }, prev7: { energy: 3, mood: 3, sleepQ: 4, rpe: 7 }, lastWin: "Hit the squat", lastFriction: "Late night" });
  });
});

describe("buildPackBlocks", () => {
  const pack: AthletePack = {
    ...emptyPack("2026-10-02"),
    day: { days: 7, steps: { yesterday: 9000, avg7: 8500, avg28: 8000 }, activeKcalAvg7: 520, workoutMin7: 120, mindfulMin7: 20, flightsAvg7: 6, body: { massKg: 81.2, on: "2026-10-01", delta28: -1.2, fatPct: null, vo2max: 44 }, sources: ["Apple Watch"] },
    diet: { daysLogged7: 5, meals7: 14, avg: { kcal: 2100, protein: 140, carbs: 220, fat: 70, fiber: 24 }, yesterday: { kcal: 2300, protein: 155, carbs: 240, fat: 75, fiber: 26 }, target: { kcal: 2400, protein: 160, carbs: 250, fat: 80, fiber: 30, waterMl: 2500 }, proteinDaysHit: 2, topFoods: ["Kaurapuuro", "Rahka"] },
    reflections: { n7: 4, avg7: { energy: 3.5, mood: 4, sleepQ: 3, rpe: 8 }, prev7: { energy: 3, mood: 3.5, sleepQ: 3.5, rpe: 7.5 }, lastWin: "Two sessions", lastFriction: "Phone in bed" },
    badges: ["Iron Week"],
    plan: { headline: "Push day", missions: [{ title: "Morning light", done: true }, { title: "Protein 160 g", done: false }] },
    lastReview: { weekStartsOn: "2026-09-21", driver: "Sleep", focus: "Keep 3 sessions", liftsNote: "Squat holds", tweak: null },
    recovery: { sessions28: 3, minutes28: 40, last: "2026-09-30", areas: ["hips", "thoracic"] },
  };
  it("writes one block per known section with the numbers, and nothing for an empty pack", () => {
    const t = buildPackBlocks(pack);
    expect(t).toContain("DAILY ACTIVITY & BODY (Apple Health via Apple Watch):\n- Steps: 9000 yesterday, avg 8500/day this week (28-day avg 8000)");
    expect(t).toContain("- Body weight: 81.2 kg (2026-10-01), -1.2 kg over 28 days");
    expect(t).toContain("FOOD DIARY (self-logged, 7 days");
    expect(t).toContain("Daily average: 2100 kcal / 2400 kcal · protein 140 g / 160 g · carbs 220 g / 250 g · fat 70 g / 80 g · fibre 24 g / 30 g");
    expect(t).toContain("- Protein target reached on 2 of 5 logged days");
    expect(t).toContain("- Water target: 2.5 L/day");
    expect(t).toContain("- Eats most often: Kaurapuuro, Rahka");
    expect(t).toContain("EVENING REFLECTIONS (4 this week, 1–5 unless noted): energy 3.5 (+0.5 vs prior week) · mood 4 (+0.5 vs prior week) · sleep quality 3 (-0.5 vs prior week) · session RPE 8/10 (+0.5 vs prior week)");
    expect(t).toContain("TODAY'S PLAN (the missions the daily plan set; 1/2 covered so far): \"Push day\"\n- ✓ Morning light\n- ○ Protein 160 g");
    expect(t).toContain("LAST WEEKLY REVIEW (week of 2026-09-21): driver — Sleep. Focus — Keep 3 sessions Lifts — Squat holds");
    expect(t).toContain("RECOVERY ROUTINES (breathwork / mobility in the app): 3 sessions, 40 min in 28 days, last 2026-09-30, mostly hips, thoracic.");
    expect(t).toContain("BADGES EARNED (28 days): Iron Week.");
    expect(buildPackBlocks(emptyPack("2026-10-02"))).toBe("");
  });
});

describe("gatherAthletePack", () => {
  it("reads every section in one go and leaves the opt-in gatherers null unless asked", async () => {
    const sb = stubClient({ health_sync_snapshots: [], meal_logs: [], coach_reflections: [], user_badges: [], coach_daily_plans: [], coach_weekly_reviews: [], recovery_sessions: [] });
    const p = await gatherAthletePack(sb, "u", { today: "2026-10-02" });
    expect(p).toMatchObject({ today: "2026-10-02", day: null, diet: null, reflections: null, badges: [], plan: null, lastReview: null, recovery: null, night: null, workouts: null, habits: null });
    const light = await gatherAthletePack(sb, "u", { today: "2026-10-02", scope: "light" });
    expect(light.badges).toEqual([]);
  });
});
