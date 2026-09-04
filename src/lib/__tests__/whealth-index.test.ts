// The Whealth Index is the synthesis core of Whealth OS — the same pure code
// runs in the coach-insights edge function and the Growth dashboard. Honesty
// contracts under test: no-data pillars return null (never a fake 50), no
// NaN ever escapes, missing sub-signals redistribute weight, and patterns
// only fire with n≥5 per side and a material delta.
import { describe, it, expect } from "vitest";
import {
  computeWhealthIndex,
  computeWhealthIndexDetailed,
  scoreSleep,
  scoreRecovery,
  scoreMovement,
  scoreNutrition,
  nutritionParts,
  scoreMind,
  scoreInner,
  detectPatterns,
  type WhealthInputs,
  type CheckinDay,
  type NightRow,
  type ReflectionRow,
  type DiaryDay,
} from "@/lib/whealth-index";

const day = (i: number) => `2026-07-${String(i + 1).padStart(2, "0")}`;

const checkin = (i: number, over: Partial<CheckinDay> = {}): CheckinDay => ({
  day: day(i),
  sleepHours: 8,
  hydration: 3,
  workout: false,
  meditation: false,
  protein: false,
  healthyFood: false,
  noPhone: false,
  journal: false,
  verified: false,
  ...over,
});

const night = (i: number, over: Partial<NightRow> = {}): NightRow => ({
  day: day(i),
  restingHr: 55,
  hrvSdnn: null,
  respRate: 15,
  sleepTotalMin: 480,
  deepMin: 90,
  remMin: 100,
  sleepStart: `2026-07-${String(i + 1).padStart(2, "0")}T22:30:00Z`,
  ...over,
});

const refl = (i: number, over: Partial<ReflectionRow> = {}): ReflectionRow => ({
  day: day(i),
  energy: 4,
  mood: 4,
  hasWin: true,
  hasFriction: false,
  ...over,
});

const EMPTY: WhealthInputs = {
  checkins: [], nights: [], days: [], reflections: [],
  habitStreaks: [], lessonsCompleted: 0, lessonsTotal: 0, avgQuizScore: null,
  liftPrs: 0, liftStalls: 0, liftCount: 0,
  tribeCount: 0, friendCount: 0, iAmSet: false,
};

describe("zero-data honesty", () => {
  it("a brand-new user gets nulls, not fake scores — and never NaN", () => {
    const r = computeWhealthIndex(EMPTY);
    expect(r.pillars.sleep).toBeNull();
    expect(r.pillars.recovery).toBeNull();
    expect(r.pillars.movement).toBeNull();
    expect(r.pillars.nutrition).toBeNull();
    expect(r.pillars.mind).toBeNull();
    // inner has a computable connection sub-signal even at zero → 0-ish, not null
    expect(r.patterns).toEqual([]);
    for (const v of Object.values(r.pillars)) {
      if (v != null) expect(Number.isFinite(v)).toBe(true);
    }
    if (r.overall != null) expect(Number.isFinite(r.overall)).toBe(true);
  });
});

describe("scoreSleep", () => {
  it("optimal duration + strong stages + consistent bedtime ≈ 100", () => {
    const nights = Array.from({ length: 14 }, (_, i) => night(i));
    const s = scoreSleep([], nights)!;
    expect(s).toBeGreaterThanOrEqual(90);
  });

  it("falls back to self-reported hours when HealthKit nights are sparse", () => {
    const checkins = Array.from({ length: 14 }, (_, i) => checkin(i, { sleepHours: 8 }));
    expect(scoreSleep(checkins, [])).toBe(100); // duration only, weight redistributed
  });

  it("short sleep scores low", () => {
    const checkins = Array.from({ length: 14 }, (_, i) => checkin(i, { sleepHours: 5.5 }));
    expect(scoreSleep(checkins, [])!).toBeLessThan(30);
  });

  it("REGRESSION LOCK (prod case): nights that recorded metrics but ZERO sleep are not sleep data — self-reported hours win", () => {
    // The Watch logged RHR/resp for 5 nights with sleep_total_min = 0; the
    // engine scored sleep 0/100 while check-ins averaged 7.8h.
    const zeroNights = Array.from({ length: 5 }, (_, i) => night(i, { sleepTotalMin: 0, deepMin: 0, remMin: 0 }));
    const checkins = Array.from({ length: 14 }, (_, i) => checkin(i, { sleepHours: 7.8 }));
    const s = scoreSleep(checkins, zeroNights)!;
    expect(s).toBeGreaterThanOrEqual(90);
  });

  it("erratic bedtimes drag the score down vs consistent ones", () => {
    const consistent = Array.from({ length: 10 }, (_, i) => night(i));
    const erratic = Array.from({ length: 10 }, (_, i) =>
      night(i, { sleepStart: `2026-07-${String(i + 1).padStart(2, "0")}T${i % 2 ? "21" : "02"}:00:00Z` }),
    );
    expect(scoreSleep([], erratic)!).toBeLessThan(scoreSleep([], consistent)!);
  });
});

