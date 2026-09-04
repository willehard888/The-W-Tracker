// Personal target PROPOSAL (plan Phase 7f). Pure math; only values the user
// confirms reach `upsert_nutrition_targets`. Never quoted to the coach
// directly — it sees targets only through the habit-gaps line.
//
// BMR: Katch-McArdle when body fat is known, else Mifflin-St Jeor.
// TDEE = BMR × activity. kcal = TDEE × goal factor, floored (1500 M / 1200 other).
// Protein g/kg by goal, capped at 40 % of kcal. Fat g/kg by goal. Carbs = remainder ≥ 0.
// kcal rounds to 50, macros to 5.

import type { ActivityLevel } from "./types";

export type Sex = "male" | "female" | "other";
export type GoalMode = "cut" | "maintain" | "gain";
export type TargetMethod = "mifflin" | "katch";

export interface TargetInput {
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct?: number | null;
  sex: Sex | null;
  activity_level: ActivityLevel | null;
  primary_goal: string | null;
}

export type TargetResult =
  | { ok: false; reason: "minor" | "missing_profile" }
  | {
      ok: true;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      method: TargetMethod;
      goal: GoalMode;
      activity_level: ActivityLevel;
      bmr: number;
      tdee: number;
      floor_applied: boolean;
      protein_capped: boolean;
    };

export const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};
export const GOAL_KCAL_FACTOR: Record<GoalMode, number> = { cut: 0.85, maintain: 1.0, gain: 1.1 };
export const PROTEIN_G_PER_KG: Record<GoalMode, number> = { cut: 2.2, maintain: 1.6, gain: 2.0 };
export const FAT_G_PER_KG: Record<GoalMode, number> = { cut: 0.8, maintain: 1.0, gain: 1.0 };
export const KCAL_FLOOR: Record<"male" | "other", number> = { male: 1500, other: 1200 };
/** Protein may not exceed this share of kcal (ponytail: LBM-based cap later). */
export const PROTEIN_KCAL_SHARE_CAP = 0.4;
/** Mifflin-St Jeor sex constant; "other"/unset uses the male/female average. */
const MIFFLIN_SEX: Record<Sex, number> = { male: 5, female: -161, other: -78 };

/** Profile goal → target mode: fat_loss → cut; hypertrophy/strength → gain; else maintain. */
export function goalModeFor(primaryGoal: string | null): GoalMode {
  if (primaryGoal === "fat_loss") return "cut";
  if (primaryGoal === "hypertrophy" || primaryGoal === "strength") return "gain";
  return "maintain";
}

const pos = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const roundStep = (v: number, step: number) => Math.round(v / step) * step;

/** Propose kcal + macros from a profile; refuses minors and incomplete profiles. */
export function computeTargets(p: TargetInput): TargetResult {
  const age = p.age;
  if (typeof age !== "number" || !Number.isFinite(age) || !pos(p.weight_kg)) return { ok: false, reason: "missing_profile" };
  const weight = p.weight_kg;
  const bf = p.body_fat_pct;
  const useKatch = pos(bf) && bf < 100;
  if (!useKatch && !pos(p.height_cm)) return { ok: false, reason: "missing_profile" };
  if (age < 18) return { ok: false, reason: "minor" };

  const bmr = useKatch
    ? 370 + 21.6 * weight * (1 - bf / 100)
    : 10 * weight + 6.25 * (p.height_cm as number) - 5 * age + MIFFLIN_SEX[p.sex ?? "other"];
  const activity: ActivityLevel = p.activity_level ?? "light";
  const tdee = bmr * ACTIVITY_MULT[activity];
  const goal = goalModeFor(p.primary_goal);

  const floor = p.sex === "male" ? KCAL_FLOOR.male : KCAL_FLOOR.other;
  const rawKcal = tdee * GOAL_KCAL_FACTOR[goal];
  const floor_applied = rawKcal < floor;
  const kcal = roundStep(Math.max(rawKcal, floor), 50);

  const proteinWanted = PROTEIN_G_PER_KG[goal] * weight;
  const proteinMax = (PROTEIN_KCAL_SHARE_CAP * kcal) / 4;
  const protein_capped = proteinWanted > proteinMax;
  const protein_g = roundStep(Math.min(proteinWanted, proteinMax), 5);
  const fat_g = roundStep(FAT_G_PER_KG[goal] * weight, 5);
  const carbs_g = roundStep(Math.max(0, (kcal - 4 * protein_g - 9 * fat_g) / 4), 5);

  return {
    ok: true,
    kcal,
    protein_g,
    carbs_g,
    fat_g,
    method: useKatch ? "katch" : "mifflin",
    goal,
    activity_level: activity,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    floor_applied,
    protein_capped,
  };
}
