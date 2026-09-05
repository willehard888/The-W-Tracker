/**
 * Pure fetchers/mutators of the nutrition data layer. Every function takes the
 * Supabase client first so hooks, prefetchers and the offline replay share one
 * implementation and unit tests can pass a chain stub. PG errors are rethrown
 * with their raw message (PREMIUM_REQUIRED, FOOD_NOT_FOUND, duplicate key…)
 * so callers can branch on them; app-voice copy is the hook's job.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  parseDailyTotals,
  parseMealLogItemRow,
  parseMealLogRow,
  parseMealPayload,
  parseSearchFoodRows,
  parseTargetsRow,
  toNum,
  vectorFromJson,
  type DailyTotalsDay,
  type MealLogItemRow,
  type MealLogRow,
  type MealPayload,
  type NutritionTargetsRow,
  type SearchFoodRow,
} from "./api-types";
import { foodFromRows } from "./food-adapter";
import type { LogMealArgs } from "./offline-meals";
import type { ReviewRow } from "./scan-review";
import type { Food, MealSlot, NutrientVector } from "./types";

export type Db = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];
export type NutrientDefinition = Pick<
  Tables["nutrient_definitions"]["Row"],
  "id" | "key" | "name_en" | "name_fi" | "unit" | "category" | "sort_order"
>;
export type FoodRow = Tables["foods"]["Row"];
export type RecipeRow = Tables["nutrition_recipes"]["Row"];
export type RecipeItemRow = Tables["nutrition_recipe_items"]["Row"];
export type RecipeWithItems = RecipeRow & { items: RecipeItemRow[] };
export type LookupStatus = "hit" | "miss" | "rate_limited" | "membership_required" | "error";

export interface SearchArgs {
  query: string;
  country?: string;
  limit?: number;
  signal?: AbortSignal;
}
export interface MealItemPatch {
  grams?: number;
  serving_id?: string;
  serving_qty?: number;
}
/** `upsert_nutrition_targets` patch — COALESCE-merged onto the row for `effective_from` (default today). */
export type TargetsPatch = {
  effective_from?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  water_ml?: number;
  micro_targets?: NutrientVector;
  method?: string;
  activity_level?: string;
};
/** `upsert_user_food` payload — nutrients per 100 g keyed by nutrient key. */
export type UserFoodPayload = {
  id?: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  nutrients: NutrientVector;
  servings?: Array<{ label: string; grams: number; is_default?: boolean; sort_order?: number }>;
  barcode?: string | null;
};
/** `upsert_recipe` payload (1..60 items). */
export type RecipePayload = {
  id?: string;
  name: string;
  servings: number;
  total_grams?: number | null;
  notes?: string | null;
  items: Array<{ food_id: string; grams: number; sort_order?: number }>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonNull = <T,>(v: T | null): v is T => v !== null;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Log + rethrow as an Error carrying the raw message and PG code. */
function raise(tag: string, error: { message: string; code?: string }): never {
  console.error(`[nutrition] ${tag}`, error);
  throw Object.assign(new Error(error.message), { code: error.code });
}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error("nutrition-lookup timeout")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
};

// ---------- catalog ----------

/** All nutrient definitions (labels/units), sort_order ascending. */
export async function fetchNutrientDefinitions(client: Db): Promise<NutrientDefinition[]> {
  const { data, error } = await client
    .from("nutrient_definitions")
    .select("id, key, name_en, name_fi, unit, category, sort_order")
    .order("sort_order");
  if (error) raise("nutrient_definitions", error);
  return data ?? [];
}

/** Catalog search (`search_foods`: trigram + favorites/recents boost); aborts with `signal`. */
export async function searchFoods(client: Db, { query, country, limit = 25, signal }: SearchArgs): Promise<SearchFoodRow[]> {
  // p_barcode is omitted (JSON drops undefined) → the RPC's DEFAULT NULL text branch.
  let q = client.rpc("search_foods", { p_query: query, p_limit: limit, p_country: country, p_barcode: undefined });
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) raise("search_foods", error);
  return parseSearchFoodRows(data);
}

interface LookupBody {
  found?: boolean;
  foods?: unknown;
  error?: string;
}