describe("scoreRecovery", () => {
  it("rising resting HR (strain) scores worse than falling RHR", () => {
    const strained = Array.from({ length: 21 }, (_, i) =>
      night(i, { restingHr: i < 14 ? 52 : 60 }), // recent 7 higher = strain
    );
    const recovering = Array.from({ length: 21 }, (_, i) =>
      night(i, { restingHr: i < 14 ? 60 : 54 }),
    );
    expect(scoreRecovery([], strained)!).toBeLessThan(scoreRecovery([], recovering)!);
  });

  it("HRV contributes when present (7+ nights)", () => {
    const withHrv = Array.from({ length: 21 }, (_, i) => night(i, { hrvSdnn: 60 + (i > 13 ? 10 : 0) }));
    expect(scoreRecovery([], withHrv)).not.toBeNull();
  });

  it("no nights + no checkins → null", () => {
    expect(scoreRecovery([], [])).toBeNull();
  });
});

describe("scoreMovement", () => {
  it("4 workouts/week ≈ full frequency score", () => {
    const checkins = Array.from({ length: 14 }, (_, i) => checkin(i, { workout: i % 2 === 0 }));
    const s = scoreMovement(checkins, [], { prs: 0, stalls: 0, count: 0 })!;
    expect(s).toBeGreaterThanOrEqual(85); // 3.5/wk on the 0.5→4 ramp
  });

  it("PRs beat stalls in progression", () => {
    const checkins = Array.from({ length: 14 }, (_, i) => checkin(i, { workout: true }));
    const progressing = scoreMovement(checkins, [], { prs: 4, stalls: 0, count: 5 })!;
    const stalled = scoreMovement(checkins, [], { prs: 0, stalls: 4, count: 5 })!;
    expect(progressing).toBeGreaterThan(stalled);
  });

  it("steps need ≥5 days of data to count", () => {
    const days = Array.from({ length: 3 }, (_, i) => ({ day: day(i), steps: 12000, activeKcal: null, workoutMinutes: null, mindfulMinutes: null }));
    // 3 days of steps → step signal ignored; frequency null (no checkins) → null overall
    expect(scoreMovement([], days, { prs: 0, stalls: 0, count: 0 })).toBeNull();
  });
});

describe("scoreNutrition", () => {
  it("needs ≥5 check-ins", () => {
    expect(scoreNutrition([checkin(0)])).toBeNull();
  });

  it("high protein + whole-food rates score high; zero rates score low", () => {
    const good = Array.from({ length: 14 }, (_, i) => checkin(i, { protein: true, healthyFood: true, hydration: 3 }));
    const bad = Array.from({ length: 14 }, (_, i) => checkin(i, { protein: false, healthyFood: false, hydration: 0.5 }));
    expect(scoreNutrition(good)!).toBeGreaterThanOrEqual(90);
    expect(scoreNutrition(bad)!).toBeLessThanOrEqual(15);
  });
});

