/**
 * Adapters from persisted diary rows to what the diary screen renders.
 * Pure: the snapshot on the row is the truth, so no engine call is needed
 * to display a logged item.
 */
import type { MealLogItemRow, NutritionTargetsRow } from "./api-types";
import type { MacroSummary } from "@/components/nutrition/MacroRow";
import { fmtQty } from "./format";

export interface MealItemDisplay {
  id: string;
  name: string;
  brand?: string | null;
  qtyLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  pending?: boolean;
  isNew?: boolean;
}

const g = (n: number) => (Number.isInteger(n) ? `${n} g` : `${Math.round(n)} g`);

/** "150 g" · "1½ servings · 45 g" · "1 serving · 30 g" — grams always present so the number is checkable. */
export function qtyLabelFor(item: Pick<MealLogItemRow, "grams" | "serving_qty" | "kind">): string {
  if (item.kind === "quick") return "quick add";
  if (item.serving_qty != null && item.serving_qty > 0) {
    const n = item.serving_qty;
    return `${fmtQty(n)} ${n === 1 ? "serving" : "servings"} · ${g(item.grams)}`;
  }
  return g(item.grams);
}

export function itemToDisplay(item: MealLogItemRow, flags: { pending?: boolean; isNew?: boolean } = {}): MealItemDisplay {
  const s = item.snapshot;
  return {
    id: item.id,
    name: item.display_name,
    qtyLabel: qtyLabelFor(item),
    kcal: s.kcal ?? 0,
    protein: s.protein_g ?? 0,
    carbs: s.carbs_g ?? 0,
    fat: s.fat_g ?? 0,
    pending: flags.pending,
    isNew: flags.isNew,
  };
}

/** The four numbers the macro components take, from a targets row (null → no targets). */
export const targetsToMacros = (t: NutritionTargetsRow | null): MacroSummary | null =>
  t ? { calories: t.kcal, protein: t.protein_g, carbs: t.carbs_g, fat: t.fat_g } : null;