/** `nutrition-lookup` edge function (barcode or text mode) folded into one status + rows. */
async function invokeLookup(
  client: Db,
  body: { barcode?: string; q?: string; country?: string },
  ms: number,
): Promise<{ status: LookupStatus; rows: SearchFoodRow[] }> {
  try {
    const { data, error } = await withTimeout(client.functions.invoke<LookupBody>("nutrition-lookup", { body }), ms);
    if (error) {
      // FunctionsHttpError carries the Response on `context`; 403 = no active membership.
      const status = (error as { context?: { status?: number } }).context?.status;
      console.error("[nutrition] nutrition-lookup", error);
      if (status === 403) return { status: "membership_required", rows: [] };
      if (status === 503 || status === 429) return { status: "rate_limited", rows: [] };
      return { status: "error", rows: [] };
    }
    if (data?.error === "upstream_rate_limited") return { status: "rate_limited", rows: [] };
    const rows = parseSearchFoodRows(data?.foods);
    return { status: data?.found && rows.length ? "hit" : "miss", rows };
  } catch (e) {
    console.error("[nutrition] nutrition-lookup", e);
    return { status: "error", rows: [] };
  }
}

/** Barcode → local catalog hit, else the online lookup (8 s budget). */
export async function lookupBarcode(
  client: Db,
  { code, country }: { code: string; country?: string },
): Promise<{ status: LookupStatus; row: SearchFoodRow | null }> {
  const { data, error } = await client.rpc("search_foods", { p_query: "", p_limit: 1, p_country: country, p_barcode: code });
  if (error) console.error("[nutrition] search_foods barcode", error);
  const local = parseSearchFoodRows(data)[0];
  if (local) return { status: "hit", row: local };
  const r = await invokeLookup(client, { barcode: code, country }, 8_000);
  return { status: r.status, row: r.rows[0] ?? null };
}

/** Explicit online text search (OFF + USDA Branded → ingested → `search_foods` rows), 12 s budget. */
export const searchOnline = (client: Db, { query, country }: { query: string; country?: string }) =>
  invokeLookup(client, { q: query, country }, 12_000);

/** One catalog/user food as the engine `Food` (servings + per-100 g vector), or null when unknown. */
export async function fetchFood(client: Db, id: string): Promise<Food | null> {
  const [f, s, n, d] = await Promise.all([
    client.from("foods").select("*").eq("id", id).maybeSingle(),
    client.from("food_servings").select("*").eq("food_id", id).order("sort_order"),
    client.from("food_nutrients").select("nutrient_id, amount_per_100g").eq("food_id", id),
    client.from("nutrient_definitions").select("id, key"),
  ]);
  if (f.error) raise("foods", f.error);
  if (!f.data) return null;
  if (s.error) raise("food_servings", s.error);
  if (n.error) raise("food_nutrients", n.error);
  if (d.error) raise("nutrient_definitions", d.error);
  return foodFromRows(f.data, s.data ?? [], n.data ?? [], d.data ?? []);
}

// ---------- diary ----------

/** Meals + items of one local date (meals by logged_at; items by sort_order, created_at). */
export async function fetchDay(client: Db, uid: string, date: string): Promise<{ meals: MealLogRow[]; items: MealLogItemRow[] }> {
  const m = await client.from("meal_logs").select("*").eq("user_id", uid).eq("log_date", date).order("logged_at");
  if (m.error) raise("meal_logs", m.error);
  const meals = (m.data ?? []).map(parseMealLogRow).filter(nonNull);
  if (meals.length === 0) return { meals, items: [] };
  const i = await client
    .from("meal_log_items")
    .select("*")
    .in("meal_log_id", meals.map((x) => x.id))
    .order("sort_order")
    .order("created_at");
  if (i.error) raise("meal_log_items", i.error);
  return { meals, items: (i.data ?? []).map(parseMealLogItemRow).filter(nonNull) };
}

/** `daily_nutrition_totals` for one date (totals, by_slot, counts, effective targets), or null. */
export async function fetchTotals(client: Db, date: string): Promise<DailyTotalsDay | null> {
  const { data, error } = await client.rpc("daily_nutrition_totals", { p_from: date });
  if (error) raise("daily_nutrition_totals", error);
  return parseDailyTotals(data)[0] ?? null;
}

