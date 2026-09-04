// USDA FoodData Central (public domain) → ingest_foods.
//   npx vite-node scripts/nutrition/usda.mts -- --dataset foundation --zip ~/Downloads/FoodData_Central_foundation_food_csv_2025-04-24.zip
//   npx vite-node scripts/nutrition/usda.mts -- --dataset sr_legacy  --zip ~/Downloads/FoodData_Central_sr_legacy_food_csv_2018-04.zip
// Flags: --dry-run --limit N --from <fdc_id>. Zips: https://fdc.nal.usda.gov/download-datasets/
// Pure mapping helpers are exported for tests; main() only runs when this is the script entry.
import { basename } from "node:path";
import { parseNumber, readCsvRecords, type Rec } from "./csv.mts";
import {
  createServiceClient, die, elapsed, isMain, loadNutrientDefinitions, parseFlags, requireFile, round4,
  runIngest, unzipToScratch, type FoodPayload, type FoodServingPayload, type NutrientDef,
} from "./lib.mts";

export const USDA_DOWNLOADS = "https://fdc.nal.usda.gov/download-datasets/";
export const USDA_DATASETS = {
  foundation: { source: "usda_foundation", dataType: "foundation_food" },
  sr_legacy: { source: "usda_sr_legacy", dataType: "sr_legacy_food" },
} as const;
export type UsdaDataset = keyof typeof USDA_DATASETS;
/** Energy: 1008 kcal, else Atwater specific (2048), else Atwater general (2047). */
export const KCAL_FALLBACK = [1008, 2048, 2047];
const CARB_BY_DIFFERENCE = 1005; // includes fibre
const CARB_BY_SUMMATION = 1050; // Foundation foods often carry only this one; also includes fibre
const FIBER = 1079;

export interface UsdaTables {
  food: Rec[];         // fdc_id, data_type, description, food_category_id
  foodNutrient: Rec[]; // fdc_id, nutrient_id, amount
  nutrient: Rec[];     // id, unit_name
  foodPortion: Rec[];  // fdc_id, amount, measure_unit_id, portion_description, modifier, gram_weight
  measureUnit: Rec[];  // id, name
  foodCategory: Rec[]; // id, description
}

/** "FoodData_Central_sr_legacy_food_csv_2018-04.zip" → "FDC 2018-04"; else "FDC". */
export function usdaVersion(zipPath: string): string {
  const m = basename(zipPath).match(/(\d{4}-\d{2})/);
  return m ? `FDC ${m[1]}` : "FDC";
}

/** Definitions whose USDA unit agrees with ours (a factor ≠ 1 is a deliberate conversion, e.g. sodium mg → salt g). */
export function checkUsdaUnits(nutrientRows: Rec[], defs: NutrientDef[]): { usable: NutrientDef[]; mismatches: string[] } {
  const units = new Map(nutrientRows.map((r) => [Number(r.id), r.unit_name.trim().toUpperCase()]));
  const usable: NutrientDef[] = [];
  const mismatches: string[] = [];
  for (const d of defs) {
    if (d.usda_nutrient_id === null) continue;
    const u = units.get(d.usda_nutrient_id);
    if (u !== undefined && (d.usda_factor ?? 1) === 1 && u !== d.unit.toUpperCase()) {
      mismatches.push(`${d.key} (${d.usda_nutrient_id}): USDA ${u} vs ${d.unit} — values skipped`);
      continue;
    }
    usable.push(d);
  }
  return { usable, mismatches };
}

/** amounts = nutrient_id → amount per 100 g. Applies usda_factor, the kcal fallback chain and the carbs rule. */
export function mapUsdaNutrients(amounts: Map<number, number>, defs: NutrientDef[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of defs) {
    if (d.usda_nutrient_id === null) continue;
    const v = amounts.get(d.usda_nutrient_id);
    if (v !== undefined && Number.isFinite(v) && v >= 0) out[d.key] = round4(v * (d.usda_factor ?? 1));
  }
  const kcalDef = defs.find((d) => d.key === "kcal");
  if (kcalDef && out.kcal === undefined) {
    const id = KCAL_FALLBACK.find((n) => amounts.has(n));
    const v = id === undefined ? undefined : amounts.get(id);
    if (v !== undefined && v >= 0) out.kcal = round4(v * (kcalDef.usda_factor ?? 1));
  }
  // USDA 1005 (by difference) and 1050 (by summation) both include fibre; we store available carbs.
  const total = amounts.get(CARB_BY_DIFFERENCE) ?? amounts.get(CARB_BY_SUMMATION);
  if (total !== undefined) out.carbs_g = round4(Math.max(0, total - (amounts.get(FIBER) ?? 0)));
  else delete out.carbs_g;
  return out;
}

/** "1 cup chopped"; an "undetermined" unit falls back to portion_description, or null (skip). */
export function usdaServingLabel(amount: string, unitName: string, modifier: string, description = ""): string | null {
  if (unitName.trim().toLowerCase() === "undetermined") return description.trim() || null;
  const qty = parseNumber(amount);
  const head = Number.isFinite(qty) && qty > 0 ? `${qty} ${unitName.trim()}` : unitName.trim();
  return modifier.trim() ? `${head} ${modifier.trim()}` : head;
}

