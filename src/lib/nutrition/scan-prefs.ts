/**
 * Scan preferences — client twin of profiles.nutrition_prefs (loose jsonb,
 * absent key = default). Twin of notification-prefs.ts.
 */

export const PLATE_OPTIONS = [21, 26, 30] as const;
export const PLATE_DEFAULT = 26;
export const PLATE_MIN = 18;
export const PLATE_MAX = 32;

export interface NutritionPrefs {
  /** The user's dinner-plate diameter in cm — the scanner's best size reference. */
  plate_cm: number;
}

/** Malformed or missing input degrades to a 26 cm plate — never throws. */
export const getNutritionPrefs = (raw: unknown): NutritionPrefs => {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = typeof obj.plate_cm === "number" && Number.isFinite(obj.plate_cm) ? Math.round(obj.plate_cm) : PLATE_DEFAULT;
  return { plate_cm: Math.min(PLATE_MAX, Math.max(PLATE_MIN, n)) };
};
