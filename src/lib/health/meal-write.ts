/**
 * Nutrition diary → Apple Health (opt-in, iOS only, fire-and-forget).
 *
 * Every function resolves `false` instead of throwing: off-platform, no
 * consent, denied permission, or a native error all mean "nothing was
 * written" and the diary never waits on or fails because of HealthKit.
 * Failures go to captureException (Sentry when configured + console).
 */
import { Capacitor } from "@capacitor/core";
import { captureException } from "@/lib/observability";
import { HealthNight, type MealWriteArgs } from "./night-metrics";
import {
  clearMealWriteConsent,
  hasMealWriteConsent,
  markMealWriteEnabled,
} from "./health-consent";

export { hasMealWriteConsent };

export interface HealthMeal {
  id: string;
  name: string;
  startIso: string;
  endIso: string;
  /** Bump on every edit — HealthKit replaces samples by (sync id, version). */
  version: number;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  water_ml?: number;
  caffeine_mg?: number;
}

const isIos = () => Capacitor.getPlatform() === "ios";
// captureException already console.errors and never throws.
const report = (where: string, e: unknown) => captureException(e, { where });

/**
 * Ask for HealthKit share permission and, if granted, remember it.
 * The caller shows the "why" first — this raises the system sheet.
 */
export async function enableMealWrite(): Promise<boolean> {
  if (!isIos()) return false;
  try {
    const r = await HealthNight.requestMealWriteAuthorization();
    if (!r?.granted) return false;
    markMealWriteEnabled();
    return true;
  } catch (e) {
    report("enableMealWrite", e);
    return false;
  }
}

/** Local toggle only — iOS permission stays as the user set it in Health. */
export function disableMealWrite(): void {
  clearMealWriteConsent();
}

export async function writeMealToHealth(meal: HealthMeal): Promise<boolean> {
  if (!isIos() || !hasMealWriteConsent()) return false;
  try {
    const args: MealWriteArgs = {
      meal_id: meal.id,
      name: meal.name,
      start: meal.startIso,
      end: meal.endIso,
      version: meal.version,
      kcal: meal.kcal,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      water_ml: meal.water_ml,
      caffeine_mg: meal.caffeine_mg,
    };
    const r = await HealthNight.writeMeal(args);
    return !!r?.written;
  } catch (e) {
    report("writeMealToHealth", e);
    return false;
  }
}

export async function deleteMealFromHealth(id: string): Promise<boolean> {
  if (!isIos() || !hasMealWriteConsent()) return false;
  try {
    const r = await HealthNight.deleteMeal({ meal_id: id });
    return (r?.deleted ?? 0) > 0;
  } catch (e) {
    report("deleteMealFromHealth", e);
    return false;
  }
}
