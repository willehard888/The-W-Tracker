// The check-in XP model IS the game economy. These tests lock the additive
// contract: what the screen shows is exactly what you get — core pays full,
// extras share one capped pool, proof is a flat bonus, nothing multiplies.
import { describe, it, expect } from "vitest";
import {
  assessSleep,
  isHabitDone,
  habitXpValue,
  computeCheckinXp,
  maxDailyXp,
  PROOF_BONUS_XP,
  HYDRATION_DONE_LITERS,
} from "@/lib/checkin-xp";
import { OPTIONAL_XP_CAP, resolveCheckinHabits, type CheckinHabit } from "@/lib/checkin-habits";

const habit = (over: Partial<CheckinHabit>): CheckinHabit => ({
  key: "reading",
  label: "Read",
  pillar: "mind",
  xp: 10,
  core: false,
  ...over,
} as CheckinHabit);

const state = (over: Partial<Parameters<typeof isHabitDone>[1]> = {}) => ({
  sleepOptimal: false,
  workout: false,
  hydration: 0,
  completed: {},
  ...over,
});

describe("assessSleep — done/not + plain label, no multiplier", () => {
  it("7.5–9h is in range", () => {
    for (const h of [7.5, 8, 9]) {
      const s = assessSleep(h);
      expect(s.isOptimalSleep).toBe(true);
      expect(s.label).toBe("In range");
    }
  });

  it("under and over the window are labeled, not penalized", () => {
    expect(assessSleep(6)).toEqual({ isOptimalSleep: false, label: "Under 7.5h" });
    expect(assessSleep(10)).toEqual({ isOptimalSleep: false, label: "Over 9h" });
  });
});

describe("isHabitDone — widget habits read live state", () => {
  it("sleep follows the optimal flag, workout the toggle", () => {
    expect(isHabitDone(habit({ key: "sleep" }), state({ sleepOptimal: true }))).toBe(true);
    expect(isHabitDone(habit({ key: "workout" }), state({ workout: true }))).toBe(true);
    expect(isHabitDone(habit({ key: "workout" }), state())).toBe(false);
  });

  it(`hydration needs ≥${HYDRATION_DONE_LITERS}L`, () => {
    expect(isHabitDone(habit({ key: "hydration" }), state({ hydration: 2.5 }))).toBe(false);
    expect(isHabitDone(habit({ key: "hydration" }), state({ hydration: 3 }))).toBe(true);
  });

  it("plain habits read the completed map", () => {
    expect(isHabitDone(habit({ key: "reading" }), state({ completed: { reading: true } }))).toBe(true);
    expect(isHabitDone(habit({ key: "reading" }), state())).toBe(false);
  });
});

describe("habitXpValue", () => {
  it("workout pays the selected sport's XP, not the habit's", () => {
    expect(habitXpValue(habit({ key: "workout", xp: 25 }), state({ workout: true }), 40)).toBe(40);
    expect(habitXpValue(habit({ key: "workout", xp: 25 }), state(), 40)).toBe(0);
  });
});

describe("computeCheckinXp — additive and transparent", () => {
  it("core habits pay full value; extras clamp at OPTIONAL_XP_CAP", () => {
    const habits = [
      habit({ key: "a", core: true, xp: 30 }),
      habit({ key: "b", xp: 40 }),
      habit({ key: "c", xp: 40 }),
      habit({ key: "d", xp: 40 }),
    ];
    const st = state({ completed: { a: true, b: true, c: true, d: true } });
    const r = computeCheckinXp({ habits, state: st, sportXp: 0, hasProof: false });
    expect(r.coreXp).toBe(30);
    expect(r.optionalXp).toBe(OPTIONAL_XP_CAP); // 120 raw → clamped
    expect(r.extras).toEqual({ earned: OPTIONAL_XP_CAP, cap: OPTIONAL_XP_CAP });
    expect(r.totalXp).toBe(30 + OPTIONAL_XP_CAP);
  });

  it("the extras pool reports earned/cap honestly below the cap", () => {
    const habits = [habit({ key: "b", xp: 15 }), habit({ key: "c", xp: 10 })];
    const r = computeCheckinXp({ habits, state: state({ completed: { b: true } }), sportXp: 0, hasProof: false });
    expect(r.extras).toEqual({ earned: 15, cap: OPTIONAL_XP_CAP });
    expect(r.extrasDone).toBe(1);
  });

  it("proof photo adds a flat bonus for everyone", () => {
    const r = computeCheckinXp({ habits: [], state: state(), sportXp: 0, hasProof: true });
    expect(r.totalXp).toBe(PROOF_BONUS_XP);
    expect(r.proofBonus).toBe(PROOF_BONUS_XP);
  });

  it("total is exactly core + clamped extras + proof — nothing multiplies", () => {
    const habits = [habit({ key: "a", core: true, xp: 100 }), habit({ key: "b", xp: 20 })];
    const r = computeCheckinXp({
      habits,
      state: state({ completed: { a: true, b: true } }),
      sportXp: 0,
      hasProof: true,
    });
    expect(r.totalXp).toBe(100 + 20 + PROOF_BONUS_XP);
    expect(r.totalXp).toBe(r.coreXp + r.optionalXp + r.proofBonus);
  });

  it("counts core and extras done separately", () => {
    const habits = [habit({ key: "a", core: true, xp: 5 }), habit({ key: "b", xp: 5 }), habit({ key: "c", xp: 5 })];
    const r = computeCheckinXp({ habits, state: state({ completed: { a: true, b: true } }), sportXp: 0, hasProof: false });
    expect(r.coreDone).toBe(1);
    expect(r.coreTotal).toBe(1);
    expect(r.extrasDone).toBe(1);
    expect(r.completedCount).toBe(2);
  });
});

describe("maxDailyXp — the promo number can never lie", () => {
  it("equals the sum of a perfect day for the default set", () => {
    const habits = resolveCheckinHabits(null);
    const max = maxDailyXp(habits);
    const core = habits.filter((h) => h.core).reduce((s, h) => s + h.xp, 0);
    const extrasRaw = habits.filter((h) => !h.core).reduce((s, h) => s + h.xp, 0);
    expect(max).toBe(core + Math.min(extrasRaw, OPTIONAL_XP_CAP) + PROOF_BONUS_XP);
  });
});
