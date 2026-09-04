// Catalog quality report: per-source counts, nutrient coverage, macro-consistency outliers,
// foods without servings, barcodes.   npx vite-node scripts/nutrition/report.mts
import { createServiceClient, die, elapsed, isMain, loadNutrientDefinitions } from "./lib.mts";

const PAGE = 1000; // PostgREST caps un-ranged selects at 1000 rows — see supabase/functions/sync-streaks/index.ts
const MACROS = ["kcal", "protein_g", "carbs_g", "fat_g"];
const MAX_OUTLIERS = 20;

interface Page { data: unknown[] | null; error: { message: string } | null }
async function fetchAll<T>(label: string, build: (from: number, to: number) => PromiseLike<Page>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  console.log(`  ${label}: ${all.length} rows`);
  return all;
}

interface FoodRow { id: string; source: string; name: string; data_quality: number }
interface NutrientRow { food_id: string; nutrient_id: number; amount_per_100g: number }

const pct = (n: number, d: number): string => (d ? `${((100 * n) / d).toFixed(1).padStart(5)} %` : "    — ");

async function main(): Promise<void> {
  const t0 = Date.now();
  const client = createServiceClient();
  const defs = await loadNutrientDefinitions(client);
  const keyById = new Map(defs.map((d) => [d.id, d.key]));
  console.log("loading (1000-row pages) …");
  // Every query orders by its primary key so .range() pages are stable.
  const foods = await fetchAll<FoodRow>("foods", (a, b) =>
    client.from("foods").select("id, source, name, data_quality").order("id").range(a, b));
  const nutrientRows = await fetchAll<NutrientRow>("food_nutrients", (a, b) =>
    client.from("food_nutrients").select("food_id, nutrient_id, amount_per_100g").order("food_id").order("nutrient_id").range(a, b));
  const servingRows = await fetchAll<{ food_id: string }>("food_servings", (a, b) =>
    client.from("food_servings").select("id, food_id").order("id").range(a, b));
  const barcodeRows = await fetchAll<{ source: string }>("food_barcodes", (a, b) =>
    client.from("food_barcodes").select("barcode, source").order("barcode").range(a, b));

  const nutrients = new Map<string, Record<string, number>>();
  for (const r of nutrientRows) {
    const key = keyById.get(r.nutrient_id);
    if (!key) continue;
    const bag = nutrients.get(r.food_id) ?? {};
    bag[key] = Number(r.amount_per_100g);
    nutrients.set(r.food_id, bag);
  }
  const withServing = new Set(servingRows.map((r) => r.food_id));
  const barcodes = new Map<string, number>();
  for (const r of barcodeRows) barcodes.set(r.source, (barcodes.get(r.source) ?? 0) + 1);

  const sources = [...new Set(foods.map((f) => f.source))].sort();
  const bySource = new Map(sources.map((s) => [s, foods.filter((f) => f.source === s)]));

  console.log(`\n${"nutrient".padEnd(18)}${sources.map((s) => s.padStart(18)).join("")}`);
  console.log(`${"foods".padEnd(18)}${sources.map((s) => String(bySource.get(s)?.length ?? 0).padStart(18)).join("")}`);
  for (const d of defs) {
    const cells = sources.map((s) => {
      const list = bySource.get(s) ?? [];
      return pct(list.filter((f) => nutrients.get(f.id)?.[d.key] !== undefined).length, list.length).padStart(18);
    });
    console.log(`${d.key.padEnd(18)}${cells.join("")}`);
  }

  for (const s of sources) {
    const list = bySource.get(s) ?? [];
    const missingMacro = list.filter((f) => MACROS.some((k) => nutrients.get(f.id)?.[k] === undefined));
    const noServing = list.filter((f) => !withServing.has(f.id));
    const outliers = list.flatMap((f) => {
      const n = nutrients.get(f.id);
      if (!n || n.kcal === undefined) return [];
      const expected = 4 * (n.protein_g ?? 0) + 4 * (n.carbs_g ?? 0) + 9 * (n.fat_g ?? 0) + 7 * (n.alcohol_g ?? 0);
      const diff = Math.abs(n.kcal - expected);
      return diff > 0.25 * n.kcal ? [{ f, kcal: n.kcal, expected, diff }] : [];
    });
    console.log(`\n== ${s}: ${list.length} foods · ${barcodes.get(s) ?? 0} barcodes`);
    console.log(`  missing a macro (kcal/protein/carbs/fat): ${missingMacro.length}`);
    for (const f of missingMacro.slice(0, 10)) console.log(`    ${f.id}  ${f.name}`);
    console.log(`  without any serving: ${noServing.length}`);
    console.log(`  kcal vs 4P+4C+9F+7A outliers (>25 %): ${outliers.length}`);
    for (const o of outliers.sort((a, b) => b.diff - a.diff).slice(0, MAX_OUTLIERS)) {
      console.log(`    ${o.f.id}  ${o.f.name}  kcal ${o.kcal} vs macros ${o.expected.toFixed(0)}`);
    }
  }
  console.log(`\n${foods.length} foods across ${sources.length} sources · ${elapsed(t0)}`);
}

if (isMain(import.meta.url)) main().catch((e: unknown) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