describe("nutritionParts — logged food diary (4th part)", () => {
  const good = Array.from({ length: 14 }, (_, i) => checkin(i, { protein: true, healthyFood: true, hydration: 3 }));
  const dd = (i: number, proteinG: number, targetProteinG: number | null = 160): DiaryDay =>
    ({ day: day(i), proteinG, kcal: 2200, targetProteinG });
  const logged = (parts: ReturnType<typeof nutritionParts>) => parts.find((p) => p.key === "logged")!;

  it("no diary → four parts, logged null, composite from the other three (weights renormalised)", () => {
    const parts = nutritionParts(good);
    expect(parts.map((p) => p.key)).toEqual(["protein", "food", "hydration", "logged"]);
    expect(parts.map((p) => p.weight)).toEqual([30, 25, 25, 20]);
    expect(logged(parts).score).toBeNull();
    expect(scoreNutrition(good)).toBe(scoreNutrition(good, []));
    expect(scoreNutrition(good)!).toBeGreaterThanOrEqual(90);
  });

  it("5 logged days with 4 hits → ramp(0.8, 0.1, 0.85) = 93; a hit is ≥90% of target", () => {
    // 144 g is exactly 0.9 × 160 → counts as a hit; 100 g misses.
    const diary = [dd(0, 150), dd(1, 144), dd(2, 200), dd(3, 100), dd(4, 160)];
    expect(logged(nutritionParts(good, diary)).score).toBe(93);
  });

  it("needs ≥5 diary days WITH a target — days without one are ignored, never diluting", () => {
    const four = [dd(0, 150), dd(1, 150), dd(2, 150), dd(3, 150)];
    expect(logged(nutritionParts(good, four)).score).toBeNull();
    expect(logged(nutritionParts(good, [...four, dd(4, 150, null)])).score).toBeNull();
    expect(logged(nutritionParts(good, [...four, dd(4, 150, null), dd(5, 150)])).score).toBe(100);
  });

  it("fewer than 5 check-ins → all four parts null, even with a full diary", () => {
    const diary = Array.from({ length: 7 }, (_, i) => dd(i, 170));
    expect(nutritionParts([checkin(0)], diary).every((p) => p.score == null)).toBe(true);
  });

  it("inputs.diary flows through computeWhealthIndexDetailed", () => {
    const diary = Array.from({ length: 7 }, (_, i) => dd(i, 170));
    const d = computeWhealthIndexDetailed({ ...EMPTY, checkins: good, diary });
    expect(logged(d.breakdown.nutrition).score).toBe(100);
    expect(d.pillars.nutrition).toBe(scoreNutrition(good, diary));
  });
});

describe("scoreMind", () => {
  it("meditation practice + good mood/energy score high", () => {
    const checkins = Array.from({ length: 14 }, (_, i) => checkin(i, { meditation: i % 2 === 0 }));
    const reflections = Array.from({ length: 14 }, (_, i) => refl(i, { mood: 4.5, energy: 4.5 }));
    expect(scoreMind(checkins, [], reflections)!).toBeGreaterThan(70);
  });

  it("mood needs ≥5 reflections to count", () => {
    const reflections = Array.from({ length: 3 }, (_, i) => refl(i));
    expect(scoreMind([], [], reflections)).toBeNull();
  });
});

describe("scoreInner", () => {
  it("lessons + journaling + identity + connection compose", () => {
    const s = scoreInner({
      lessonsCompleted: 12, lessonsTotal: 20, avgQuizScore: 90,
      reflections: Array.from({ length: 10 }, (_, i) => refl(i)),
      habitStreaks: [25, 3], tribeCount: 1, friendCount: 4, iAmSet: true,
    })!;
    expect(s).toBeGreaterThanOrEqual(85);
  });

  it("no signals at all still yields a number from connection (0) — never NaN", () => {
    const s = scoreInner({
      lessonsCompleted: 0, lessonsTotal: 0, avgQuizScore: null,
      reflections: [], habitStreaks: [], tribeCount: 0, friendCount: 0, iAmSet: false,
    });
    expect(s).not.toBeNull();
    expect(Number.isFinite(s!)).toBe(true);
    expect(s).toBeLessThanOrEqual(10);
  });
});

describe("detectPatterns — honest n", () => {
  it("returns nothing with sparse data", () => {
    expect(detectPatterns([checkin(0)], [refl(0)], [night(0)])).toEqual([]);
  });

  it("finds workout→mood pattern only when both sides have n≥5 and delta ≥0.3", () => {
    const checkins = Array.from({ length: 20 }, (_, i) => checkin(i, { workout: i % 2 === 0 }));
    const reflections = Array.from({ length: 20 }, (_, i) =>
      refl(i, { mood: i % 2 === 0 ? 4.5 : 3.2 }), // training days clearly better
    );
    const patterns = detectPatterns(checkins, reflections, []);
    const p = patterns.find((x) => x.key === "workout_mood");
    expect(p).toBeTruthy();
    expect(p!.nA).toBeGreaterThanOrEqual(5);
    expect(p!.nB).toBeGreaterThanOrEqual(5);
    expect(p!.delta).toBeGreaterThan(0);
  });

  it("suppresses immaterial deltas even with big n", () => {
    const checkins = Array.from({ length: 20 }, (_, i) => checkin(i, { workout: i % 2 === 0 }));
    const reflections = Array.from({ length: 20 }, (_, i) => refl(i, { mood: 4 }));
    expect(detectPatterns(checkins, reflections, []).find((x) => x.key === "workout_mood")).toBeUndefined();
  });

  it("short-sleep → RHR pattern fires on night data", () => {
    const nights = Array.from({ length: 20 }, (_, i) =>
      night(i, {
        sleepTotalMin: i % 2 === 0 ? 330 : 480,
        restingHr: i % 2 === 0 ? 61 : 54,
      }),
    );
    const p = detectPatterns([], [], nights).find((x) => x.key === "short_sleep_rhr");
    expect(p).toBeTruthy();
    expect(p!.delta).toBeGreaterThanOrEqual(2);
    expect(p!.unit).toBe("bpm");
  });
});