/** `log_meal` → {meal, items, totals}. Throws with the PG message (PREMIUM_REQUIRED, FOOD_NOT_FOUND…). */
export async function logMeal(client: Db, args: LogMealArgs): Promise<MealPayload> {
  const { data, error } = await client.rpc("log_meal", {
    p_meal_id: args.p_meal_id,
    p_log_date: args.p_log_date,
    p_tz_offset_minutes: args.p_tz_offset_minutes,
    p_meal_slot: args.p_meal_slot,
    p_items: args.p_items,
    p_note: args.p_note ?? undefined,
    p_source: args.p_source ?? undefined,
    p_photo_path: args.p_photo_path ?? undefined,
  });
  if (error) raise("log_meal", error);
  return parseMealPayload(data) ?? raise("log_meal", { message: "INVALID_PAYLOAD" });
}

/** `update_meal_item` (server re-snapshots from the current food/recipe) → the item + its meal row. */
export async function updateMealItem(client: Db, itemId: string, patch: MealItemPatch): Promise<{ meal: MealLogRow; item: MealLogItemRow }> {
  const { data, error } = await client.rpc("update_meal_item", {
    p_item_id: itemId,
    p_grams: patch.grams,
    p_serving_id: patch.serving_id,
    p_serving_qty: patch.serving_qty,
  });
  if (error) raise("update_meal_item", error);
  const rec = isRecord(data) ? data : {};
  const meal = parseMealLogRow(rec.meal);
  const item = parseMealLogItemRow(rec.item);
  if (!meal || !item) raise("update_meal_item", { message: "INVALID_PAYLOAD" });
  return { meal, item };
}

/** Delete one diary item (own rows only); the meal's derived macros follow by trigger. */
export async function deleteMealItem(client: Db, itemId: string): Promise<void> {
  const { error } = await client.from("meal_log_items").delete().eq("id", itemId);
  if (error) raise("meal_log_items delete", error);
}

/** Delete a meal and (by cascade) its items. */
export async function deleteMeal(client: Db, mealId: string): Promise<void> {
  const { error } = await client.from("meal_logs").delete().eq("id", mealId);
  if (error) raise("meal_logs delete", error);
}

/** `duplicate_meal` (snapshots copied verbatim) → the new meal's payload. */
export async function duplicateMeal(
  client: Db,
  a: { sourceMealId: string; newMealId: string; date: string; tz: number; slot: MealSlot },
): Promise<MealPayload> {
  const { data, error } = await client.rpc("duplicate_meal", {
    p_source_meal_id: a.sourceMealId,
    p_new_meal_id: a.newMealId,
    p_log_date: a.date,
    p_tz_offset_minutes: a.tz,
    p_meal_slot: a.slot,
  });
  if (error) raise("duplicate_meal", error);
  return parseMealPayload(data) ?? raise("duplicate_meal", { message: "INVALID_PAYLOAD" });
}

// ---------- targets ----------

/** The targets row in effect on `today` (latest effective_from ≤ today), or null. */
export async function fetchTargets(client: Db, uid: string, today: string): Promise<NutritionTargetsRow | null> {
  const { data, error } = await client
    .from("nutrition_targets")
    .select("*")
    .eq("user_id", uid)
    .lte("effective_from", today)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) raise("nutrition_targets", error);
  return parseTargetsRow(data);
}

/** `upsert_nutrition_targets` → the stored row (throws INVALID_PAYLOAD when kcal is still unset). */
export async function upsertTargets(client: Db, patch: TargetsPatch): Promise<NutritionTargetsRow> {
  const { data, error } = await client.rpc("upsert_nutrition_targets", { p_patch: patch });
  if (error) raise("upsert_nutrition_targets", error);
  return parseTargetsRow(data) ?? raise("upsert_nutrition_targets", { message: "INVALID_PAYLOAD" });
}

// ---------- favorites ----------

/** Starred food ids. */
export async function fetchFavorites(client: Db, uid: string): Promise<string[]> {
  const { data, error } = await client.from("food_favorites").select("food_id").eq("user_id", uid);
  if (error) raise("food_favorites", error);
  return (data ?? []).map((r) => r.food_id);
}

