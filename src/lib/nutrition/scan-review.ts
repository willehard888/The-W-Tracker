/**
 * Pure helpers around the photo-review screen: what the user changed after a
 * scan (the eval harness's ground truth), the gram chips a row offers, and
 * the ml ↔ g conversion for liquids.
 */
import type { ScanItem } from "./scan-types";

export type ReviewAction = "kept" | "grams_edited" | "recandidated" | "removed" | "added";

/** One row of `record_scan_review` (a type alias so it stays assignable to Json). */
export type ReviewRow = {
  item_index: number;
  model_name: string;
  model_grams: number | null;
  model_food_id: string | null;
  final_food_id: string | null;
  final_grams: number | null;
  action: ReviewAction;
};

const MAX_ROWS = 24;

/** Scanned items vs what was saved: kept / grams_edited (> 0.5 g) / recandidated / removed / added. */
export function buildReviewRows(scanned: ScanItem[], final: ScanItem[]): ReviewRow[] {
  const finalById = new Map(final.map((f) => [f.id, f]));
  const rows: ReviewRow[] = scanned.map((s, i) => {
    const f = finalById.get(s.id);
    const base = { item_index: i, model_name: s.name, model_grams: s.grams, model_food_id: s.selected_food_id };
    if (!f) return { ...base, final_food_id: null, final_grams: null, action: "removed" };
    const action: ReviewAction = f.selected_food_id !== s.selected_food_id ? "recandidated" : Math.abs(f.grams - s.grams) > 0.5 ? "grams_edited" : "kept";
    return { ...base, final_food_id: f.selected_food_id, final_grams: f.grams, action };
  });
  const scannedIds = new Set(scanned.map((s) => s.id));
  final
    .filter((f) => !scannedIds.has(f.id))
    .forEach((f, k) =>
      rows.push({ item_index: scanned.length + k, model_name: f.name, model_grams: null, model_food_id: null, final_food_id: f.selected_food_id, final_grams: f.grams, action: "added" }),
    );
  return rows.slice(0, MAX_ROWS);
}

export const liquidGrams = (ml: number, density: number | null): number => Math.round(ml * (density ?? 1));
export const liquidMl = (grams: number, density: number | null): number => Math.round(grams / (density ?? 1));

const round5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

/**
 * Quick-pick values for a row, in the row's display unit (ml for liquids,
 * g otherwise): low, estimate, high and the chosen food's default serving —
 * rounded to 5, unique, ascending, at most four.
 */
export function gramChips(item: ScanItem): number[] {
  const chosen = item.candidates.find((c) => c.food_id === item.selected_food_id);
  const toUnit = item.ml != null ? (g: number) => liquidMl(g, item.density_g_per_ml) : (g: number) => g;
  const raw = [item.grams_low, item.grams, item.grams_high, chosen?.default_serving_grams ?? NaN].filter((v) => Number.isFinite(v) && v > 0);
  return [...new Set(raw.map((v) => round5(toUnit(v))))].sort((a, b) => a - b).slice(0, 4);
}
