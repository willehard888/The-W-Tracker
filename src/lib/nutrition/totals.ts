// Day/meal arithmetic over snapshot vectors. Sums mirror SQL `sum_nutrition`
// (absent stays absent; a key present in any vector is summed over the vectors
// that have it, and `missing` says how many lacked it).

import { roundTo } from "./scale";
import { NUTRIENT_KEYS, type MacroKey, type NutrientKey, type NutrientVector, type Targets } from "./types";

export const MACRO_KEYS: readonly MacroKey[] = ["kcal", "protein_g", "carbs_g", "fat_g"];

export type DayState = "no_targets" | "empty" | "in_progress" | "over" | "complete";

/** Sum vectors key-wise; `missing[k]` = how many non-empty vectors lacked k. */
export function sumVectors(vs: NutrientVector[]): {
  totals: NutrientVector;
  missing: Partial<Record<NutrientKey, number>>;
} {
  const totals: NutrientVector = {};
  const missing: Partial<Record<NutrientKey, number>> = {};
  for (const v of vs) {
    if (Object.keys(v).length === 0) continue;
    for (const k of NUTRIENT_KEYS) {
      const x = v[k];
      if (typeof x === "number" && Number.isFinite(x)) totals[k] = (totals[k] ?? 0) + x;
      else missing[k] = (missing[k] ?? 0) + 1;
    }
  }
  for (const k of NUTRIENT_KEYS) if (totals[k] !== undefined) totals[k] = roundTo(totals[k], 3);
  return { totals, missing };
}

/** Target − logged per macro; negative when over. */
export function remaining(totals: NutrientVector, targets: Targets): Record<MacroKey, number> {
  const out = {} as Record<MacroKey, number>;
  for (const k of MACRO_KEYS) out[k] = roundTo(targets[k] - (totals[k] ?? 0), 3);
  return out;
}

/** Logged as an integer % of target, clamped 0–999; undefined when the target is 0/absent. */
export function pctOf(totals: NutrientVector, targets: Targets): Partial<Record<MacroKey, number>> {
  const out: Partial<Record<MacroKey, number>> = {};
  for (const k of MACRO_KEYS) {
    const t = targets[k];
    if (!(t > 0)) continue; // 0, NaN and undefined all fail this
    out[k] = Math.min(999, Math.max(0, Math.round(((totals[k] ?? 0) / t) * 100)));
  }
  return out;
}

/** carbs − sugar alcohols (server derived key when present); undefined when carbs unknown. */
export function netCarbs(v: NutrientVector): number | undefined {
  if (v.net_carbs_g !== undefined) return v.net_carbs_g;
  return v.carbs_g === undefined ? undefined : roundTo(v.carbs_g - (v.sugar_alcohol_g ?? 0), 3);
}

/** Integer macro summary for compact rows; absent = 0 (display only). */
export function macroSummary(v: NutrientVector): { calories: number; protein: number; carbs: number; fat: number } {
  return {
    calories: Math.round(v.kcal ?? 0),
    protein: Math.round(v.protein_g ?? 0),
    carbs: Math.round(v.carbs_g ?? 0),
    fat: Math.round(v.fat_g ?? 0),
  };
}

/** Where the day stands: empty → in_progress → complete (≥95 % kcal AND protein hit) / over (>105 % kcal). */
export function dayState(totals: NutrientVector, targets: Targets | null): DayState {
  if (!targets) return "no_targets";
  const kcal = totals.kcal ?? 0;
  if (kcal <= 0) return "empty";
  if (kcal > 1.05 * targets.kcal) return "over";
  if (kcal >= 0.95 * targets.kcal && (totals.protein_g ?? 0) >= targets.protein_g) return "complete";
  return "in_progress";
}
