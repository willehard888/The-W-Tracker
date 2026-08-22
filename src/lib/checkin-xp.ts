// Check-in XP scoring model — extracted from DailyCheckin so the money/
// integrity math is unit-testable. The server's record_checkin RPC enforces a
// CEILING on the same inputs; if you change ANY constant here, re-check the
// SQL ceiling in the same commit.
//
// Invariants (see also xp-constants.ts):
// - XP is identical for everyone — it does NOT depend on membership.
// - Core habits pay their full value, every day.
// - Self-chosen "extras" share ONE pool: together at most OPTIONAL_XP_CAP.
// - The score is purely ADDITIVE. There used to be a hidden sleep multiplier
//   that silently scaled the whole day (×0.4–1.0) while every toggle kept
//   advertising its full value — the number the user saw jumped for reasons
//   they couldn't see. Honesty beats cleverness: what the screen shows is
//   exactly what you get.

import { OPTIONAL_XP_CAP, type CheckinHabit } from "@/lib/checkin-habits";

/** Everyone earns the same proof-photo bonus. */
export const PROOF_BONUS_XP = 30;

/** Hydration slider threshold (liters) at which the habit counts as done. */
export const HYDRATION_DONE_LITERS = 3;

/** Optimal sleep window — the sleep habit counts as done inside it. */
export const SLEEP_OPTIMAL_MIN_H = 7.5;
export const SLEEP_OPTIMAL_MAX_H = 9;

export interface SleepAssessment {
  isOptimalSleep: boolean;
  /** Short human label for the slider: "In range" / "Under 7.5h" / "Over 9h". */
  label: string;
}

/** Sleep → done/not + a plain label. No multiplier, no penalty maths. */
export function assessSleep(sleep: number): SleepAssessment {
  if (sleep >= SLEEP_OPTIMAL_MIN_H && sleep <= SLEEP_OPTIMAL_MAX_H) {
    return { isOptimalSleep: true, label: "In range" };
  }
  return {
    isOptimalSleep: false,
    label: sleep < SLEEP_OPTIMAL_MIN_H ? `Under ${SLEEP_OPTIMAL_MIN_H}h` : `Over ${SLEEP_OPTIMAL_MAX_H}h`,
  };
}

export interface CheckinState {
  sleepOptimal: boolean;
  workout: boolean;
  /** Liters on the hydration slider. */
  hydration: number;
  /** Toggle map for plain (non-widget) habits. */
  completed: Record<string, boolean>;
}

/** Is a given chosen habit "done" (for XP + completion counting)? */
export function isHabitDone(h: CheckinHabit, state: CheckinState): boolean {
  if (h.key === "sleep") return state.sleepOptimal;
  if (h.key === "workout") return state.workout;
  if (h.key === "hydration") return state.hydration >= HYDRATION_DONE_LITERS;
  return !!state.completed[h.key];
}

/** XP a single habit contributes (workout pays the selected sport's XP). */
export function habitXpValue(h: CheckinHabit, state: CheckinState, sportXp: number): number {
  if (h.key === "workout") return state.workout ? sportXp : 0;
  return isHabitDone(h, state) ? h.xp : 0;
}

export interface CheckinXpBreakdown {
  coreXp: number;
  /** After the OPTIONAL_XP_CAP clamp. */
  optionalXp: number;
  proofBonus: number;
  totalXp: number;
  /** Done habits (core + extras). */
  completedCount: number;
  coreDone: number;
  coreTotal: number;
  extrasDone: number;
  /** The extras pool as the UI shows it: "+earned / cap XP". */
  extras: { earned: number; cap: number };
}

/**
 * The full day score — additive and transparent:
 *   core habits (full value) + min(extras, OPTIONAL_XP_CAP) + proof bonus.
 */
export function computeCheckinXp(args: {
  habits: CheckinHabit[];
  state: CheckinState;
  sportXp: number;
  hasProof: boolean;
}): CheckinXpBreakdown {
  const { habits, state, sportXp, hasProof } = args;
  const proofBonus = hasProof ? PROOF_BONUS_XP : 0;
  let coreXp = 0;
  let optionalXpRaw = 0;
  let coreDone = 0;
  let coreTotal = 0;
  let extrasDone = 0;
  for (const h of habits) {
    const xp = habitXpValue(h, state, sportXp);
    const done = isHabitDone(h, state);
    if (h.core) {
      coreXp += xp;
      coreTotal += 1;
      if (done) coreDone += 1;
    } else {
      optionalXpRaw += xp;
      if (done) extrasDone += 1;
    }
  }
  const optionalXp = Math.min(optionalXpRaw, OPTIONAL_XP_CAP);
  return {
    coreXp,
    optionalXp,
    proofBonus,
    totalXp: coreXp + optionalXp + proofBonus,
    completedCount: coreDone + extrasDone,
    coreDone,
    coreTotal,
    extrasDone,
    extras: { earned: optionalXp, cap: OPTIONAL_XP_CAP },
  };
}

/**
 * Best possible day for a habit set: everything done + proof photo. Used by
 * promo surfaces ("Up to +N XP") so they can never contradict the check-in —
 * and because the model is additive, this IS the sum of what the screen shows.
 */
export function maxDailyXp(habits: CheckinHabit[]): number {
  const allDone: CheckinState = {
    sleepOptimal: true,
    workout: true,
    hydration: HYDRATION_DONE_LITERS,
    completed: Object.fromEntries(habits.map((h) => [h.key, true])),
  };
  const workoutXp = habits.find((h) => h.key === "workout")?.xp ?? 0;
  return computeCheckinXp({ habits, state: allDone, sportXp: workoutXp, hasProof: true }).totalXp;
}
