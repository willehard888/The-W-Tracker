import { describe, it, expect } from "vitest";
import {
  parseDailyTotals,
  parseMealPayload,
  parseSearchFoodRows,
  parseTargetsRow,
  toNum,
  vectorFromJson,
} from "../api-types";

const meal = {
  id: "m1", user_id: "u1", log_date: "2026-09-05", tz_offset_minutes: 180, meal_slot: "lunch", logged_at: "2026-09-05T11:00:00Z",
  source: "manual", note: null, photo_path: null, kcal: "412.5", protein_g: 38, carbs_g: 30, fat_g: 12, created_at: "x", updated_at: "y",
};
const item = {
  id: "i1", meal_log_id: "m1", user_id: "u1", kind: "food", food_id: "f1", recipe_id: null, grams: 150, serving_id: null, serving_qty: null,
  display_name: "Chicken breast", snapshot: { kcal: 247.5, protein_g: 46.5, bogus: 9, fat_g: "5.4" }, snapshot_version: 1, sort_order: 0, created_at: "x", updated_at: "y",
};

describe("toNum / vectorFromJson", () => {
  it("accepts numbers and numeric strings, rejects the rest", () => {
    expect(toNum(3)).toBe(3);
    expect(toNum("2.5")).toBe(2.5);
    expect(toNum("")).toBeNull();
    expect(toNum("abc")).toBeNull();
    expect(toNum(Infinity)).toBeNull();
    expect(toNum(null)).toBeNull();
  });
  it("keeps only canonical nutrient keys", () => {
    expect(vectorFromJson({ kcal: 100, protein_g: "10", bogus: 1, fat_g: "x" })).toEqual({ kcal: 100, protein_g: 10 });
    expect(vectorFromJson(null)).toEqual({});
  });
});

describe("parseSearchFoodRows", () => {
  it("parses rows and drops malformed ones", () => {
    const rows = parseSearchFoodRows([
      { id: "f1", kind: "food", name: "Chicken", brand: null, source: "fineli", country: "FI", data_quality: 1, default_serving_label: "1 fillet", default_serving_grams: "150", kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, is_favorite: true, use_count: 4, rank: 0.91 },
      { id: "r1", kind: "recipe", name: "My bowl", source: "user" },
      { name: "no id" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].default_serving_grams).toBe(150);
    expect(rows[0].is_favorite).toBe(true);
    expect(rows[1].kind).toBe("recipe");
    expect(rows[1].kcal).toBeNull();
    expect(parseSearchFoodRows("nope")).toEqual([]);
  });
});

describe("parseMealPayload", () => {
  it("parses meal, items and totals from the RPC jsonb", () => {
    const p = parseMealPayload({ meal, items: [item, { id: "bad" }], totals: { kcal: 412.5, protein_g: 38 } });
    expect(p?.meal.kcal).toBe(412.5);
    expect(p?.meal.meal_slot).toBe("lunch");
    expect(p?.items).toHaveLength(1);
    expect(p?.items[0].snapshot).toEqual({ kcal: 247.5, protein_g: 46.5, fat_g: 5.4 });
    expect(p?.totals.protein_g).toBe(38);
  });
  it("returns null without a meal", () => {
    expect(parseMealPayload({ items: [] })).toBeNull();
    expect(parseMealPayload(null)).toBeNull();
  });
  it("coerces an unknown slot to snack", () => {
    expect(parseMealPayload({ meal: { ...meal, meal_slot: "brunch" }, items: [], totals: {} })?.meal.meal_slot).toBe("snack");
  });
});

describe("parseTargetsRow / parseDailyTotals", () => {
  const targets = { id: "t1", user_id: "u1", effective_from: "2026-09-01", kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 80, fiber_g: null, water_ml: 2500, micro_targets: { iron_mg: 8 }, method: "mifflin", activity_level: "moderate", created_at: "x" };
  it("parses a targets row and rejects one without kcal", () => {
    expect(parseTargetsRow(targets)?.micro_targets).toEqual({ iron_mg: 8 });
    expect(parseTargetsRow({ id: "t2" })).toBeNull();
  });
  it("parses days with per-slot vectors and the targets in force", () => {
    const days = parseDailyTotals([
      { log_date: "2026-09-05", totals: { kcal: 1200 }, by_slot: { lunch: { kcal: 700 }, dinner: { kcal: 500 }, brunch: { kcal: 1 } }, meal_count: 2, item_count: 5, targets },
      { log_date: "2026-09-06", totals: {}, by_slot: {}, meal_count: 0, item_count: 0, targets: null },
      { nope: true },
    ]);
    expect(days).toHaveLength(2);
    expect(days[0].by_slot.lunch?.kcal).toBe(700);
    expect(days[0].by_slot).not.toHaveProperty("brunch");
    expect(days[0].targets?.kcal).toBe(2400);
    expect(days[1].targets).toBeNull();
    expect(parseDailyTotals({})).toEqual([]);
  });
});
