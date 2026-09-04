// Portion scaling — the client half of the engine contract.
//
// CONTRACT with SQL `nutrition_for_grams(food_id, grams)`:
//   for every stored nutrient: round(amount_per_100g × grams / 100, 3)
//   absent nutrient ⇒ absent key (never 0)
//   derived keys, from the scaled values:
//     carbs_total_g = carbs_g + coalesce(fiber_g, 0)      (only when carbs_g present)
//     net_carbs_g   = carbs_g − coalesce(sugar_alcohol_g, 0) (only when carbs_g present)
//     kj            = round(kcal × 4.184, 3)               (only when kcal present)
// `__fixtures__/contract.json` is asserted against both implementations.
// Postgres rounds numeric half away from zero; for non-negative inputs that is
// half-up, which `roundTo` reproduces for every binary-exact half (x.xxx5 with
// a finite binary expansion) and, via Number.EPSILON, for the common
// near-1 decimal halves. Do not put knife-edge 4th-decimal halves in the fixture.

import { DERIVED_KEYS, NUTRIENT_KEYS, type NutrientKey, type NutrientVector } from "./types";

/** Keys that are stored per 100 g (everything except the derived trio). */
export const BASE_KEYS: readonly NutrientKey[] = NUTRIENT_KEYS.filter(
  (k) => !(DERIVED_KEYS as readonly string[]).includes(k),
);

/** Half-up rounding to `p` decimals for non-negative values (mirrors SQL round). */
export function roundTo(v: number, p: number): number {
  const f = 10 ** p;
  return Math.round((v + Number.EPSILON) * f) / f;
}

/** Scale a per-100 g vector to `grams` exactly like `nutrition_for_grams`. */
export function scale(per100g: NutrientVector, grams: number): NutrientVector {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new RangeError(`grams must be a finite number ≥ 0, got ${grams}`);
  }
  const out: NutrientVector = {};
  for (const k of BASE_KEYS) {
    const v = per100g[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = roundTo((v * grams) / 100, 3);
  }
  return withDerived(out);
}

/** Add the server's derived keys to a scaled (or summed) vector, in place. */
export function withDerived(v: NutrientVector): NutrientVector {
  if (v.carbs_g !== undefined) {
    v.carbs_total_g = roundTo(v.carbs_g + (v.fiber_g ?? 0), 3);
    v.net_carbs_g = roundTo(v.carbs_g - (v.sugar_alcohol_g ?? 0), 3);
  }
  if (v.kcal !== undefined) v.kj = roundTo(v.kcal * 4.184, 3);
  return v;
}
