// Quantity + unit → grams. The client ALWAYS sends resolved grams to
// `log_meal`; this is the only place a portion becomes a weight.

import { roundTo } from "./scale";
import type { Food, ResolveResult, Serving, ServingUnit, Unit } from "./types";

/** Household volumes in ml — go through the ml path (density or ml_based). */
export const HOUSEHOLD_ML: Readonly<Partial<Record<Unit, number>>> = { cup: 240, tbsp: 15, tsp: 5 };

/** Hard ceiling for one logged portion (server CHECKs are lower; this is the UI guard). */
export const MAX_GRAMS = 100000;

const UNIT_ORDER: readonly Unit[] = ["g", "ml", "serving", "piece", "cup", "tbsp", "tsp", "custom"];
const DECIMAL = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const FRACTION = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/;

/** Parse a user quantity: number or "1,5" "1.5" "1/2" "1 1/2" " 2 " → number ≥ 0, else null. */
export function parseQty(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? input : null;
  if (typeof input !== "string") return null;
  const s = input.trim().replace(",", ".");
  if (DECIMAL.test(s)) return Number(s);
  const m = FRACTION.exec(s);
  if (!m || Number(m[3]) === 0) return null;
  return Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]);
}

/** Density in g/ml when the source gives a usable one. */
const density = (food: Food): number | null =>
  typeof food.density_g_per_ml === "number" && Number.isFinite(food.density_g_per_ml) && food.density_g_per_ml > 0
    ? food.density_g_per_ml
    : null;

/** ml → grams via density, else 1:1 for ml_based liquids (flagged approx). */
function fromMl(food: Food, ml: number): ResolveResult {
  const d = density(food);
  if (d !== null) return { ok: true, grams: ml * d, approx: false };
  if (food.ml_based) return { ok: true, grams: ml, approx: true, reason: "ml_as_g" };
  return { ok: false, error: "unit_unavailable" };
}

/** The serving a (unit, servingId) pair points at: exact id match, else first of that unit. */
const findServing = (food: Food, unit: ServingUnit, servingId?: string | null): Serving | undefined =>
  (servingId ? food.servings.find((s) => s.id === servingId && s.unit === unit) : undefined) ??
  food.servings.find((s) => s.unit === unit);

/** Resolve a portion to grams (2 decimals), or a typed reason it cannot be resolved. */
export function resolveGrams(
  food: Food | null | undefined,
  qty: unknown,
  unit: Unit,
  servingId?: string | null,
  customGrams?: number | null,
): ResolveResult {
  if (!food) return { ok: false, error: "unknown_food" };
  const q = parseQty(qty);
  if (q === null) return { ok: false, error: "invalid_qty" };
  let r: ResolveResult;
  if (unit === "g") r = { ok: true, grams: q, approx: false };
  else if (unit === "ml") r = fromMl(food, q);
  else if (unit === "custom" && typeof customGrams === "number" && Number.isFinite(customGrams) && customGrams >= 0) {
    r = { ok: true, grams: q * customGrams, approx: false };
  } else {
    const s = findServing(food, unit, servingId);
    const ml = HOUSEHOLD_ML[unit];
    if (s) r = s.grams === null ? { ok: false, error: "no_serving" } : { ok: true, grams: q * s.grams, approx: false };
    else if (ml !== undefined) r = fromMl(food, q * ml);
    else r = { ok: false, error: "no_serving" };
  }
  if (!r.ok) return r;
  const grams = roundTo(r.grams, 2);
  if (grams > MAX_GRAMS) return { ok: false, error: "too_large" };
  return { ...r, grams };
}

/** Units a portion picker may offer for this food, in display order. */
export function availableUnits(food: Food): Unit[] {
  const mlOk = density(food) !== null || food.ml_based === true;
  const hasServing = (u: Unit) => food.servings.some((s) => s.unit === u && s.grams !== null);
  return UNIT_ORDER.filter((u) => {
    if (u === "g") return true;
    if (u === "ml") return mlOk;
    if (HOUSEHOLD_ML[u] !== undefined) return mlOk || hasServing(u);
    return hasServing(u);
  });
}