/** Star (idempotent upsert) or unstar a food. */
export async function setFavorite(client: Db, uid: string, foodId: string, on: boolean): Promise<void> {
  const { error } = on
    ? await client.from("food_favorites").upsert({ user_id: uid, food_id: foodId }, { onConflict: "user_id,food_id", ignoreDuplicates: true })
    : await client.from("food_favorites").delete().eq("user_id", uid).eq("food_id", foodId);
  if (error) raise("food_favorites", error);
}

// ---------- user foods ----------

/** `upsert_user_food` → the food id (server generates one when absent). */
export async function upsertUserFood(client: Db, payload: UserFoodPayload): Promise<string> {
  const { data, error } = await client.rpc("upsert_user_food", { p_food: payload });
  if (error) raise("upsert_user_food", error);
  return typeof data === "string" ? data : raise("upsert_user_food", { message: "INVALID_PAYLOAD" });
}

/** The user's own active foods, by name. */
export async function fetchUserFoods(client: Db, uid: string): Promise<FoodRow[]> {
  const { data, error } = await client.from("foods").select("*").eq("owner_id", uid).eq("is_active", true).order("name");
  if (error) raise("foods", error);
  return data ?? [];
}

/** Soft-delete a user food (is_active=false): history keeps its name, search/logging stop offering it. */
export async function deactivateUserFood(client: Db, id: string): Promise<void> {
  const { error } = await client.from("foods").update({ is_active: false }).eq("id", id);
  if (error) raise("foods deactivate", error);
}

// ---------- recipes ----------

const parseRecipeRow = (v: unknown): RecipeRow | null => {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.name !== "string") return null;
  return {
    id: v.id,
    user_id: str(v.user_id),
    name: v.name,
    servings: toNum(v.servings) ?? 1,
    total_grams: toNum(v.total_grams),
    notes: typeof v.notes === "string" ? v.notes : null,
    created_at: str(v.created_at),
    updated_at: str(v.updated_at),
  };
};

/** The user's recipes with their ingredient rows (sort_order ascending). */
export async function fetchRecipes(client: Db, uid: string): Promise<RecipeWithItems[]> {
  const r = await client.from("nutrition_recipes").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
  if (r.error) raise("nutrition_recipes", r.error);
  const recipes = r.data ?? [];
  if (recipes.length === 0) return [];
  const i = await client
    .from("nutrition_recipe_items")
    .select("*")
    .in("recipe_id", recipes.map((x) => x.id))
    .order("sort_order");
  if (i.error) raise("nutrition_recipe_items", i.error);
  const items = i.data ?? [];
  return recipes.map((rec) => ({ ...rec, items: items.filter((it) => it.recipe_id === rec.id) }));
}

/** `upsert_recipe` → the stored row + per-serving vector. */
export async function upsertRecipe(client: Db, recipe: RecipePayload): Promise<{ recipe: RecipeRow; per_serving: NutrientVector }> {
  const { data, error } = await client.rpc("upsert_recipe", { p_recipe: recipe });
  if (error) raise("upsert_recipe", error);
  const rec = isRecord(data) ? data : {};
  const row = parseRecipeRow(rec.recipe);
  if (!row) raise("upsert_recipe", { message: "INVALID_PAYLOAD" });
  return { recipe: row, per_serving: vectorFromJson(rec.per_serving) };
}

/** Delete a recipe (items cascade). */
export async function deleteRecipe(client: Db, id: string): Promise<void> {
  const { error } = await client.from("nutrition_recipes").delete().eq("id", id);
  if (error) raise("nutrition_recipes delete", error);
}

/** `recipe_nutrition_per_serving`, computed from the current food rows. */
export async function recipePerServing(client: Db, id: string): Promise<NutrientVector> {
  const { data, error } = await client.rpc("recipe_nutrition_per_serving", { p_recipe_id: id });
  if (error) raise("recipe_nutrition_per_serving", error);
  return vectorFromJson(data);
}

// ---------- photo scan ----------

/** What the user changed after a scan (model guess vs saved value) — `record_scan_review`, returns the rows stored. */
export async function recordScanReview(client: Db, scanId: string, rows: ReviewRow[]): Promise<number> {
  const { data, error } = await client.rpc("record_scan_review", { p_scan_id: scanId, p_rows: rows });
  if (error) raise("record_scan_review", error);
  return toNum(data) ?? 0;
}
