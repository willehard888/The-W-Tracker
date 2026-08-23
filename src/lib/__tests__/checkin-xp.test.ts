// The check-in XP model IS the game economy — the server's record_checkin
// RPC mirrors these exact branches. These tests lock every multiplier band,
// the anti-cheat optional cap, and the "XP never depends on membership"
// invariant (there is no membership input to the function at all).
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
import { OPTIONAL_XP_CAP, type CheckinHabit } from "@/lib/checkin-habits";

const habit = (over: Partial<CheckinHabit>): CheckinHabit => ({
  key: "reading",
  label: "Read",
  pillar: "stress",
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

describe("assessSleep — multiplier bands", () => {
  it("7.5–9h is optimal, full XP", () => {
    for (const h of [7.5, 8, 9]) {
      const s = assessSleep(h);
      expect(s.sleepMultiplier).toBe(1.0);
      expect(s.isOptimalSleep).toBe(true);
      expect(s.sleepPenaltyLabel).toBeNull();
    }
  });

  it("9–12h costs 5% unless chronic", () => {
    const s = assessSleep(10, [8, 8, 8]);
    expect(s.sleepMultiplier).toBe(0.95);
    expect(s.isOptimalSleep).toBe(true); // long sleep still counts as done when not chronic
  });

  it("chronic oversleep (3+ days of ≥10h) drops 9–12h to ×0.6", () => {
    const s = assessSleep(10, [10, 11, 10.5]);
    expect(s.isChronicOversleep).toBe(true);
    expect(s.sleepMultiplier).toBe(0.6);
    expect(s.isOptimalSleep).toBe(false);
    expect(s.sleepPenaltyLabel).toMatch(/Chronic oversleep/);
  });

  it("two oversleep days is NOT chronic yet (boundary is 3)", () => {
    expect(assessSleep(10, [10, 10, 8]).isChronicOversleep).toBe(false);
  });

  it("short-sleep ladder: 7→0.8, 6→0.65, 5→0.5, under 5→0.4", () => {
    expect(assessSleep(7).sleepMultiplier).toBe(0.8);
    expect(assessSleep(6.5).sleepMultiplier).toBe(0.65);
    expect(assessSleep(5.5).sleepMultiplier).toBe(0.5);
    expect(assessSleep(4).sleepMultiplier).toBe(0.4);
    expect(assessSleep(7).sleepPenaltyLabel).toMatch(/Sub-optimal/);
    expect(assessSleep(4).sleepPenaltyLabel).toMatch(/Poor sleep/);
  });

  it("over 12h falls to the worst band", () => {
    expect(assessSleep(13).sleepMultiplier).toBe(0.4);
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

describe("computeCheckinXp — the full day score", () => {
  it("core habits pay full value; optional habits clamp at OPTIONAL_XP_CAP", () => {
    // Enough optional XP to blow well past the cap
    const habits = [
      habit({ key: "a", core: true, xp: 30 }),
      habit({ key: "b", xp: 40 }),
      habit({ key: "c", xp: 40 }),
      habit({ key: "d", xp: 40 }),
    ];
    const st = state({ completed: { a: true, b: true, c: true, d: true } });
    const r = computeCheckinXp({ habits, state: st, sportXp: 0, hasProof: false, sleepMultiplier: 1 });
    expect(r.coreXp).toBe(30);
    expect(r.optionalXp).toBe(OPTIONAL_XP_CAP); // 120 raw → clamped
    expect(r.rawXp).toBe(30 + OPTIONAL_XP_CAP);
  });

  it("proof photo adds a flat bonus for everyone", () => {
    const r = computeCheckinXp({ habits: [], state: state(), sportXp: 0, hasProof: true, sleepMultiplier: 1 });
    expect(r.rawXp).toBe(PROOF_BONUS_XP);
  });

  it("sleep multiplier gates everything EXCEPT the quest bonus", () => {
    const habits = [habit({ key: "a", core: true, xp: 100 })];
    const r = computeCheckinXp({
      habits,
      state: state({ completed: { a: true } }),
      sportXp: 0,
      hasProof: false,
      sleepMultiplier: 0.5,
      questBonusXp: 20,
    });
    expect(r.baseXp).toBe(50); // 100 × 0.5
    expect(r.totalXp).toBe(70); // quest bonus rides on top unmultiplied
  });

  it("baseXp rounds to nearest int", () => {
    const habits = [habit({ key: "a", core: true, xp: 25 })];
    const r = computeCheckinXp({
      habits,
      state: state({ completed: { a: true } }),
      sportXp: 0,
      hasProof: false,
      sleepMultiplier: 0.65,
    });
    expect(r.baseXp).toBe(16); // 16.25 → 16
  });

  it("completedCount counts done habits only", () => {
    const habits = [habit({ key: "a", xp: 5 }), habit({ key: "b", xp: 5 })];
    const r = computeCheckinXp({
      habits,
      state: state({ completed: { a: true } }),
      sportXp: 0,
      hasProof: false,
      sleepMultiplier: 1,
    });
    expect(r.completedCount).toBe(1);
  });
});

describe("maxDailyXp — the honest ceiling promo surfaces may quote", () => {
  it("equals the full-day score: every habit done, proof, optimal sleep, workout at base XP", () => {
    const habits = [
      habit({ key: "sleep", core: true, xp: 20 }),
      habit({ key: "workout", core: true, xp: 25 }),
      habit({ key: "hydration", core: true, xp: 15 }),
      habit({ key: "reading", xp: 10 }),
    ];
    const expected = computeCheckinXp({
      habits,
      state: { sleepOptimal: true, workout: true, hydration: HYDRATION_DONE_LITERS, completed: { sleep: true, workout: true, hydration: true, reading: true } },
      sportXp: 25,
      hasProof: true,
      sleepMultiplier: 1,
    }).totalXp;
    expect(maxDailyXp(habits)).toBe(expected);
    expect(maxDailyXp(habits)).toBeGreaterThan(PROOF_BONUS_XP);
  });

  it("without a workout habit the sport contributes nothing", () => {
    const habits = [habit({ key: "reading", xp: 10 })];
    expect(maxDailyXp(habits)).toBe(10 + PROOF_BONUS_XP);
  });
});
