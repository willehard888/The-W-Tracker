// Every logged portion passes through resolveGrams; a wrong branch here is a
// wrong number in the diary. Each ResolveResult variant is locked.
import { describe, it, expect } from "vitest";
import { parseQty, resolveGrams, availableUnits, HOUSEHOLD_ML, MAX_GRAMS } from "../resolve-grams";
import type { Food, Serving } from "../types";

const serving = (over: Partial<Serving> = {}): Serving => ({
  id: "s1",
  unit: "serving",
  label: "1 serving",
  grams: 80,
  ...over,
});

const food = (over: Partial<Food> = {}): Food => ({
  id: "f1",
  name: "Oats",
  source: "fineli",
  per100g: { kcal: 370 },
  servings: [],
  ...over,
});

describe("parseQty", () => {
  it("accepts numbers, decimal strings with . or , and whitespace", () => {
    expect(parseQty(2)).toBe(2);
    expect(parseQty(0)).toBe(0);
    expect(parseQty("1.5")).toBe(1.5);
    expect(parseQty("1,5")).toBe(1.5);
    expect(parseQty(" 2 ")).toBe(2);
    expect(parseQty(".5")).toBe(0.5);
  });

  it("accepts simple and mixed fractions", () => {
    expect(parseQty("1/2")).toBe(0.5);
    expect(parseQty("1 1/2")).toBe(1.5);
    expect(parseQty("3/4")).toBe(0.75);
  });

  it("rejects NaN, Infinity, negatives, division by zero and garbage", () => {
    expect(parseQty(NaN)).toBeNull();
    expect(parseQty(Infinity)).toBeNull();
    expect(parseQty(-1)).toBeNull();
    expect(parseQty("-1")).toBeNull();
    expect(parseQty("1/0")).toBeNull();
    expect(parseQty("abc")).toBeNull();
    expect(parseQty("1.5.5")).toBeNull();
    expect(parseQty("")).toBeNull();
    expect(parseQty(null)).toBeNull();
    expect(parseQty({})).toBeNull();
  });
});

describe("resolveGrams — failure variants", () => {
  it("unknown_food when the food is missing", () => {
    expect(resolveGrams(null, 1, "g")).toEqual({ ok: false, error: "unknown_food" });
    expect(resolveGrams(undefined, 1, "g")).toEqual({ ok: false, error: "unknown_food" });
  });

  it("invalid_qty for unparseable quantities", () => {
    expect(resolveGrams(food(), "x", "g")).toEqual({ ok: false, error: "invalid_qty" });
    expect(resolveGrams(food(), -5, "g")).toEqual({ ok: false, error: "invalid_qty" });
  });

  it("unit_unavailable for ml without density or ml_based", () => {
    expect(resolveGrams(food(), 100, "ml")).toEqual({ ok: false, error: "unit_unavailable" });
    expect(resolveGrams(food(), 1, "cup")).toEqual({ ok: false, error: "unit_unavailable" });
  });

  it("no_serving when the serving has no weight or the unit has no serving", () => {
    expect(resolveGrams(food({ servings: [serving({ grams: null })] }), 1, "serving")).toEqual({ ok: false, error: "no_serving" });
    expect(resolveGrams(food(), 1, "piece")).toEqual({ ok: false, error: "no_serving" });
    expect(resolveGrams(food(), 1, "custom")).toEqual({ ok: false, error: "no_serving" });
  });

  it("too_large above MAX_GRAMS (boundary: exactly MAX_GRAMS is fine)", () => {
    expect(resolveGrams(food(), MAX_GRAMS, "g")).toEqual({ ok: true, grams: MAX_GRAMS, approx: false });
    expect(resolveGrams(food(), MAX_GRAMS + 0.01, "g")).toEqual({ ok: false, error: "too_large" });
    expect(resolveGrams(food(), 1e9, "g")).toEqual({ ok: false, error: "too_large" });
  });
});

