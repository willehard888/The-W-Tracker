// Pure mapping helpers of the nutrition ingestion scripts (scripts/nutrition/*.mts).
// Lives under src/ because vitest's include is src/**; the scripts run no side effects on import.
import { describe, expect, it } from "vitest";
import { parseCsv, runSelfCheck as csvSelfCheck } from "../../../scripts/nutrition/csv.mts";
import { parseFlags, runSelfCheck as libSelfCheck, type NutrientDef } from "../../../scripts/nutrition/lib.mts";
import { buildFineliFoods, fineliVersion, sentenceCase } from "../../../scripts/nutrition/fineli.mts";
import { buildUsdaFoods, checkUsdaUnits, mapUsdaNutrients, usdaServingLabel, usdaVersion } from "../../../scripts/nutrition/usda.mts";

const defs: NutrientDef[] = [
  { id: 1, key: "kcal", unit: "kcal", fineli_code: "ENERC", fineli_factor: 1 / 4.184, usda_nutrient_id: 1008, usda_factor: 1 },
  { id: 2, key: "protein_g", unit: "g", fineli_code: "PROT", fineli_factor: 1, usda_nutrient_id: 1003, usda_factor: 1 },
  { id: 3, key: "carbs_g", unit: "g", fineli_code: "CHOAVL", fineli_factor: 1, usda_nutrient_id: 1005, usda_factor: 1 },
  { id: 4, key: "fat_g", unit: "g", fineli_code: "FAT", fineli_factor: 1, usda_nutrient_id: 1004, usda_factor: 1 },
  { id: 5, key: "fiber_g", unit: "g", fineli_code: "FIBC", fineli_factor: 1, usda_nutrient_id: 1079, usda_factor: 1 },
  { id: 6, key: "epa_g", unit: "g", fineli_code: "F20D5N3", fineli_factor: 0.001, usda_nutrient_id: 1278, usda_factor: 1 },
  { id: 7, key: "salt_g", unit: "g", fineli_code: "NACL", fineli_factor: 0.001, usda_nutrient_id: 1093, usda_factor: 0.0025 },
  { id: 8, key: "vit_c_mg", unit: "mg", fineli_code: "VITC", fineli_factor: 1, usda_nutrient_id: 1162, usda_factor: 1 },
];

describe("csv + lib self-checks", () => {
  it("pass", () => {
    expect(() => csvSelfCheck()).not.toThrow();
    expect(() => libSelfCheck()).not.toThrow();
    expect(parseCsv("a;b\n1,5;\"x;y\"", { delimiter: ";" })).toEqual([["a", "b"], ["1,5", "x;y"]]);
    expect(parseFlags(["--dry-run", "--limit", "3"])).toEqual({ dryRun: true, limit: 3 });
  });
});

