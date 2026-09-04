// Recipes are foods made of foods. Totals are computed on read (never stored)
// — mirrors `recipe_nutrition_per_serving` and the log_meal recipe rule
// (snapshot = totals × serving_qty / servings, grams = serving_qty × total_grams / servings).

import { BASE_KEYS, roundTo, scale, withDerived } from "./scale";
import { sumVectors } from "./totals";
import type { Food, NutrientVector } from "./types";

export interface RecipeItem {
  food: Food;
  grams: number;
}

export interface RecipeLike {
  id: string;
  name: string;
  servings: number;
  /** Cooked-weight override; null/absent = sum of ingredient grams. */
  totalGrams?: number | null;
  items: RecipeItem[];
}

/** Smallest serving count a recipe may be divided into. */
export const MIN_SERVINGS = 0.25;

/** Whole-recipe nutrition: every ingredient scaled and summed. */
export function recipeTotals(items: RecipeItem[]): NutrientVector {
  return sumVectors(items.map((i) => scale(i.food.per100g, i.grams))).totals;
}

/** Divide totals by servings (≥ 0.25); each key rounded to 3 decimals. */
export function perServing(
  totals: NutrientVector,
  servings: number,
): { ok: true; vector: NutrientVector } | { ok: false; error: "invalid_servings" } {
  if (!Number.isFinite(servings) || servings < MIN_SERVINGS) return { ok: false, error: "invalid_servings" };
  const vector: NutrientVector = {};
  for (const k of Object.keys(totals) as (keyof NutrientVector)[]) {
    const v = totals[k];
    if (v !== undefined) vector[k] = roundTo(v / servings, 3);
  }
  return { ok: true, vector };
}

/** Sum of ingredient grams, or the cooked-weight override when given. */
export function recipeTotalGrams(recipe: Pick<RecipeLike, "totalGrams" | "items">): number {
  const override = recipe.totalGrams;
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return override;
  return recipe.items.reduce((sum, i) => sum + i.grams, 0);
}

/** Present a recipe as a Food (per100g + one "serving" portion) so the portion UI needs no special case. */
export function recipeAsFood(recipe: RecipeLike): Food {
  const totals = recipeTotals(recipe.items);
  const totalGrams = recipeTotalGrams(recipe);
  const per100g: NutrientVector = {};
  if (totalGrams > 0) {
    for (const k of BASE_KEYS) {
      const v = totals[k];
      if (v !== undefined) per100g[k] = roundTo((v / totalGrams) * 100, 3);
    }
    withDerived(per100g);
  }
  const servingOk = totalGrams > 0 && Number.isFinite(recipe.servings) && recipe.servings >= MIN_SERVINGS;
  return {
    id: recipe.id,
    name: recipe.name,
    source: "recipe",
    per100g,
    servings: [
      { id: `${recipe.id}:serving`, unit: "serving", label: "serving", grams: servingOk ? roundTo(totalGrams / recipe.servings, 3) : null },
    ],
    defaultServingId: `${recipe.id}:serving`,
  };
}