describe("resolveGrams — units", () => {
  it("g passes through; 0 is a valid quantity", () => {
    expect(resolveGrams(food(), "1,5", "g")).toEqual({ ok: true, grams: 1.5, approx: false });
    expect(resolveGrams(food(), 0, "g")).toEqual({ ok: true, grams: 0, approx: false });
  });

  it("ml uses density when known", () => {
    expect(resolveGrams(food({ density_g_per_ml: 1.03 }), 200, "ml")).toEqual({ ok: true, grams: 206, approx: false });
  });

  it("ml on an ml_based food counts 1:1 with the approx flag", () => {
    expect(resolveGrams(food({ ml_based: true }), 250, "ml")).toEqual({ ok: true, grams: 250, approx: true, reason: "ml_as_g" });
  });

  it("density wins over ml_based; a non-positive density is ignored", () => {
    expect(resolveGrams(food({ density_g_per_ml: 0.9, ml_based: true }), 100, "ml")).toEqual({ ok: true, grams: 90, approx: false });
    expect(resolveGrams(food({ density_g_per_ml: 0, ml_based: true }), 100, "ml")).toMatchObject({ approx: true });
  });

  it("household units without a serving go through the ml path", () => {
    const f = food({ density_g_per_ml: 1 });
    expect(resolveGrams(f, 1, "cup")).toEqual({ ok: true, grams: HOUSEHOLD_ML.cup, approx: false });
    expect(resolveGrams(f, 2, "tbsp")).toEqual({ ok: true, grams: 30, approx: false });
    expect(resolveGrams(f, "1/2", "tsp")).toEqual({ ok: true, grams: 2.5, approx: false });
  });

  it("a household serving from the source beats the generic ml volume", () => {
    const f = food({ density_g_per_ml: 1, servings: [serving({ id: "c", unit: "cup", grams: 90 })] });
    expect(resolveGrams(f, 1, "cup")).toEqual({ ok: true, grams: 90, approx: false });
  });

  it("serving units use the matching servingId, else the first serving of that unit", () => {
    const f = food({
      servings: [serving({ id: "a", unit: "piece", grams: 30 }), serving({ id: "b", unit: "piece", grams: 55 })],
    });
    expect(resolveGrams(f, 2, "piece", "b")).toEqual({ ok: true, grams: 110, approx: false });
    expect(resolveGrams(f, 2, "piece")).toEqual({ ok: true, grams: 60, approx: false });
    // id of another unit is ignored, falls back to first of the requested unit
    expect(resolveGrams(f, 1, "piece", "s1")).toEqual({ ok: true, grams: 30, approx: false });
  });

  it("custom multiplies by customGrams; an invalid customGrams falls back to a custom serving", () => {
    expect(resolveGrams(food(), 3, "custom", null, 12.5)).toEqual({ ok: true, grams: 37.5, approx: false });
    const f = food({ servings: [serving({ id: "k", unit: "custom", grams: 20 })] });
    expect(resolveGrams(f, 2, "custom", "k", NaN)).toEqual({ ok: true, grams: 40, approx: false });
  });

  it("rounds the result to 2 decimals", () => {
    expect(resolveGrams(food({ density_g_per_ml: 1.234 }), 1, "ml")).toEqual({ ok: true, grams: 1.23, approx: false });
    expect(resolveGrams(food(), "1/3", "g")).toEqual({ ok: true, grams: 0.33, approx: false });
  });
});

describe("availableUnits", () => {
  it("only g for a bare solid food", () => {
    expect(availableUnits(food())).toEqual(["g"]);
  });

  it("adds ml + household volumes for liquids (density or ml_based)", () => {
    expect(availableUnits(food({ density_g_per_ml: 1 }))).toEqual(["g", "ml", "cup", "tbsp", "tsp"]);
    expect(availableUnits(food({ ml_based: true }))).toEqual(["g", "ml", "cup", "tbsp", "tsp"]);
  });

  it("adds serving units that carry a weight, in canonical order, without duplicates", () => {
    const f = food({
      servings: [
        serving({ id: "1", unit: "piece", grams: 30 }),
        serving({ id: "2", unit: "piece", grams: 60 }),
        serving({ id: "3", unit: "serving", grams: 100 }),
        serving({ id: "4", unit: "tbsp", grams: 12 }),
        serving({ id: "5", unit: "cup", grams: null }),
      ],
    });
    expect(availableUnits(f)).toEqual(["g", "serving", "piece", "tbsp"]);
  });
});
