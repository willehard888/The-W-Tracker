// Pure mapper of the nutrition-lookup edge function (Deno). It lives outside
// src/ but has no Deno imports precisely so this vitest file can pin the
// OFF/USDA → ingest_foods rules: unit factors, energy/salt fallbacks, the
// USDA fibre rule, GTIN normalisation and the never-guess skips.
import { describe, it, expect } from "vitest";
import {
  buildNutrientMaps,
  mapOffProduct,
  mapUsdaFood,
  normalizeBarcode,
  type NutrientDef,
  type OffProduct,
  type UsdaFood,
} from "../../../supabase/functions/nutrition-lookup/map";

const def = (
  id: number,
  key: string,
  unit: string,
  off: [string, number] | null,
  usda: [number, number] | null,
): NutrientDef => ({
  id,
  key,
  unit,
  off_key: off?.[0] ?? null,
  off_factor: off?.[1] ?? null,
  usda_nutrient_id: usda?.[0] ?? null,
  usda_factor: usda?.[1] ?? null,
});

// Mirrors the nutrient_definitions seed: OFF `_100g` is grams for every mass
// nutrient (mg = ×1000, µg = ×1e6); USDA units already match canonical.
const defs: NutrientDef[] = [
  def(1, "kcal", "kcal", ["energy-kcal", 1], [1008, 1]),
  def(2, "protein_g", "g", ["proteins", 1], [1003, 1]),
  def(3, "fat_g", "g", ["fat", 1], [1004, 1]),
  def(4, "carbs_g", "g", ["carbohydrates", 1], [1005, 1]),
  def(5, "fiber_g", "g", ["fiber", 1], [1079, 1]),
  def(6, "sugar_g", "g", ["sugars", 1], [2000, 1]),
  def(7, "sat_fat_g", "g", ["saturated-fat", 1], [1258, 1]),
  def(8, "salt_g", "g", ["salt", 1], null),
  def(9, "sodium_mg", "mg", ["sodium", 1000], [1093, 1]),
  def(10, "calcium_mg", "mg", ["calcium", 1000], [1087, 1]),
  def(11, "vit_b12_ug", "ug", ["vitamin-b12", 1e6], [1178, 1]),
  def(12, "vit_d_ug", "ug", ["vitamin-d", 1e6], [1114, 1]),
];
const maps = buildNutrientMaps(defs);

const fullOff = (): OffProduct => ({
  code: "6410405093677",
  product_name: "Ruisleipä",
  product_name_fi: "Ruisleipä",
  product_name_en: "Rye bread",
  brands: "Fazer, Oululainen",
  countries_tags: ["en:finland", "en:sweden"],
  serving_size: "1 slice (30 g)",
  serving_quantity: "30",
  nutrition_data_per: "100g",
  nutriments: {
    "energy-kcal_100g": 220,
    "energy-kj_100g": 920,
    proteins_100g: 8.5,
    fat_100g: 1.5,
    carbohydrates_100g: 40,
    sugars_100g: 2,
    "saturated-fat_100g": 0.3,
    salt_100g: 1.1,
    fiber_100g: 10,
    calcium_100g: 0.12,
    "vitamin-b12_100g": 0.0000025,
  },
  image_front_small_url: "https://images.openfoodfacts.org/x.jpg",
  last_modified_t: 1725000000,
});

describe("normalizeBarcode (mirrors public.normalize_barcode)", () => {
  it("accepts EAN-13 / EAN-8, pads UPC-A, drops the GTIN-14 leading zero, strips junk", () => {
    expect(normalizeBarcode("4006381333931")).toBe("4006381333931");
    expect(normalizeBarcode("73513537")).toBe("73513537");
    expect(normalizeBarcode("036000291452")).toBe("0036000291452");
    expect(normalizeBarcode("00036000291452")).toBe("0036000291452");
    expect(normalizeBarcode(" 4006-3813-33931 ")).toBe("4006381333931");
  });
  it("rejects a bad check digit, odd lengths and empties", () => {
    expect(normalizeBarcode("4006381333932")).toBeNull();
    expect(normalizeBarcode("12345")).toBeNull();
    expect(normalizeBarcode("1234567890123456")).toBeNull();
    expect(normalizeBarcode("")).toBeNull();
    expect(normalizeBarcode(undefined)).toBeNull();
  });
});

