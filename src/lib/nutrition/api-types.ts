/**
 * Shapes the nutrition RPCs return, and tolerant parsers for them.
 * KEEP IN SYNC with supabase/migrations/20260905100400_nutrition_engine.sql:
 * `search_foods` RETURNS TABLE, `meal_payload` (returned by log_meal,
 * update_meal_item, duplicate_meal), `daily_nutrition_totals`, and the
 * `nutrition_targets` row. jsonb comes back as `Json` from the generated
 * client types, so every consumer goes through these parsers.
 */
import type { MealSlot, NutrientKey, NutrientVector } from "./types";
import { NUTRIENT_KEYS } from "./types";

export interface SearchFoodRow {
  id: string;
  kind: "food" | "recipe";
  name: string;
  brand: string | null;
  source: string;
  country: string | null;
  data_quality: number;
  default_serving_label: string | null;
  default_serving_grams: number | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_favorite: boolean;
  use_count: number;
  rank: number;
  /** Boost-free text similarity (0..1); absent from responses older than 20260906100000. */
  match_score?: number | null;
}

export interface MealLogRow {
  id: string;
  user_id: string;
  log_date: string;
  tz_offset_minutes: number;
  meal_slot: MealSlot;
  logged_at: string;
  source: string;
  note: string | null;
  photo_path: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
  updated_at: string;
}

export interface MealLogItemRow {
  id: string;
  meal_log_id: string;
  user_id: string;
  kind: "food" | "recipe" | "quick";
  food_id: string | null;
  recipe_id: string | null;
  grams: number;
  serving_id: string | null;
  serving_qty: number | null;
  display_name: string;
  snapshot: NutrientVector;
  snapshot_version: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MealPayload {
  meal: MealLogRow;
  items: MealLogItemRow[];
  totals: NutrientVector;
}

export interface NutritionTargetsRow {
  id: string;
  user_id: string;
  effective_from: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  water_ml: number | null;
  micro_targets: NutrientVector;
  method: string;
  activity_level: string | null;
  created_at: string;
}

export interface DailyTotalsDay {
  log_date: string;
  totals: NutrientVector;
  by_slot: Partial<Record<MealSlot, NutrientVector>>;
  meal_count: number;
  item_count: number;
  targets: NutritionTargetsRow | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const KEY_SET: ReadonlySet<string> = new Set<string>(NUTRIENT_KEYS);
const SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

/** numeric columns may arrive as JSON numbers or as strings; anything else is null. */
export const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const toStr = (v: unknown): string | null => (typeof v === "string" ? v : null);
const req = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/** Keep only canonical nutrient keys with finite numeric values. */
export function vectorFromJson(v: unknown): NutrientVector {
  if (!isRecord(v)) return {};
  const out: NutrientVector = {};
  for (const [k, raw] of Object.entries(v)) {
    if (!KEY_SET.has(k)) continue;
    const n = toNum(raw);
    if (n !== null) out[k as NutrientKey] = n;
  }
  return out;
}

export function parseSearchFoodRow(v: unknown): SearchFoodRow | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.name !== "string") return null;
  return {
    id: v.id,
    kind: v.kind === "recipe" ? "recipe" : "food",
    name: v.name,
    brand: toStr(v.brand),
    source: req(v.source, "user"),
    country: toStr(v.country),
    data_quality: toNum(v.data_quality) ?? 5,
    default_serving_label: toStr(v.default_serving_label),
    default_serving_grams: toNum(v.default_serving_grams),
    kcal: toNum(v.kcal),
    protein_g: toNum(v.protein_g),
    carbs_g: toNum(v.carbs_g),
    fat_g: toNum(v.fat_g),
    is_favorite: v.is_favorite === true,
    use_count: toNum(v.use_count) ?? 0,
    rank: toNum(v.rank) ?? 0,
    match_score: toNum(v.match_score),
  };
}

