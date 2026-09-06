import { describe, it, expect } from "vitest";
import { buildReviewRows, gramChips, liquidGrams, liquidMl } from "../scan-review";
import type { ScanItem } from "../scan-types";

const item = (over: Partial<ScanItem> = {}): ScanItem => ({
  id: "i1",
  name: "chicken",
  category: "protein",
  preparation: "grilled",
  grams: 150,
  grams_low: 100,
  grams_high: 200,
  count: null,
  is_liquid: false,
  ml: null,
  density_g_per_ml: null,
  unit_g: null,
  box: null,
  identification_confidence: 0.9,
  portion_confidence: 0.6,
  needs_user_choice: false,
  selected_food_id: "f1",
  candidates: [{ food_id: "f1", name: "Chicken", brand: null, similarity: 0.8, rank: 0.8, default_serving_grams: 120, default_serving_label: "1 fillet", per_100g: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 } }],
  online_lookup: "skipped",
  pass2: false,
  preview: null,
  ...over,
});

describe("buildReviewRows", () => {
  it("classifies kept, grams_edited, recandidated, removed and added", () => {
    const scanned = [item(), item({ id: "i2", grams: 100 }), item({ id: "i3" }), item({ id: "i4" })];
    const final = [item(), item({ id: "i2", grams: 130 }), item({ id: "i3", selected_food_id: "f2" }), item({ id: "i9", name: "rice", selected_food_id: "f3", grams: 80 })];
    const rows = buildReviewRows(scanned, final);
    expect(rows.map((r) => r.action)).toEqual(["kept", "grams_edited", "recandidated", "removed", "added"]);
    expect(rows[1]).toMatchObject({ item_index: 1, model_grams: 100, final_grams: 130, model_food_id: "f1", final_food_id: "f1" });
    expect(rows[3]).toMatchObject({ item_index: 3, final_food_id: null, final_grams: null });
    expect(rows[4]).toMatchObject({ item_index: 4, model_name: "rice", model_grams: null, final_food_id: "f3", final_grams: 80 });
  });

  it("treats a sub-gram nudge as kept and caps at 24 rows", () => {
    expect(buildReviewRows([item()], [item({ grams: 150.4 })])[0].action).toBe("kept");
    const many = Array.from({ length: 30 }, (_, i) => item({ id: `i${i}` }));
    expect(buildReviewRows(many, many)).toHaveLength(24);
  });
});

describe("gramChips", () => {
  it("offers low, estimate, high and the default serving, rounded to 5, ascending", () => {
    expect(gramChips(item())).toEqual([100, 120, 150, 200]);
    expect(gramChips(item({ grams_low: 103, grams: 148, grams_high: 202, candidates: [] }))).toEqual([105, 150, 200]);
  });

  it("dedupes and never exceeds four", () => {
    expect(gramChips(item({ grams_low: 150, grams: 150, grams_high: 150, candidates: [] }))).toEqual([150]);
    expect(gramChips(item({ grams_low: 50, grams: 100, grams_high: 300, selected_food_id: "f1" }))).toHaveLength(4);
  });

  it("speaks millilitres for liquids", () => {
    expect(gramChips(item({ ml: 200, density_g_per_ml: 1.03, grams: 206, grams_low: 155, grams_high: 258, candidates: [] }))).toEqual([150, 200, 250]);
  });
});

describe("liquid conversions", () => {
  it("round-trips through the density and default to water", () => {
    expect(liquidGrams(200, 1.03)).toBe(206);
    expect(liquidMl(206, 1.03)).toBe(200);
    expect(liquidGrams(250, null)).toBe(250);
  });
});
