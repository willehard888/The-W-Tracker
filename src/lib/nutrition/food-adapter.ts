// foods / food_servings / food_nutrients rows → the engine's `Food`. Pure, so
// the mapping (nutrient ids → keys, source units → ServingUnit) is unit-tested
// without a client.
import type { Food, NutrientKey, NutrientVector, Serving, ServingUnit } from "./types";
import { NUTRIENT_KEYS } from "./types";

export interface FoodRowLike {
  id: string;
  name: string;
  brand: string | null;
  source: string;
  owner_id: string | null;
  category?: string | null;
}
export interface ServingRowLike {
  id: string;
  label: string;
  grams: number;
  source_unit: string | null;
  is_default: boolean;
  sort_order?: number;
}
export interface NutrientRowLike {
  nutrient_id: number;
  amount_per_100g: number;
}
export interface DefLike {
  id: number;
  key: string;
}

const KEY_SET: ReadonlySet<string> = new Set<string>(NUTRIENT_KEYS);

// Source unit codes/names: Fineli THSCODE ("KPL", "RKL", "TL"), USDA measure
// names ("cup", "tbsp", "piece"), OFF/user "serving". Unknown → "serving".
const UNIT_ALIASES: ReadonlyArray<readonly [RegExp, ServingUnit]> = [
  [/cup|kuppi/, "cup"],
  [/tbsp|tablespoon|^rkl$/, "tbsp"],
  [/tsp|teaspoon|^tl$/, "tsp"],
  [/piece|pcs|^kpl$|slice|viipale/, "piece"],
  [/custom/, "custom"],
];

/** Map a source's unit code/name onto the engine's ServingUnit ("serving" when unknown). */
export function servingUnitFor(sourceUnit: string | null): ServingUnit {
  const u = (sourceUnit ?? "").trim().toLowerCase();
  return UNIT_ALIASES.find(([re]) => re.test(u))?.[1] ?? "serving";
}

// ponytail: liquid = category regex; a real density column replaces this when a source provides one.
const LIQUID = /drink|beverage|juice|milk|water|soda|beer|wine|juoma|mehu|maito|vesi/i;

/** Build the engine `Food` from catalog rows; absent nutrients stay absent (never 0). */
export function foodFromRows(food: FoodRowLike, servings: ServingRowLike[], nutrients: NutrientRowLike[], defs: DefLike[]): Food {
  const keyById = new Map(defs.map((d) => [d.id, d.key]));
  const per100g: NutrientVector = {};
  for (const n of nutrients) {
    const key = keyById.get(n.nutrient_id);
    if (key && KEY_SET.has(key) && Number.isFinite(n.amount_per_100g)) per100g[key as NutrientKey] = n.amount_per_100g;
  }
  const sorted = [...servings].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    source: food.source,
    ownerId: food.owner_id,
    per100g,
    density_g_per_ml: null,
    ml_based: LIQUID.test(food.category ?? ""),
    servings: sorted.map((s): Serving => ({ id: s.id, unit: servingUnitFor(s.source_unit), label: s.label, grams: s.grams })),
    defaultServingId: sorted.find((s) => s.is_default)?.id ?? null,
  };
}
