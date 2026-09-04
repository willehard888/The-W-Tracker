// Catalog rows → engine Food: the vector is keyed by nutrient key, servings keep
// their order/units/default, and a nutrient the source lacks stays absent.
import { describe, expect, it } from "vitest";
import { foodFromRows, servingUnitFor } from "../food-adapter";

const food = { id: "f1", name: "Oat milk", brand: "Oatly", source: "off", owner_id: null, category: "Plant-based drinks" };
const defs = [
  { id: 1, key: "kcal" },
  { id: 2, key: "protein_g" },
  { id: 3, key: "fiber_g" },
  { id: 99, key: "not_a_key" },
];

describe("foodFromRows", () => {
  it("keys the per-100 g vector by nutrient key and keeps absent nutrients absent", () => {
    const f = foodFromRows(
      food,
      [],
      [
        { nutrient_id: 1, amount_per_100g: 46 },
        { nutrient_id: 2, amount_per_100g: 1 },
        { nutrient_id: 99, amount_per_100g: 5 },
        { nutrient_id: 404, amount_per_100g: 5 },
      ],
      defs,
    );
    expect(f.per100g).toEqual({ kcal: 46, protein_g: 1 });
    expect("fiber_g" in f.per100g).toBe(false);
    expect(f).toMatchObject({ id: "f1", name: "Oat milk", brand: "Oatly", source: "off", ownerId: null, density_g_per_ml: null, ml_based: true });
  });

  it("maps servings in sort order with units + the default serving id", () => {
    const f = foodFromRows(
      { ...food, category: null },
      [
        { id: "s2", label: "1 cup (240 g)", grams: 240, source_unit: "cup", is_default: false, sort_order: 2 },
        { id: "s1", label: "1 glass (200 g)", grams: 200, source_unit: "serving", is_default: true, sort_order: 1 },
        { id: "s3", label: "1 rkl (15 g)", grams: 15, source_unit: "RKL", is_default: false, sort_order: 3 },
      ],
      [],
      defs,
    );
    expect(f.servings.map((s) => [s.id, s.unit, s.grams])).toEqual([
      ["s1", "serving", 200],
      ["s2", "cup", 240],
      ["s3", "tbsp", 15],
    ]);
    expect(f.defaultServingId).toBe("s1");
    expect(f.ml_based).toBe(false);
  });

  it("has no default serving id when none is flagged (or there are none)", () => {
    expect(foodFromRows(food, [{ id: "s1", label: "x", grams: 1, source_unit: null, is_default: false }], [], defs).defaultServingId).toBeNull();
    expect(foodFromRows(food, [], [], defs).servings).toEqual([]);
  });
});

describe("servingUnitFor", () => {
  it("maps known codes and falls back to serving", () => {
    expect(servingUnitFor("KPL")).toBe("piece");
    expect(servingUnitFor("slice")).toBe("piece");
    expect(servingUnitFor("tsp")).toBe("tsp");
    expect(servingUnitFor("TL")).toBe("tsp");
    expect(servingUnitFor("tablespoon")).toBe("tbsp");
    expect(servingUnitFor("custom")).toBe("custom");
    expect(servingUnitFor("PORT")).toBe("serving");
    expect(servingUnitFor(null)).toBe("serving");
  });
});
