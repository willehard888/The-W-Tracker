// Open Food Facts bulk import (scripts/nutrition/off.mts): the streaming scan over a 9-line
// dump fixture — country filter, --since, skip reasons, bad JSON, barcode dedupe — plus the
// concurrent batch grouping of lib.mts ingestBatch. Lives under src/ because vitest's include is src/**.
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildNutrientMaps } from "../../../supabase/functions/nutrition-lookup/map";
import { ingestBatch, seedNutrientDefinitions, type FoodPayload } from "../../../scripts/nutrition/lib.mts";
import { countryTags, mapLine, plausible, scanOff } from "../../../scripts/nutrition/off.mts";

const FIXTURE = resolve(__dirname, "../nutrition/__fixtures__/off-sample.jsonl");
// The same definitions the script uses without a service key: the migration seed.
const maps = buildNutrientMaps(seedNutrientDefinitions());

describe("countryTags", () => {
  it("defaults to every Nordic tag, maps codes case-insensitively, rejects unknown codes", () => {
    expect([...countryTags()]).toEqual(["en:finland", "en:sweden", "en:norway", "en:denmark", "en:estonia"]);
    expect([...countryTags(["se", "FI"])]).toEqual(["en:sweden", "en:finland"]);
    expect(() => countryTags(["fi", "xx"])).toThrow(/unknown "xx"/);
  });
});

describe("plausible", () => {
  it("accepts the 900 kcal / 100 g boundary and rejects anything above it", () => {
    expect(plausible({ kcal: 900, protein_g: 100, fat_g: 100, carbs_g: 100 })).toBe(true);
    expect(plausible({ kcal: 900.1 })).toBe(false);
    expect(plausible({ kcal: 10, fat_g: 100.5 })).toBe(false);
  });
});

describe("mapLine", () => {
  it("ignores lines outside the country set before parsing and throws on bad JSON", () => {
    expect(mapLine('{"code":"1","countries_tags":["en:germany"]}', countryTags(), maps)).toBeNull();
    expect(mapLine('{"code":"1"}', countryTags(), maps)).toBeNull();
    expect(() => mapLine('{"countries_tags":["en:finland"],', countryTags(), maps)).toThrow();
  });
});

describe("scanOff", () => {
  it("keeps one food per barcode from the Nordic products and counts every skip", async () => {
    const r = await scanOff(FIXTURE, countryTags(), maps);
    expect(r.lines).toBe(9);
    expect(r.matched).toBe(7);
    expect(r.badJson).toBe(1);
    expect(r.skipped).toEqual({ no_kcal: 1, no_barcode: 1, implausible: 1 });
    expect(r.maxModified).toBe(1726000000);
    expect(r.foods.map((f) => [f.source_id, f.country])).toEqual([
      ["6410405093677", "FI"],
      ["7310865004703", "SE"],
      ["7038010000034", "NO"],
    ]);

    const bread = r.foods[0];
    expect(bread).toMatchObject({ source: "off", name: "Ruisleipä v2", source_version: "1726000000", data_quality: 2 });
    expect(bread.nutrients.kcal).toBe(221);

    const milk = r.foods[1];
    expect(milk.servings).toEqual([{ label: "250 ml", grams: 250, source_unit: "ml", is_default: true }]);

    expect(r.foods[2].nutrients.kcal).toBe(500); // energy_100g 2092 kJ
  });

  it("--since drops products modified at or before the cutoff", async () => {
    const r = await scanOff(FIXTURE, countryTags(), maps, { since: 1725000000 });
    expect(r.skipped).toEqual({ too_old: 6 });
    expect(r.foods.map((f) => f.name)).toEqual(["Ruisleipä v2"]);
  });

  it("--countries narrows the set", async () => {
    const r = await scanOff(FIXTURE, countryTags(["no"]), maps);
    expect(r.matched).toBe(1);
    expect(r.foods.map((f) => f.source_id)).toEqual(["7038010000034"]);
  });
});

describe("ingestBatch concurrency", () => {
  it("advances the resume cursor only after a whole group of batches", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const food = (i: number): FoodPayload => ({
      source: "off", source_id: `c${i}`, name: `f${i}`, name_fi: null, name_en: null, brand: null, country: null,
      category: null, food_type: "branded", data_quality: 3, image_url: null, source_version: "", barcodes: [],
      servings: [], nutrients: { kcal: 1 },
    });
    const seen: string[] = [];
    const client = createClient("http://localhost", "dry-run");
    const r = await ingestBatch(client, [1, 2, 3, 4, 5].map(food), 2, { dryRun: true, concurrency: 2, onBatch: (id) => seen.push(id) });
    expect(r.batches).toBe(3);
    expect(seen).toEqual(["c4", "c5"]);
    vi.restoreAllMocks();
  });
});