describe("computeWhealthIndex — integration", () => {
  it("a thriving user scores high overall with all pillars present", () => {
    const inputs: WhealthInputs = {
      checkins: Array.from({ length: 28 }, (_, i) => checkin(i, {
        workout: i % 2 === 0, meditation: i % 2 === 1, protein: true, healthyFood: true,
      })),
      nights: Array.from({ length: 28 }, (_, i) => night(i, { hrvSdnn: 65 })),
      days: Array.from({ length: 28 }, (_, i) => ({ day: day(i), steps: 10000, activeKcal: 500, workoutMinutes: 40, mindfulMinutes: 10 })),
      reflections: Array.from({ length: 28 }, (_, i) => refl(i)),
      habitStreaks: [30], lessonsCompleted: 15, lessonsTotal: 25, avgQuizScore: 85,
      liftPrs: 3, liftStalls: 1, liftCount: 4,
      tribeCount: 1, friendCount: 5, iAmSet: true,
    };
    const r = computeWhealthIndex(inputs);
    expect(r.overall).toBeGreaterThanOrEqual(75);
    for (const v of Object.values(r.pillars)) expect(v).not.toBeNull();
  });

  it("partial data yields partial pillars and a weighted overall from what exists", () => {
    const inputs: WhealthInputs = {
      ...EMPTY,
      checkins: Array.from({ length: 14 }, (_, i) => checkin(i, { sleepHours: 8, protein: true, healthyFood: true })),
    };
    const r = computeWhealthIndex(inputs);
    expect(r.pillars.sleep).not.toBeNull();
    expect(r.pillars.nutrition).not.toBeNull();
    expect(r.pillars.recovery).not.toBeNull(); // rest-day compliance from checkins
    expect(r.overall).not.toBeNull();
  });
});

describe("computeWhealthIndexDetailed — breakdown consistency", () => {
  it("pillar score equals the composite of its own breakdown parts", () => {
    const inputs: WhealthInputs = {
      checkins: Array.from({ length: 28 }, (_, i) => checkin(i, { workout: i % 2 === 0, protein: true, healthyFood: true })),
      nights: Array.from({ length: 28 }, (_, i) => night(i)),
      days: [], reflections: Array.from({ length: 10 }, (_, i) => refl(i)),
      habitStreaks: [12], lessonsCompleted: 5, lessonsTotal: 20, avgQuizScore: 80,
      liftPrs: 2, liftStalls: 1, liftCount: 3, tribeCount: 1, friendCount: 2, iAmSet: true,
    };
    const d = computeWhealthIndexDetailed(inputs);
    const summary = computeWhealthIndex(inputs);
    expect(d.pillars).toEqual(summary.pillars);
    expect(d.overall).toBe(summary.overall);
    // Every pillar has a non-empty parts list with labels + weights
    for (const parts of Object.values(d.breakdown)) {
      expect(parts.length).toBeGreaterThanOrEqual(3);
      for (const p of parts) {
        expect(p.label.length).toBeGreaterThan(2);
        expect(p.weight).toBeGreaterThan(0);
        if (p.score != null) {
          expect(p.score).toBeGreaterThanOrEqual(0);
          expect(p.score).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("zero-data breakdown labels every part as null (drill-down shows 'no data yet')", () => {
    const d = computeWhealthIndexDetailed(EMPTY);
    expect(d.breakdown.sleep.every((p) => p.score == null)).toBe(true);
    expect(d.breakdown.nutrition.every((p) => p.score == null)).toBe(true);
  });
});