export interface UsdaBuild {
  foods: FoodPayload[];
  skippedNoKcal: number;
  unitMismatches: string[];
}

export function buildUsdaFoods(t: UsdaTables, defs: NutrientDef[], dataset: UsdaDataset, sourceVersion: string): UsdaBuild {
  const { source, dataType } = USDA_DATASETS[dataset];
  const { usable, mismatches } = checkUsdaUnits(t.nutrient, defs);

  const amounts = new Map<string, Map<number, number>>(); // fdc_id → nutrient_id → amount (first wins)
  for (const r of t.foodNutrient) {
    const m = amounts.get(r.fdc_id) ?? new Map<number, number>();
    const nid = Number(r.nutrient_id);
    if (!m.has(nid)) m.set(nid, parseNumber(r.amount));
    amounts.set(r.fdc_id, m);
  }

  const unitName = new Map(t.measureUnit.map((r) => [r.id, r.name]));
  const servings = new Map<string, FoodServingPayload[]>();
  for (const r of t.foodPortion) {
    const grams = parseNumber(r.gram_weight);
    if (!(grams > 0) || grams > 5000) continue;
    const label = usdaServingLabel(r.amount, unitName.get(r.measure_unit_id) ?? "", r.modifier, r.portion_description);
    if (!label) continue;
    const list = servings.get(r.fdc_id) ?? [];
    if (list.some((s) => s.label === label)) continue;
    list.push({ label, grams: round4(grams), source_unit: unitName.get(r.measure_unit_id) ?? null, is_default: list.length === 0 });
    servings.set(r.fdc_id, list);
  }

  const category = new Map(t.foodCategory.map((r) => [r.id, r.description.trim()]));
  const foods: FoodPayload[] = [];
  let skippedNoKcal = 0;
  for (const r of t.food) {
    if (r.data_type !== dataType) continue;
    const nutrients = mapUsdaNutrients(amounts.get(r.fdc_id) ?? new Map(), usable);
    if (nutrients.kcal === undefined) { skippedNoKcal++; continue; }
    const name = r.description.trim();
    foods.push({
      source,
      source_id: String(r.fdc_id),
      name,
      name_fi: null,
      name_en: name,
      brand: null,
      country: null,
      category: category.get(r.food_category_id) || null,
      food_type: "food",
      data_quality: 1,
      image_url: null,
      source_version: sourceVersion,
      barcodes: [],
      servings: servings.get(r.fdc_id) ?? [],
      nutrients,
    });
  }
  return { foods, skippedNoKcal, unitMismatches: mismatches };
}

const isDataset = (s: string | undefined): s is UsdaDataset => s !== undefined && s in USDA_DATASETS;

async function main(): Promise<void> {
  const t0 = Date.now();
  const flags = parseFlags(process.argv.slice(2));
  if (!isDataset(flags.dataset)) die(`--dataset must be foundation | sr_legacy`);
  if (!flags.zip) die(`--zip <path> is required — download the CSV zip for "${flags.dataset}" from ${USDA_DOWNLOADS}`);
  const dataset = flags.dataset;
  const dir = unzipToScratch(flags.zip);
  const csv = (name: string, columns: string[]): Rec[] => readCsvRecords(requireFile(dir, name), { columns });
  const tables: UsdaTables = {
    food: csv("food.csv", ["fdc_id", "data_type", "description", "food_category_id"]),
    foodNutrient: csv("food_nutrient.csv", ["fdc_id", "nutrient_id", "amount"]),
    nutrient: csv("nutrient.csv", ["id", "unit_name"]),
    foodPortion: csv("food_portion.csv", ["fdc_id", "amount", "measure_unit_id", "portion_description", "modifier", "gram_weight"]),
    measureUnit: csv("measure_unit.csv", ["id", "name"]),
    foodCategory: csv("food_category.csv", ["id", "description"]),
  };
  const version = usdaVersion(flags.zip);
  console.log(`parsed ${tables.food.length} foods, ${tables.foodNutrient.length} nutrient rows (${version}) in ${elapsed(t0)}`);

  const client = createServiceClient();
  const defs = await loadNutrientDefinitions(client);
  const { foods, skippedNoKcal, unitMismatches } = buildUsdaFoods(tables, defs, dataset, version);
  for (const m of unitMismatches) console.warn(`  unit mismatch: ${m}`);
  const r = await runIngest(client, USDA_DATASETS[dataset].source, foods, flags);
  console.log(
    `\n${USDA_DATASETS[dataset].source}: ${foods.length} foods parsed · ${skippedNoKcal} skipped without kcal · ${r.batches} batches (${r.processed} foods` +
      `${Object.entries(r.actions).map(([k, v]) => ` · ${v} ${k}`).join("")}) · ${elapsed(t0)}`,
  );
}

if (isMain(import.meta.url)) main().catch((e: unknown) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
