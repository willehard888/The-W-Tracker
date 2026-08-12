// Check-in XP scoring model — extracted from DailyCheckin so the money/
// integrity math is unit-testable. The server's record_checkin RPC enforces
// the same caps; if you change ANY constant or branch here, change the SQL
// in the same commit.
//
// Invariants (see also xp-constants.ts):
// - XP is identical for everyone — it does NOT depend on membership.
// - Optional (self-chosen) habits together add at most OPTIONAL_XP_CAP.
// - Sleep multiplies the whole day: quality of recovery gates the score.

import { OPTIONAL_XP_CAP, type CheckinHabit } from "@/lib/checkin-habits";

/** Everyone earns the same proof-photo bonus. */
export const PROOF_BONUS_XP = 30;

/** Hydration slider threshold (liters) at which the habit counts as done. */
export const HYDRATION_DONE_LITERS = 3;

export interface SleepAssessment {
  isOptimalSleep: boolean;
  isChronicOversleep: boolean;
  oversleepCount: number;
  sleepMultiplier: number;
  sleepPenaltyLabel: string | null;
}

/**
 * Sleep quality → XP multiplier for the whole day.
 * 7.5–9h optimal (×1.0) · 9–12h ×0.95, or ×0.6 when chronic (≥3 oversleep
 * days of ≥10h in the recent window) · 7–7.5h ×0.8 · 6–7h ×0.65 ·
 * 5–6h ×0.5 · under 5h (or >12h) ×0.4.
 */
export function assessSleep(sleep: number, recentSleep: number[] = []): SleepAssessment {
  const oversleepCount = recentSleep.filter((h) => h >= 10).length;
  const chronic = oversleepCount >= 3;
  const optimal = (sleep >= 7.5 && sleep <= 9) || (sleep > 9 && sleep <= 12 && !chronic);
  let multiplier = 1.0;
  if (sleep >= 7.5 && sleep <= 9) multiplier = 1.0;
  else if (sleep > 9 && sleep <= 12) multiplier = chronic ? 0.6 : 0.95;
  else if (sleep >= 7 && sleep < 7.5) multiplier = 0.8;
  else if (sleep >= 6 && sleep < 7) multiplier = 0.65;
  else if (sleep >= 5 && sleep < 6) multiplier = 0.5;
  else multiplier = 0.4;
  let penalty: string | null = null;
  if (multiplier < 1) {
    const pct = `${Math.round((1 - multiplier) * 100)}% XP penalty`;
    if (chronic && sleep > 9) penalty = `Chronic oversleep — ${pct}`;
    else if (sleep >= 7 && sleep < 7.5) penalty = `Sub-optimal sleep — ${pct}`;
    else if (sleep < 7) penalty = `Poor sleep — ${pct}`;
    else penalty = pct;
  }
  return {
    isOptimalSleep: optimal,
    isChronicOversleep: chronic,
    oversleepCount,
    sleepMultiplier: multiplier,
    sleepPenaltyLabel: penalty,
  };
}

/**
 * Best possible day for a habit set: everything done + proof photo, optimal
 * sleep (×1.0). Used by promo surfaces ("Earn up to N XP") so they can never
 * contradict the real check-in math. Workout is valued at the habit's own
 * base XP (sport choice can raise it — this is the honest floor of the max).
 */
export function maxDailyXp(habits: CheckinHabit[]): number {
  const allDone: CheckinState = {
    sleepOptimal: true,
    workout: true,
    hydration: HYDRATION_DONE_LITERS,
    completed: Object.fromEntries(habits.map((h) => [h.key, true])),
  };
  const workoutXp = habits.find((h) => h.key === "workout")?.xp ?? 0;
  return computeCheckinXp({
    habits,
    state: allDone,
    sportXp: workoutXp,
    hasProof: true,
    sleepMultiplier: 1,
  }).totalXp;
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
  rawXp: number;
  /** rawXp × sleepMultiplier, rounded. */
  baseXp: number;
  totalXp: number;
  completedCount: number;
}

/**
 * The full day score. Core habits earn full value; self-chosen habits are
 * clamped to OPTIONAL_XP_CAP so stacking can't inflate the score; the sleep
 * multiplier gates everything; quest bonus rides on top unmultiplied.
 */
export function computeCheckinXp(args: {
  habits: CheckinHabit[];
  state: CheckinState;
  sportXp: number;
  hasProof: boolean;
  sleepMultiplier: number;
  questBonusXp?: number;
}): CheckinXpBreakdown {
  const { habits, state, sportXp, hasProof, sleepMultiplier, questBonusXp = 0 } = args;
  const proofBonus = hasProof ? PROOF_BONUS_XP : 0;
  let coreXp = 0;
  let optionalXpRaw = 0;
  for (const h of habits) {
    const xp = habitXpValue(h, state, sportXp);
    if (h.core) coreXp += xp;
    else optionalXpRaw += xp;
  }
  const optionalXp = Math.min(optionalXpRaw, OPTIONAL_XP_CAP);
  const rawXp = coreXp + optionalXp + proofBonus;
  const baseXp = Math.round(rawXp * sleepMultiplier);
  return {
    coreXp,
    optionalXp,
    proofBonus,
    rawXp,
    baseXp,
    totalXp: baseXp + questBonusXp,
    completedCount: habits.filter((h) => isHabitDone(h, state)).length,
  };
}
