// Recipe math must agree with the server rule (totals × qty / servings) and
// never store anything; recipeAsFood feeds the same portion UI as a food.
import { describe, it, expect } from "vitest";
import { recipeTotals, perServing, recipeTotalGrams, recipeAsFood, MIN_SERVINGS } from "../recipe";
import { resolveGrams } from "../resolve-grams";
import { scale } from "../scale";
import type { Food } from "../types";

const rice: Food = { id: "rice", name: "Rice", source: "fineli", per100g: { kcal: 130, carbs_g: 28, fiber_g: 0.4 }, servings: [] };
const oil: Food = { id: "oil", name: "Oil", source: "fineli", per100g: { kcal: 884, fat_g: 100 }, servings: [] };
const items = [
  { food: rice, grams: 200 },
  { food: oil, grams: 10 },
];

describe("recipeTotals", () => {
  it("sums scaled ingredients; keys present in any ingredient survive", () => {
    expect(recipeTotals(items)).toEqual({
      kcal: 348.4,
      carbs_g: 56,
      fiber_g: 0.8,
      fat_g: 10,
      carbs_total_g: 56.8,
      net_carbs_g: 56,
      kj: 1457.706,
    });
  });

  it("is empty for no ingredients", () => {
    expect(recipeTotals([])).toEqual({});
  });
});

describe("perServing", () => {
  it("divides every key and rounds to 3 decimals", () => {
    expect(perServing({ kcal: 100, protein_g: 1 }, 3)).toEqual({ ok: true, vector: { kcal: 33.333, protein_g: 0.333 } });
  });

  it(`rejects servings below ${MIN_SERVINGS} or non-finite`, () => {
    expect(perServing({ kcal: 100 }, 0.25)).toMatchObject({ ok: true });
    expect(perServing({ kcal: 100 }, 0.2)).toEqual({ ok: false, error: "invalid_servings" });
    expect(perServing({ kcal: 100 }, 0)).toEqual({ ok: false, error: "invalid_servings" });
    expect(perServing({ kcal: 100 }, NaN)).toEqual({ ok: false, error: "invalid_servings" });
  });
});

describe("recipeTotalGrams", () => {
  it("uses the cooked-weight override when positive, else the ingredient sum", () => {
    expect(recipeTotalGrams({ items, totalGrams: 180 })).toBe(180);
    expect(recipeTotalGrams({ items, totalGrams: 0 })).toBe(210);
    expect(recipeTotalGrams({ items, totalGrams: null })).toBe(210);
    expect(recipeTotalGrams({ items })).toBe(210);
  });
});

describe("recipeAsFood", () => {
  it("normalises totals to per 100 g and exposes one serving", () => {
    const f = recipeAsFood({ id: "r1", name: "Fried rice", servings: 2, items });
    expect(f.source).toBe("recipe");
    expect(f.per100g.kcal).toBe(165.905); // 348.4 / 210 × 100
    expect(f.per100g.kj).toBe(694.147); // 165.905 × 4.184
    expect(f.servings).toEqual([{ id: "r1:serving", unit: "serving", label: "serving", grams: 105 }]);
    expect(f.defaultServingId).toBe("r1:serving");
  });

  it("cooked-weight override changes density, not totals", () => {
    const f = recipeAsFood({ id: "r1", name: "x", servings: 2, totalGrams: 300, items });
    expect(f.per100g.kcal).toBe(116.133); // 348.4 / 300 × 100
    expect(f.servings[0].grams).toBe(150);
  });

  it("logging one serving through resolveGrams + scale ≈ perServing", () => {
    const f = recipeAsFood({ id: "r1", name: "x", servings: 2, items });
    const r = resolveGrams(f, 1, "serving");
    expect(r).toEqual({ ok: true, grams: 105, approx: false });
    const logged = scale(f.per100g, 105);
    const ps = perServing(recipeTotals(items), 2);
    expect(ps.ok && Math.abs((logged.kcal ?? 0) - (ps.vector.kcal ?? 0))).toBeLessThan(0.01);
  });

  it("0 total grams → empty per100g and an unloggable serving", () => {
    const f = recipeAsFood({ id: "r0", name: "x", servings: 2, items: [] });
    expect(f.per100g).toEqual({});
    expect(f.servings[0].grams).toBeNull();
    expect(resolveGrams(f, 1, "serving")).toEqual({ ok: false, error: "no_serving" });
  });

  it("invalid servings → unloggable serving", () => {
    expect(recipeAsFood({ id: "r", name: "x", servings: 0, items }).servings[0].grams).toBeNull();
  });
});