describe("Fineli mapping", () => {
  it("sentence-cases UPPERCASE names and leaves mixed case alone", () => {
    expect(sentenceCase("KANANMUNA, KEITETTY")).toBe("Kananmuna, keitetty");
    expect(sentenceCase("ÄYRIÄINEN")).toBe("Äyriäinen");
    expect(sentenceCase("Already Cased")).toBe("Already Cased");
    expect(fineliVersion("/Fineli_Rel20/food.csv")).toBe("Fineli_Rel20");
    expect(fineliVersion("food.csv", "fineli.zip")).toBe("Fineli");
  });

  it("builds payloads: decimal comma, kJ→kcal, mg→g, unit skip list, unit mismatch, no-kcal skip", () => {
    const { foods, skippedNoKcal, unitMismatches } = buildFineliFoods(
      {
        food: [
          { FOODID: "1", FOODNAME: "KANANMUNA, KEITETTY", FOODTYPE: "FOOD" },
          { FOODID: "2", FOODNAME: "VESI", FOODTYPE: "DISH" },
          { FOODID: "3", FOODNAME: "KEITTO", FOODTYPE: "DISH" },
        ],
        nameFi: [{ FOODID: "1", FOODNAME: "KANANMUNA, KEITETTY" }, { FOODID: "3", FOODNAME: "KEITTO" }],
        nameEn: [{ FOODID: "1", FOODNAME: "EGG, BOILED" }],
        componentValue: [
          { FOODID: "1", EUFDNAME: "ENERC", BESTLOC: "650,5" },
          { FOODID: "1", EUFDNAME: "PROT", BESTLOC: "12,5" },
          { FOODID: "1", EUFDNAME: "FAT", BESTLOC: "10,3" },
          { FOODID: "1", EUFDNAME: "CHOAVL", BESTLOC: "-1" }, // negative → skipped
          { FOODID: "1", EUFDNAME: "F20D5N3", BESTLOC: "150" }, // mg → 0.15 g
          { FOODID: "1", EUFDNAME: "VITC", BESTLOC: "5" }, // unit mismatch → skipped
          { FOODID: "1", EUFDNAME: "UNKNOWN", BESTLOC: "9" },
          { FOODID: "2", EUFDNAME: "PROT", BESTLOC: "0" }, // no ENERC → food skipped
          { FOODID: "3", EUFDNAME: "ENERC", BESTLOC: "100" },
        ],
        component: [
          { EUFDNAME: "ENERC", COMPUNIT: "kJ" },
          { EUFDNAME: "PROT", COMPUNIT: "g" },
          { EUFDNAME: "VITC", COMPUNIT: "µg" },
        ],
        addUnit: [
          { FOODID: "1", FOODUNIT: "G", MASS: "1" },
          { FOODID: "1", FOODUNIT: "KPL_M", MASS: "58" },
          { FOODID: "1", FOODUNIT: "PORT1000KJ", MASS: "160" },
          { FOODID: "1", FOODUNIT: "DL", MASS: "0" },
          { FOODID: "1", FOODUNIT: "XX", MASS: "12,5" },
        ],
        unitFi: [{ THSCODE: "KPL_M", DESCRIPT: "kpl, keskikokoinen" }],
        unitEn: [{ THSCODE: "KPL_M", DESCRIPT: "piece, medium" }, { THSCODE: "XX", DESCRIPT: "unit x" }],
      },
      defs,
      "Fineli_Rel20",
    );
    expect(skippedNoKcal).toBe(1);
    expect(unitMismatches).toHaveLength(1);
    expect(unitMismatches[0]).toContain("vit_c_mg");
    expect(foods).toHaveLength(2);
    const egg = foods[0];
    expect(egg).toMatchObject({
      source: "fineli", source_id: "1", name: "Kananmuna, keitetty", name_fi: "Kananmuna, keitetty", name_en: "Egg, boiled",
      country: "FI", category: "food", food_type: "food", data_quality: 1, source_version: "Fineli_Rel20", barcodes: [],
    });
    expect(egg.nutrients).toEqual({ kcal: 155.4732, protein_g: 12.5, fat_g: 10.3, epa_g: 0.15 });
    expect(egg.servings).toEqual([
      { label: "kpl, keskikokoinen (58 g)", grams: 58, source_unit: "KPL_M", is_default: true },
      { label: "unit x (12.5 g)", grams: 12.5, source_unit: "XX", is_default: false },
    ]);
    expect(foods[1]).toMatchObject({ source_id: "3", name: "Keitto", name_en: null, food_type: "dish", category: "dish", servings: [] });
  });
});

