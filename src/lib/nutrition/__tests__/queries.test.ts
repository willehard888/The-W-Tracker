// Pure fetchers with a chain-stub client: what gets sent to which table/RPC and
// how replies (and errors) come back typed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deactivateUserFood,
  deleteMeal,
  deleteMealItem,
  deleteRecipe,
  duplicateMeal,
  fetchDay,
  fetchFavorites,
  fetchFood,
  fetchNutrientDefinitions,
  fetchRecipes,
  fetchTargets,
  fetchTotals,
  fetchUserFoods,
  logMeal,
  lookupBarcode,
  recipePerServing,
  recordScanReview,
  searchFoods,
  searchOnline,
  setFavorite,
  updateMealItem,
  upsertRecipe,
  upsertTargets,
  upsertUserFood,
  type Db,
} from "../queries";
import type { LogMealArgs } from "../offline-meals";

type Chain = Record<string, ReturnType<typeof vi.fn>> & { then: (r: (v: unknown) => void) => void };
/** Thenable query-builder stub: every method chains, awaiting resolves. */
const chain = (result: unknown): Chain => {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "lte", "in", "order", "limit", "maybeSingle", "delete", "insert", "upsert", "update", "abortSignal"]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  (b as { then?: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return b as Chain;
};

/** A client whose `from` dispatches per table and whose rpc/invoke are plain mocks. */
const client = (opts: { tables?: Record<string, Chain>; rpc?: unknown; invoke?: unknown } = {}) => {
  const from = vi.fn((table: string) => opts.tables?.[table] ?? chain({ data: [] }));
  const rpc = vi.fn().mockReturnValue(opts.rpc ?? chain({ data: null }));
  const invoke = vi.fn().mockResolvedValue(opts.invoke ?? { data: { found: false, foods: [] }, error: null });
  return { db: { from, rpc, functions: { invoke } } as unknown as Db, from, rpc, invoke };
};

const meal = (id: string, over: Record<string, unknown> = {}) => ({
  id, user_id: "u1", log_date: "2026-09-04", tz_offset_minutes: 180, meal_slot: "lunch", logged_at: "2026-09-04T10:00:00Z",
  source: "manual", note: null, photo_path: null, kcal: 500, protein_g: 30, carbs_g: 40, fat_g: 20,
  created_at: "2026-09-04T10:00:00Z", updated_at: "2026-09-04T10:00:00Z", ...over,
});
const item = (id: string, meal_log_id: string) => ({
  id, meal_log_id, user_id: "u1", kind: "food", food_id: "f1", recipe_id: null, grams: 100, serving_id: null, serving_qty: null,
  display_name: "Rice", snapshot: { kcal: 130, protein_g: 2.7 }, snapshot_version: 1, sort_order: 0,
  created_at: "2026-09-04T10:00:00Z", updated_at: "2026-09-04T10:00:00Z",
});
const searchRow = { id: "f1", kind: "food", name: "Oat milk", brand: "Oatly", source: "off", country: "FI", data_quality: 3, default_serving_label: null, default_serving_grams: null, kcal: 46, protein_g: 1, carbs_g: 6.6, fat_g: 1.5, is_favorite: false, use_count: 0, rank: 0.9 };
const httpError = (status: number) => Object.assign(new Error("Edge Function returned a non-2xx status code"), { context: { status } });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("fetchDay", () => {
  it("loads the date's meals, then their items in one IN query", async () => {
    const meals = chain({ data: [meal("m1"), meal("m2")] });
    const items = chain({ data: [item("i1", "m1"), item("i2", "m2"), { id: "bad" }] });
    const c = client({ tables: { meal_logs: meals, meal_log_items: items } });
    const day = await fetchDay(c.db, "u1", "2026-09-04");
    expect(meals.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(meals.eq).toHaveBeenCalledWith("log_date", "2026-09-04");
    expect(items.in).toHaveBeenCalledWith("meal_log_id", ["m1", "m2"]);
    expect(day.meals.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(day.items.map((i) => [i.id, i.meal_log_id])).toEqual([["i1", "m1"], ["i2", "m2"]]);
    expect(day.items[0].snapshot).toEqual({ kcal: 130, protein_g: 2.7 });
  });

  it("skips the items query on an empty day and throws on a PG error", async () => {
    const c = client({ tables: { meal_logs: chain({ data: [] }) } });
    expect(await fetchDay(c.db, "u1", "2026-09-04")).toEqual({ meals: [], items: [] });
    expect(c.from).toHaveBeenCalledTimes(1);
    const bad = client({ tables: { meal_logs: chain({ data: null, error: { message: "permission denied", code: "42501" } }) } });
    await expect(fetchDay(bad.db, "u1", "2026-09-04")).rejects.toThrow("permission denied");
  });
});

describe("fetchTotals", () => {
  it("parses the first day of daily_nutrition_totals (numbers may be strings)", async () => {
    const c = client({ rpc: chain({ data: [{ log_date: "2026-09-04", totals: { kcal: "1200", protein_g: 80 }, by_slot: { lunch: { kcal: 700 } }, meal_count: "2", item_count: 5, targets: null }] }) });
    const day = await fetchTotals(c.db, "2026-09-04");
    expect(c.rpc).toHaveBeenCalledWith("daily_nutrition_totals", { p_from: "2026-09-04" });
    expect(day).toMatchObject({ log_date: "2026-09-04", totals: { kcal: 1200, protein_g: 80 }, meal_count: 2, item_count: 5, targets: null });
    expect(day?.by_slot.lunch).toEqual({ kcal: 700 });
  });
  it("returns null for an empty reply", async () => {
    expect(await fetchTotals(client({ rpc: chain({ data: [] }) }).db, "2026-09-04")).toBeNull();
  });
});

describe("searchFoods", () => {
  it("omits p_barcode (server default NULL) and forwards the abort signal", async () => {
    const q = chain({ data: [searchRow, { nope: true }] });
    const c = client({ rpc: q });
    const ac = new AbortController();
    const rows = await searchFoods(c.db, { query: "oat", country: "FI", signal: ac.signal });
    const args = c.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(c.rpc.mock.calls[0][0]).toBe("search_foods");
    expect(args).toMatchObject({ p_query: "oat", p_limit: 25, p_country: "FI" });
    expect(args.p_barcode ?? null).toBeNull();
    expect(q.abortSignal).toHaveBeenCalledWith(ac.signal);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "f1", name: "Oat milk", kcal: 46 });
  });
  it("does not touch abortSignal without a signal and rethrows errors", async () => {
    const q = chain({ data: null, error: { message: "boom" } });
    await expect(searchFoods(client({ rpc: q }).db, { query: "oat" })).rejects.toThrow("boom");
    expect(q.abortSignal).not.toHaveBeenCalled();
  });
});

describe("lookupBarcode", () => {
  it("hits the local catalog first (no edge call)", async () => {
    const c = client({ rpc: chain({ data: [searchRow] }) });
    const r = await lookupBarcode(c.db, { code: "7310865004703", country: "FI" });
    expect(r).toEqual({ status: "hit", row: expect.objectContaining({ id: "f1" }) });
    expect(c.rpc).toHaveBeenCalledWith("search_foods", { p_query: "", p_limit: 1, p_country: "FI", p_barcode: "7310865004703" });
    expect(c.invoke).not.toHaveBeenCalled();
  });
  it("falls back to nutrition-lookup and returns its row", async () => {
    const c = client({ rpc: chain({ data: [] }), invoke: { data: { found: true, foods: [searchRow] }, error: null } });
    const r = await lookupBarcode(c.db, { code: "7310865004703" });
    expect(c.invoke).toHaveBeenCalledWith("nutrition-lookup", { body: { barcode: "7310865004703", country: undefined } });
    expect(r.status).toBe("hit");
    expect(r.row?.id).toBe("f1");
  });
  it("miss when neither side knows the code (a barcode RPC error is not fatal)", async () => {
    const c = client({ rpc: chain({ data: null, error: { message: "x" } }), invoke: { data: { found: false, foods: [] }, error: null } });
    expect(await lookupBarcode(c.db, { code: "1" })).toEqual({ status: "miss", row: null });
  });
  it("maps 403 → membership_required and 503/429/upstream_rate_limited → rate_limited", async () => {
    const empty = chain({ data: [] });
    expect((await lookupBarcode(client({ rpc: empty, invoke: { data: null, error: httpError(403) } }).db, { code: "1" })).status).toBe("membership_required");
    expect((await lookupBarcode(client({ rpc: empty, invoke: { data: null, error: httpError(503) } }).db, { code: "1" })).status).toBe("rate_limited");
    expect((await lookupBarcode(client({ rpc: empty, invoke: { data: null, error: httpError(429) } }).db, { code: "1" })).status).toBe("rate_limited");
    expect((await lookupBarcode(client({ rpc: empty, invoke: { data: { error: "upstream_rate_limited" }, error: null } }).db, { code: "1" })).status).toBe("rate_limited");
    expect((await lookupBarcode(client({ rpc: empty, invoke: { data: null, error: new Error("Failed to fetch") } }).db, { code: "1" })).status).toBe("error");
  });
  it("gives up after the 8 s budget", async () => {
    vi.useFakeTimers();
    const c = client({ rpc: chain({ data: [] }) });
    c.invoke.mockReturnValue(new Promise(() => {}));
    const p = lookupBarcode(c.db, { code: "1" });
    await vi.advanceTimersByTimeAsync(8_100);
    expect(await p).toEqual({ status: "error", row: null });
  });
});

describe("searchOnline", () => {
  it("uses text mode and returns every row", async () => {
    const c = client({ invoke: { data: { found: true, foods: [searchRow, { ...searchRow, id: "f2" }] }, error: null } });
    const r = await searchOnline(c.db, { query: "kaurajuoma", country: "FI" });
    expect(c.invoke).toHaveBeenCalledWith("nutrition-lookup", { body: { q: "kaurajuoma", country: "FI" } });
    expect(r.status).toBe("hit");
    expect(r.rows.map((x) => x.id)).toEqual(["f1", "f2"]);
  });
});

describe("fetchFood", () => {
  it("assembles the engine Food from four parallel reads", async () => {
    const c = client({
      tables: {
        foods: chain({ data: { id: "f1", name: "Rice", brand: null, source: "fineli", owner_id: null, category: "Grains" } }),
        food_servings: chain({ data: [{ id: "s1", label: "1 dl (85 g)", grams: 85, source_unit: "DL", is_default: true, sort_order: 0 }] }),
        food_nutrients: chain({ data: [{ nutrient_id: 1, amount_per_100g: 130 }] }),
        nutrient_definitions: chain({ data: [{ id: 1, key: "kcal" }] }),
      },
    });
    const f = await fetchFood(c.db, "f1");
    expect(f).toMatchObject({ id: "f1", per100g: { kcal: 130 }, defaultServingId: "s1", ml_based: false });
    expect(f?.servings[0]).toEqual({ id: "s1", unit: "serving", label: "1 dl (85 g)", grams: 85 });
  });
  it("returns null for an unknown id and throws on a PG error", async () => {
    expect(await fetchFood(client({ tables: { foods: chain({ data: null }) } }).db, "nope")).toBeNull();
    await expect(fetchFood(client({ tables: { foods: chain({ data: null, error: { message: "boom" } }) } }).db, "f1")).rejects.toThrow("boom");
  });
});

describe("logMeal", () => {
  const args: LogMealArgs = {
    p_meal_id: "m1", p_log_date: "2026-09-04", p_tz_offset_minutes: 180, p_meal_slot: "lunch",
    p_items: [{ id: "i1", kind: "food", food_id: "f1", grams: 100 }], p_note: null, p_source: "manual", p_photo_path: null,
  };
  it("throws with the PG message so callers can branch on PREMIUM_REQUIRED", async () => {
    const c = client({ rpc: chain({ data: null, error: { message: "PREMIUM_REQUIRED", code: "P0001" } }) });
    await expect(logMeal(c.db, args)).rejects.toMatchObject({ message: "PREMIUM_REQUIRED", code: "P0001" });
  });
  it("sends nulls as omitted params and parses the payload", async () => {
    const c = client({ rpc: chain({ data: { meal: meal("m1"), items: [item("i1", "m1")], totals: { kcal: 130 } } }) });
    const p = await logMeal(c.db, args);
    expect(c.rpc).toHaveBeenCalledWith("log_meal", expect.objectContaining({ p_meal_id: "m1", p_items: args.p_items, p_source: "manual" }));
    expect(c.rpc.mock.calls[0][1]).not.toHaveProperty("p_note", null);
    expect(p.meal.id).toBe("m1");
    expect(p.items).toHaveLength(1);
    expect(p.totals).toEqual({ kcal: 130 });
  });
  it("rejects a malformed payload", async () => {
    await expect(logMeal(client({ rpc: chain({ data: { nope: 1 } }) }).db, args)).rejects.toThrow("INVALID_PAYLOAD");
  });
});

describe("updateMealItem / duplicateMeal / deletes", () => {
  it("updateMealItem forwards the patch and returns item + meal", async () => {
    const c = client({ rpc: chain({ data: { item: item("i1", "m1"), meal: meal("m1") } }) });
    const r = await updateMealItem(c.db, "i1", { grams: 150 });
    expect(c.rpc).toHaveBeenCalledWith("update_meal_item", { p_item_id: "i1", p_grams: 150, p_serving_id: undefined, p_serving_qty: undefined });
    expect(r.item.id).toBe("i1");
    expect(r.meal.id).toBe("m1");
    await expect(updateMealItem(client({ rpc: chain({ data: {} }) }).db, "i1", {})).rejects.toThrow("INVALID_PAYLOAD");
  });
  it("duplicateMeal maps its args", async () => {
    const c = client({ rpc: chain({ data: { meal: meal("m2"), items: [], totals: {} } }) });
    const p = await duplicateMeal(c.db, { sourceMealId: "m1", newMealId: "m2", date: "2026-09-05", tz: 180, slot: "dinner" });
    expect(c.rpc).toHaveBeenCalledWith("duplicate_meal", { p_source_meal_id: "m1", p_new_meal_id: "m2", p_log_date: "2026-09-05", p_tz_offset_minutes: 180, p_meal_slot: "dinner" });
    expect(p.meal.id).toBe("m2");
    await expect(duplicateMeal(client({ rpc: chain({ data: null, error: { message: "FORBIDDEN" } }) }).db, { sourceMealId: "m1", newMealId: "m2", date: "d", tz: 0, slot: "snack" })).rejects.toThrow("FORBIDDEN");
  });
  it("deletes by id on the right tables", async () => {
    const items = chain({ error: null });
    const meals = chain({ error: null });
    const recipes = chain({ error: null });
    const c = client({ tables: { meal_log_items: items, meal_logs: meals, nutrition_recipes: recipes } });
    await deleteMealItem(c.db, "i1");
    await deleteMeal(c.db, "m1");
    await deleteRecipe(c.db, "r1");
    expect(items.delete).toHaveBeenCalled();
    expect(items.eq).toHaveBeenCalledWith("id", "i1");
    expect(meals.eq).toHaveBeenCalledWith("id", "m1");
    expect(recipes.eq).toHaveBeenCalledWith("id", "r1");
    await expect(deleteMeal(client({ tables: { meal_logs: chain({ error: { message: "nope" } }) } }).db, "m1")).rejects.toThrow("nope");
  });
});

describe("targets", () => {
  it("fetchTargets takes the latest row effective on or before today", async () => {
    const t = chain({ data: { id: "t1", user_id: "u1", effective_from: "2026-09-01", kcal: 2200, protein_g: 150, carbs_g: 220, fat_g: 70, fiber_g: null, water_ml: null, micro_targets: {}, method: "manual", activity_level: null, created_at: "" } });
    const c = client({ tables: { nutrition_targets: t } });
    const row = await fetchTargets(c.db, "u1", "2026-09-04");
    expect(t.lte).toHaveBeenCalledWith("effective_from", "2026-09-04");
    expect(t.order).toHaveBeenCalledWith("effective_from", { ascending: false });
    expect(row?.kcal).toBe(2200);
    expect(await fetchTargets(client({ tables: { nutrition_targets: chain({ data: null }) } }).db, "u1", "d")).toBeNull();
  });
  it("upsertTargets sends the patch and parses the row", async () => {
    const c = client({ rpc: chain({ data: { id: "t1", kcal: 2000, protein_g: 140 } }) });
    const row = await upsertTargets(c.db, { kcal: 2000, protein_g: 140 });
    expect(c.rpc).toHaveBeenCalledWith("upsert_nutrition_targets", { p_patch: { kcal: 2000, protein_g: 140 } });
    expect(row).toMatchObject({ id: "t1", kcal: 2000, protein_g: 140 });
    await expect(upsertTargets(client({ rpc: chain({ data: { id: "t1", kcal: null } }) }).db, { protein_g: 1 })).rejects.toThrow("INVALID_PAYLOAD");
  });
});

describe("favorites", () => {
  it("fetchFavorites returns ids", async () => {
    const c = client({ tables: { food_favorites: chain({ data: [{ food_id: "a" }, { food_id: "b" }] }) } });
    expect(await fetchFavorites(c.db, "u1")).toEqual(["a", "b"]);
  });
  it("setFavorite upserts on, deletes off", async () => {
    const fav = chain({ error: null });
    const c = client({ tables: { food_favorites: fav } });
    await setFavorite(c.db, "u1", "f1", true);
    expect(fav.upsert).toHaveBeenCalledWith({ user_id: "u1", food_id: "f1" }, expect.objectContaining({ ignoreDuplicates: true }));
    expect(fav.delete).not.toHaveBeenCalled();
    await setFavorite(c.db, "u1", "f1", false);
    expect(fav.delete).toHaveBeenCalled();
    expect(fav.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(fav.eq).toHaveBeenCalledWith("food_id", "f1");
    await expect(setFavorite(client({ tables: { food_favorites: chain({ error: { message: "rls" } }) } }).db, "u1", "f1", true)).rejects.toThrow("rls");
  });
});

describe("user foods + recipes + definitions", () => {
  it("upsertUserFood returns the id; rejects a non-uuid reply", async () => {
    const c = client({ rpc: chain({ data: "f9" }) });
    expect(await upsertUserFood(c.db, { name: "Mun proteiinipatukka", nutrients: { kcal: 380 } })).toBe("f9");
    expect(c.rpc).toHaveBeenCalledWith("upsert_user_food", { p_food: { name: "Mun proteiinipatukka", nutrients: { kcal: 380 } } });
    await expect(upsertUserFood(client({ rpc: chain({ data: null }) }).db, { name: "x", nutrients: {} })).rejects.toThrow("INVALID_PAYLOAD");
  });
  it("fetchUserFoods filters owner + active; deactivateUserFood soft-deletes", async () => {
    const foods = chain({ data: [{ id: "f9" }] });
    const c = client({ tables: { foods } });
    expect(await fetchUserFoods(c.db, "u1")).toEqual([{ id: "f9" }]);
    expect(foods.eq).toHaveBeenCalledWith("owner_id", "u1");
    expect(foods.eq).toHaveBeenCalledWith("is_active", true);
    await deactivateUserFood(c.db, "f9");
    expect(foods.update).toHaveBeenCalledWith({ is_active: false });
    expect(foods.eq).toHaveBeenCalledWith("id", "f9");
  });
  it("fetchRecipes groups items under their recipe", async () => {
    const recipes = chain({ data: [{ id: "r1", name: "A" }, { id: "r2", name: "B" }] });
    const items = chain({ data: [{ id: "x", recipe_id: "r2", food_id: "f1", grams: 10, sort_order: 0 }] });
    const c = client({ tables: { nutrition_recipes: recipes, nutrition_recipe_items: items } });
    const out = await fetchRecipes(c.db, "u1");
    expect(items.in).toHaveBeenCalledWith("recipe_id", ["r1", "r2"]);
    expect(out.map((r) => [r.id, r.items.length])).toEqual([["r1", 0], ["r2", 1]]);
    expect(await fetchRecipes(client({ tables: { nutrition_recipes: chain({ data: [] }) } }).db, "u1")).toEqual([]);
  });
  it("upsertRecipe parses the row + per-serving vector", async () => {
    const c = client({ rpc: chain({ data: { recipe: { id: "r1", user_id: "u1", name: "Chili", servings: "4", total_grams: null, notes: null, created_at: "c", updated_at: "u" }, per_serving: { kcal: 410, junk: 1 } } }) });
    const r = await upsertRecipe(c.db, { name: "Chili", servings: 4, items: [{ food_id: "f1", grams: 500 }] });
    expect(r.recipe).toEqual({ id: "r1", user_id: "u1", name: "Chili", servings: 4, total_grams: null, notes: null, created_at: "c", updated_at: "u" });
    expect(r.per_serving).toEqual({ kcal: 410 });
    await expect(upsertRecipe(client({ rpc: chain({ data: {} }) }).db, { name: "x", servings: 1, items: [] })).rejects.toThrow("INVALID_PAYLOAD");
  });
  it("recipePerServing + fetchNutrientDefinitions", async () => {
    expect(await recipePerServing(client({ rpc: chain({ data: { protein_g: 12 } }) }).db, "r1")).toEqual({ protein_g: 12 });
    const defs = chain({ data: [{ id: 1, key: "kcal", name_en: "Energy", name_fi: "Energia", unit: "kcal", category: "macro", sort_order: 0 }] });
    const c = client({ tables: { nutrient_definitions: defs } });
    expect(await fetchNutrientDefinitions(c.db)).toHaveLength(1);
    expect(defs.order).toHaveBeenCalledWith("sort_order");
    await expect(fetchNutrientDefinitions(client({ tables: { nutrient_definitions: chain({ data: null, error: { message: "down" } }) } }).db)).rejects.toThrow("down");
  });
  it("recordScanReview hands the rows to the RPC and rethrows its error", async () => {
    const rows = [{ item_index: 0, model_name: "egg", model_grams: 55, model_food_id: "f1", final_food_id: "f1", final_grams: 60, action: "grams_edited" as const }];
    const c = client({ rpc: chain({ data: 1 }) });
    expect(await recordScanReview(c.db, "s1", rows)).toBe(1);
    expect(c.rpc).toHaveBeenCalledWith("record_scan_review", { p_scan_id: "s1", p_rows: rows });
    await expect(recordScanReview(client({ rpc: chain({ data: null, error: { message: "FORBIDDEN" } }) }).db, "s1", rows)).rejects.toThrow("FORBIDDEN");
  });
});
