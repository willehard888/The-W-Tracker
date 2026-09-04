import { describe, it, expect } from "vitest";
import { itemToDisplay, qtyLabelFor, targetsToMacros } from "../diary-view";
import type { MealLogItemRow } from "../api-types";

const row = (over: Partial<MealLogItemRow> = {}): MealLogItemRow => ({
  id: "i1", meal_log_id: "m1", user_id: "u1", kind: "food", food_id: "f1", recipe_id: null, grams: 150, serving_id: null, serving_qty: null,
  display_name: "Chicken breast", snapshot: { kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 }, snapshot_version: 1, sort_order: 0, created_at: "", updated_at: "",
  ...over,
});

describe("qtyLabelFor", () => {
  it("shows grams alone, servings with grams, and quick adds", () => {
    expect(qtyLabelFor(row())).toBe("150 g");
    expect(qtyLabelFor(row({ grams: 45, serving_id: "s1", serving_qty: 1.5 }))).toBe("1½ servings · 45 g");
    expect(qtyLabelFor(row({ grams: 30, serving_id: "s1", serving_qty: 1 }))).toBe("1 serving · 30 g");
    expect(qtyLabelFor(row({ kind: "quick", grams: 1 }))).toBe("quick add");
    expect(qtyLabelFor(row({ grams: 33.3 }))).toBe("33 g");
  });
});

describe("itemToDisplay", () => {
  it("reads macros from the snapshot and carries flags", () => {
    const d = itemToDisplay(row(), { pending: true, isNew: true });
    expect(d).toMatchObject({ id: "i1", name: "Chicken breast", kcal: 247.5, protein: 46.5, carbs: 0, fat: 5.4, pending: true, isNew: true });
  });
  it("treats a missing macro as 0 for display", () => {
    expect(itemToDisplay(row({ snapshot: { kcal: 100 } })).protein).toBe(0);
  });
});

describe("targetsToMacros", () => {
  it("maps a targets row and passes null through", () => {
    expect(targetsToMacros({ id: "t", user_id: "u", effective_from: "d", kcal: 2400, protein_g: 160, carbs_g: 260, fat_g: 80, fiber_g: null, water_ml: null, micro_targets: {}, method: "manual", activity_level: null, created_at: "" }))
      .toEqual({ calories: 2400, protein: 160, carbs: 260, fat: 80 });
    expect(targetsToMacros(null)).toBeNull();
  });
});