describe("mapOffProduct", () => {
  it("applies OFF grams → mg/µg factors and keeps absent nutrients absent", () => {
    const food = mapOffProduct(fullOff(), maps);
    expect(food).not.toBeNull();
    expect(food!.nutrients).toMatchObject({
      kcal: 220,
      protein_g: 8.5,
      calcium_mg: 120,
      vit_b12_ug: 2.5,
      salt_g: 1.1,
      sodium_mg: 440,
    });
    expect(food!.nutrients).not.toHaveProperty("vit_d_ug");
  });

  it("derives kcal from kJ when only energy-kj is present", () => {
    const p = fullOff();
    p.nutriments = { "energy-kj_100g": 2092, proteins_100g: 1 };
    expect(mapOffProduct(p, maps)!.nutrients.kcal).toBe(500);
  });

  it("fills sodium from salt (÷2.5) and salt from sodium (×2.5) when only one exists", () => {
    const fromSalt = fullOff();
    fromSalt.nutriments = { "energy-kcal_100g": 10, salt_100g: 1.25 };
    expect(mapOffProduct(fromSalt, maps)!.nutrients).toMatchObject({ salt_g: 1.25, sodium_mg: 500 });

    const fromSodium = fullOff();
    fromSodium.nutriments = { "energy-kcal_100g": 10, sodium_100g: 0.4 };
    expect(mapOffProduct(fromSodium, maps)!.nutrients).toMatchObject({ salt_g: 1, sodium_mg: 400 });
  });

  it("skips negative / non-numeric values without inventing a replacement", () => {
    const p = fullOff();
    p.nutriments = { "energy-kcal_100g": "150", proteins_100g: -1, fat_100g: "n/a", carbohydrates_100g: null };
    const n = mapOffProduct(p, maps)!.nutrients;
    expect(n).toEqual({ kcal: 150 });
  });

  it("treats per-serving-only products (no _100g keys) and energy-less products as unusable", () => {
    const perServing = fullOff();
    perServing.nutrition_data_per = "serving";
    perServing.nutriments = { "energy-kcal_serving": 300, proteins_serving: 12 };
    expect(mapOffProduct(perServing, maps)).toBeNull();

    const noEnergy = fullOff();
    noEnergy.nutriments = { proteins_100g: 12 };
    expect(mapOffProduct(noEnergy, maps)).toBeNull();

    // OFF derived _100g values from the serving size → usable even when declared per serving.
    const derived = fullOff();
    derived.nutrition_data_per = "serving";
    expect(mapOffProduct(derived, maps)).not.toBeNull();
  });

  it("derives name/brand/country/quality/servings/barcodes from the record", () => {
    const food = mapOffProduct(fullOff(), maps)!;
    expect(food).toMatchObject({
      source: "off",
      source_id: "6410405093677",
      name: "Ruisleipä",
      name_fi: "Ruisleipä",
      name_en: "Rye bread",
      brand: "Fazer",
      country: "FI",
      food_type: "branded",
      data_quality: 2,
      source_version: "1725000000",
      image_url: "https://images.openfoodfacts.org/x.jpg",
      barcodes: ["6410405093677"],
    });
    expect(food.servings).toEqual([
      { label: "1 slice (30 g)", grams: 30, source_unit: "serving", is_default: true },
    ]);
  });

  it("falls back name_fi → product_name → name_en, quality 3 when a label macro is missing, no serving when unknown", () => {
    const p = fullOff();
    p.product_name_fi = undefined;
    p.product_name = "  Bread  ";
    p.brands = undefined;
    p.countries_tags = ["en:sweden"];
    p.serving_quantity = undefined;
    p.serving_size = undefined;
    delete p.nutriments!.salt_100g;
    const food = mapOffProduct(p, maps)!;
    expect(food).toMatchObject({ name: "Bread", name_fi: null, name_en: "Rye bread", brand: null, country: null, data_quality: 3 });
    expect(food.servings).toEqual([]);

    // Only a main-language name: it still lands in name_en so search_text covers it.
    const onlyMain = fullOff();
    onlyMain.product_name_fi = undefined;
    onlyMain.product_name_en = undefined;
    onlyMain.product_name = "x".repeat(250);
    const f2 = mapOffProduct(onlyMain, maps)!;
    expect(f2.name).toHaveLength(200);
    expect(f2.name_en).toBe(f2.name);
  });

  it("returns null without a usable code or name; uses the requested code when the record has none", () => {
    const p = fullOff();
    p.code = undefined;
    expect(mapOffProduct(p, maps)).toBeNull();
    expect(mapOffProduct(p, maps, "4006381333931")).toMatchObject({ source_id: "4006381333931", barcodes: ["4006381333931"] });
    const nameless = fullOff();
    nameless.product_name = nameless.product_name_fi = nameless.product_name_en = "  ";
    expect(mapOffProduct(nameless, maps)).toBeNull();
  });
});

