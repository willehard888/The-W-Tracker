import { fmtKcal } from "@/lib/nutrition/format";
import type { DayState } from "@/lib/nutrition/totals";

/**
 * What today's fuel says, in one voice.
 *
 * The diary's opening line and Home's Fuel card used to carry the same five
 * sentences written twice, in two files, and they had already drifted: Home
 * printed an ungrouped `2200` where the diary printed `2 200`, and Home had no
 * sentence at all for a day over target. One source now, both surfaces.
 */

/** The opening line: what the day is, in three words or fewer where possible. */
export const beatFor = (state: DayState, kcal: number, targetKcal: number | null): string => {
  switch (state) {
    case "no_targets":
      return "Set your targets.";
    case "empty":
      return "Nothing logged yet.";
    case "complete":
      return "Fueled.";
    case "over":
      return `${fmtKcal(kcal - (targetKcal ?? 0))} over today.`;
    default:
      return `${fmtKcal((targetKcal ?? 0) - kcal)} kcal to go.`;
  }
};

/** The line under it: the numbers behind the sentence. */
export const subFor = (state: DayState, kcal: number, targetKcal: number | null, meals: number): string => {
  if (state === "no_targets") return kcal > 0 ? `${fmtKcal(kcal)} kcal logged. Targets turn it into a plan.` : "Targets turn the diary into a plan.";
  if (state === "empty") return `Your target is ${fmtKcal(targetKcal ?? 0)} kcal.`;
  const m = `${meals} meal${meals === 1 ? "" : "s"}`;
  if (state === "complete") return `${fmtKcal(kcal)} of ${fmtKcal(targetKcal ?? 0)} kcal · protein hit · ${m}`;
  return `${fmtKcal(kcal)} of ${fmtKcal(targetKcal ?? 0)} kcal · ${m}`;
};

/**
 * Home's headline number: how much is left, or how far past.
 *
 * `null` when there is no target — a number of kcal "left" out of nothing is
 * the same lie a progress bar against nothing would be.
 */
export const kcalLeft = (kcal: number, targetKcal: number | null): { value: number; over: boolean } | null => {
  if (targetKcal == null || !(targetKcal > 0)) return null;
  const diff = Math.round(targetKcal - kcal);
  return diff >= 0 ? { value: diff, over: false } : { value: -diff, over: true };
};

/** Logged share of the kcal target, 0–1 clamped; `null` without a target. */
export const kcalProgress = (kcal: number, targetKcal: number | null): number | null => {
  if (targetKcal == null || !(targetKcal > 0)) return null;
  return Math.min(1, Math.max(0, kcal / targetKcal));
};