describe("USDA mapping", () => {
  const nutrientRows = [
    { id: "1008", unit_name: "KCAL" }, { id: "2048", unit_name: "KCAL" }, { id: "2047", unit_name: "KCAL" },
    { id: "1003", unit_name: "G" }, { id: "1005", unit_name: "G" }, { id: "1050", unit_name: "G" }, { id: "1079", unit_name: "G" },
    { id: "1162", unit_name: "G" }, // wrong unit (we expect mg) → skipped
    { id: "1093", unit_name: "MG" }, // sodium mg → salt g via factor: allowed
  ];

  it("checks units, applies factors, kcal fallback chain and the carbs rule", () => {
    const { usable, mismatches } = checkUsdaUnits(nutrientRows, defs);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toContain("vit_c_mg");
    expect(usable.map((d) => d.key)).not.toContain("vit_c_mg");

    const m = (o: Record<number, number>) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));
    expect(mapUsdaNutrients(m({ 2047: 150, 2048: 143, 1003: 12.6, 1005: 10, 1079: 4, 1093: 140 }), usable))
      .toEqual({ kcal: 143, protein_g: 12.6, carbs_g: 6, fiber_g: 4, salt_g: 0.35 });
    expect(mapUsdaNutrients(m({ 1008: 100, 2048: 143 }), usable).kcal).toBe(100);
    expect(mapUsdaNutrients(m({ 2047: 150 }), usable).kcal).toBe(150);
    expect(mapUsdaNutrients(m({ 1008: 50, 1005: 2, 1079: 5 }), usable).carbs_g).toBe(0); // clamped
    expect(mapUsdaNutrients(m({ 1008: 50, 1050: 12, 1079: 5 }), usable).carbs_g).toBe(7); // Foundation: 1050 by summation, fibre removed
    expect(mapUsdaNutrients(m({ 1008: 50, 1079: 5 }), usable)).toEqual({ kcal: 50, fiber_g: 5 }); // neither 1005 nor 1050 → no carbs_g
    expect(mapUsdaNutrients(m({ 1003: 1 }), usable).kcal).toBeUndefined();
  });

  it("labels servings and skips undetermined units without a description", () => {
    expect(usdaServingLabel("1.0", "cup", "chopped")).toBe("1 cup chopped");
    expect(usdaServingLabel("0.5", "tbsp", "")).toBe("0.5 tbsp");
    expect(usdaServingLabel("1", "undetermined", "", "1 large egg")).toBe("1 large egg");
    expect(usdaServingLabel("1", "undetermined", "10205", "")).toBeNull();
    expect(usdaVersion("/x/FoodData_Central_sr_legacy_food_csv_2018-04.zip")).toBe("FDC 2018-04");
    expect(usdaVersion("foods.zip")).toBe("FDC");
  });

  it("builds payloads per dataset with first-wins nutrient dedupe", () => {
    const { foods, skippedNoKcal, unitMismatches } = buildUsdaFoods(
      {
        food: [
          { fdc_id: "10", data_type: "foundation_food", description: "Egg, whole, raw", food_category_id: "1" },
          { fdc_id: "11", data_type: "sr_legacy_food", description: "Legacy egg", food_category_id: "1" },
          { fdc_id: "12", data_type: "foundation_food", description: "No energy", food_category_id: "" },
        ],
        foodNutrient: [
          { fdc_id: "10", nutrient_id: "2048", amount: "143" },
          { fdc_id: "10", nutrient_id: "1003", amount: "12.6" },
          { fdc_id: "10", nutrient_id: "1003", amount: "99" }, // duplicate → ignored
          { fdc_id: "10", nutrient_id: "1005", amount: "10" },
          { fdc_id: "10", nutrient_id: "1079", amount: "4" },
          { fdc_id: "10", nutrient_id: "1162", amount: "5" },
          { fdc_id: "11", nutrient_id: "1008", amount: "140" },
          { fdc_id: "12", nutrient_id: "1003", amount: "1" },
        ],
        nutrient: nutrientRows,
        foodPortion: [
          { fdc_id: "10", amount: "0.5", measure_unit_id: "1000", portion_description: "", modifier: "chopped", gram_weight: "121.5" },
          { fdc_id: "10", amount: "1", measure_unit_id: "9999", portion_description: "1 large", modifier: "", gram_weight: "50" },
          { fdc_id: "10", amount: "1", measure_unit_id: "9999", portion_description: "", modifier: "", gram_weight: "10" },
          { fdc_id: "10", amount: "1", measure_unit_id: "1000", portion_description: "", modifier: "", gram_weight: "0" },
        ],
        measureUnit: [{ id: "1000", name: "cup" }, { id: "9999", name: "undetermined" }],
        foodCategory: [{ id: "1", description: "Dairy and Egg Products" }],
      },
      defs,
      "foundation",
      "FDC 2025-04",
    );
    expect(unitMismatches).toHaveLength(1);
    expect(skippedNoKcal).toBe(1);
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({
      source: "usda_foundation", source_id: "10", name: "Egg, whole, raw", name_en: "Egg, whole, raw", name_fi: null,
      country: null, category: "Dairy and Egg Products", food_type: "food", data_quality: 1, source_version: "FDC 2025-04",
      nutrients: { kcal: 143, protein_g: 12.6, carbs_g: 6, fiber_g: 4 },
    });
    expect(foods[0].nutrients.vit_c_mg).toBeUndefined();
    expect(foods[0].servings).toEqual([
      { label: "0.5 cup chopped", grams: 121.5, source_unit: "cup", is_default: true },
      { label: "1 large", grams: 50, source_unit: "undetermined", is_default: false },
    ]);
  });
});