export const parseSearchFoodRows = (v: unknown): SearchFoodRow[] =>
  Array.isArray(v) ? v.map(parseSearchFoodRow).filter((r): r is SearchFoodRow => r !== null) : [];

export function parseMealLogRow(v: unknown): MealLogRow | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.log_date !== "string") return null;
  const slot = SLOTS.find((s) => s === v.meal_slot) ?? "snack";
  return {
    id: v.id,
    user_id: req(v.user_id),
    log_date: v.log_date,
    tz_offset_minutes: toNum(v.tz_offset_minutes) ?? 0,
    meal_slot: slot,
    logged_at: req(v.logged_at),
    source: req(v.source, "manual"),
    note: toStr(v.note),
    photo_path: toStr(v.photo_path),
    kcal: toNum(v.kcal) ?? 0,
    protein_g: toNum(v.protein_g) ?? 0,
    carbs_g: toNum(v.carbs_g) ?? 0,
    fat_g: toNum(v.fat_g) ?? 0,
    created_at: req(v.created_at),
    updated_at: req(v.updated_at),
  };
}

export function parseMealLogItemRow(v: unknown): MealLogItemRow | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.meal_log_id !== "string") return null;
  const kind = v.kind === "recipe" ? "recipe" : v.kind === "quick" ? "quick" : "food";
  return {
    id: v.id,
    meal_log_id: v.meal_log_id,
    user_id: req(v.user_id),
    kind,
    food_id: toStr(v.food_id),
    recipe_id: toStr(v.recipe_id),
    grams: toNum(v.grams) ?? 0,
    serving_id: toStr(v.serving_id),
    serving_qty: toNum(v.serving_qty),
    display_name: req(v.display_name, "Food"),
    snapshot: vectorFromJson(v.snapshot),
    snapshot_version: toNum(v.snapshot_version) ?? 1,
    sort_order: toNum(v.sort_order) ?? 0,
    created_at: req(v.created_at),
    updated_at: req(v.updated_at),
  };
}

export function parseMealPayload(v: unknown): MealPayload | null {
  if (!isRecord(v)) return null;
  const meal = parseMealLogRow(v.meal);
  if (!meal) return null;
  const items = Array.isArray(v.items) ? v.items.map(parseMealLogItemRow).filter((i): i is MealLogItemRow => i !== null) : [];
  return { meal, items, totals: vectorFromJson(v.totals) };
}

export function parseTargetsRow(v: unknown): NutritionTargetsRow | null {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  const kcal = toNum(v.kcal);
  if (kcal === null) return null;
  return {
    id: v.id,
    user_id: req(v.user_id),
    effective_from: req(v.effective_from),
    kcal,
    protein_g: toNum(v.protein_g) ?? 0,
    carbs_g: toNum(v.carbs_g) ?? 0,
    fat_g: toNum(v.fat_g) ?? 0,
    fiber_g: toNum(v.fiber_g),
    water_ml: toNum(v.water_ml),
    micro_targets: vectorFromJson(v.micro_targets),
    method: req(v.method, "manual"),
    activity_level: toStr(v.activity_level),
    created_at: req(v.created_at),
  };
}

export function parseDailyTotals(v: unknown): DailyTotalsDay[] {
  if (!Array.isArray(v)) return [];
  const days: DailyTotalsDay[] = [];
  for (const d of v) {
    if (!isRecord(d) || typeof d.log_date !== "string") continue;
    const by_slot: Partial<Record<MealSlot, NutrientVector>> = {};
    if (isRecord(d.by_slot)) {
      for (const s of SLOTS) if (s in d.by_slot) by_slot[s] = vectorFromJson(d.by_slot[s]);
    }
    days.push({
      log_date: d.log_date,
      totals: vectorFromJson(d.totals),
      by_slot,
      meal_count: toNum(d.meal_count) ?? 0,
      item_count: toNum(d.item_count) ?? 0,
      targets: parseTargetsRow(d.targets),
    });
  }
  return days;
}
