// Nutrition engine — shared types. `NUTRIENT_KEYS` mirrors
// `nutrient_definitions.key` on the server (plus the three derived keys the
// SQL engine emits); if a key is added there, add it here in the same commit.

/** Canonical nutrient keys (server `nutrient_definitions.key`) + derived keys. */
export const NUTRIENT_KEYS = [
  "kcal", "protein_g", "fat_g", "carbs_g", "fiber_g", "sugar_g", "added_sugar_g",
  "starch_g", "sugar_alcohol_g", "sat_fat_g", "mufa_g", "pufa_g", "trans_fat_g",
  "cholesterol_mg", "omega3_g", "omega6_g", "ala_g", "epa_g", "dha_g", "linoleic_g",
  "vit_a_ug", "vit_b1_mg", "vit_b2_mg", "vit_b3_mg", "vit_b5_mg", "vit_b6_mg",
  "vit_b7_ug", "vit_b9_ug", "vit_b12_ug", "vit_c_mg", "vit_d_ug", "vit_e_mg", "vit_k_ug",
  "calcium_mg", "iron_mg", "magnesium_mg", "phosphorus_mg", "potassium_mg", "sodium_mg",
  "salt_g", "zinc_mg", "copper_mg", "manganese_mg", "selenium_ug", "iodine_ug",
  "choline_mg", "caffeine_mg", "alcohol_g", "water_g",
  // Derived on both sides from the keys above — never stored, never scaled.
  "carbs_total_g", "net_carbs_g", "kj",
] as const;

/** Keys the server computes from stored nutrients (see scale.ts). */
export const DERIVED_KEYS = ["carbs_total_g", "net_carbs_g", "kj"] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type DerivedKey = (typeof DERIVED_KEYS)[number];

/** Absent key = unknown (never 0). Amounts are per the unit in the key name. */
export type NutrientVector = Partial<Record<NutrientKey, number>>;

export type MacroKey = "kcal" | "protein_g" | "carbs_g" | "fat_g";

export type ServingUnit = "serving" | "piece" | "cup" | "tbsp" | "tsp" | "custom";
export type Unit = "g" | "ml" | ServingUnit;

export interface Serving {
  id: string;
  unit: ServingUnit;
  label: string;
  /** null = the source lists the portion without a weight (cannot be logged). */
  grams: number | null;
}

export interface Food {
  id: string;
  name: string;
  brand?: string | null;
  /** `food_sources.code` (fineli, usda_*, off, user) or "recipe" for recipeAsFood. */
  source: string;
  ownerId?: string | null;
  per100g: NutrientVector;
  density_g_per_ml?: number | null;
  /** Liquid without a known density: ml is logged as g with an `approx` flag. */
  ml_based?: boolean;
  servings: Serving[];
  defaultServingId?: string | null;
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface Targets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  water_ml?: number;
  micros?: NutrientVector;
  activity_level?: ActivityLevel;
}

export type ResolveError = "unknown_food" | "invalid_qty" | "unit_unavailable" | "no_serving" | "too_large";

export type ResolveResult =
  | { ok: true; grams: number; approx: false }
  | { ok: true; grams: number; approx: true; reason: "ml_as_g" }
  | { ok: false; error: ResolveError };

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