describe("mapUsdaFood", () => {
  const usda = (): UsdaFood => ({
    fdcId: 2345678,
    description: "PEANUT BUTTER",
    brandOwner: "Acme Foods Inc.",
    brandName: "Acme",
    gtinUpc: "036000291452",
    servingSize: 32,
    servingSizeUnit: "g",
    householdServingFullText: "2 tbsp",
    marketCountry: "United States",
    modifiedDate: "2024-03-01",
    foodNutrients: [
      { nutrientId: 1008, unitName: "kcal", value: 588 },
      { nutrientId: 1003, unitName: "G", value: 25 },
      { nutrientId: 1004, unitName: "G", value: 50 },
      { nutrientId: 1005, unitName: "G", value: 20 },
      { nutrientId: 1079, unitName: "G", value: 6 },
      { nutrientId: 1093, unitName: "MG", value: 430 },
      { nutrientId: 1178, unitName: "µg", value: 0.5 },
      { nutrientId: 9999, unitName: "G", value: 1 },
    ],
  });

  it("maps by nutrientId with upper-cased units, applies carbs = max(0, 1005 − 1079)", () => {
    const food = mapUsdaFood(usda(), maps)!;
    expect(food.nutrients).toEqual({
      kcal: 588,
      protein_g: 25,
      fat_g: 50,
      carbs_g: 14,
      fiber_g: 6,
      sodium_mg: 430,
      vit_b12_ug: 0.5,
    });
    const inverted = usda();
    inverted.foodNutrients = [
      { nutrientId: 1008, unitName: "KCAL", value: 10 },
      { nutrientId: 1005, unitName: "G", value: 2 },
      { nutrientId: 1079, unitName: "G", value: 5 },
    ];
    expect(mapUsdaFood(inverted, maps)!.nutrients.carbs_g).toBe(0);
  });

  it("drops a nutrient whose unit contradicts the canonical unit instead of converting by guess", () => {
    const kj = usda();
    kj.foodNutrients = [
      { nutrientId: 1008, unitName: "kJ", value: 2460 },
      { nutrientId: 1114, unitName: "IU", value: 400 },
    ];
    expect(mapUsdaFood(kj, maps)).toBeNull(); // no kcal ⇒ unusable
  });

  it("derives brand, country, serving (G/ML only), barcode and identity", () => {
    const food = mapUsdaFood(usda(), maps)!;
    expect(food).toMatchObject({
      source: "usda_branded",
      source_id: "2345678",
      name: "PEANUT BUTTER",
      name_fi: null,
      name_en: "PEANUT BUTTER",
      brand: "Acme Foods Inc.",
      country: "US",
      data_quality: 2,
      source_version: "2024-03-01",
      barcodes: ["0036000291452"],
    });
    expect(food.servings).toEqual([{ label: "2 tbsp", grams: 32, source_unit: "serving", is_default: true }]);

    const oz = usda();
    oz.servingSizeUnit = "oz";
    oz.brandOwner = undefined;
    oz.marketCountry = "New Zealand";
    oz.gtinUpc = "12";
    oz.householdServingFullText = undefined;
    expect(mapUsdaFood(oz, maps)).toMatchObject({ brand: "Acme", country: null, servings: [], barcodes: [] });

    const ml = usda();
    ml.servingSizeUnit = "ML";
    ml.servingSize = 240;
    ml.householdServingFullText = undefined;
    expect(mapUsdaFood(ml, maps)!.servings).toEqual([
      { label: "1 serving (240 ml)", grams: 240, source_unit: "serving", is_default: true },
    ]);
  });

  it("matches a search hit to the scanned code via gtin normalisation", () => {
    const code = normalizeBarcode("0036000291452");
    expect(normalizeBarcode(usda().gtinUpc)).toBe(code);
    expect(normalizeBarcode("00036000291452")).toBe(code);
    expect(normalizeBarcode("036000291453")).not.toBe(code);
  });

  it("returns null without fdcId, description or energy", () => {
    const noId = usda();
    noId.fdcId = undefined;
    expect(mapUsdaFood(noId, maps)).toBeNull();
    const noName = usda();
    noName.description = " ";
    expect(mapUsdaFood(noName, maps)).toBeNull();
    const noEnergy = usda();
    noEnergy.foodNutrients = [{ nutrientId: 1003, unitName: "G", value: 1 }];
    expect(mapUsdaFood(noEnergy, maps)).toBeNull();
  });
});
