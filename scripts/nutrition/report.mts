// Catalog quality report — one RPC (nutrition_catalog_report, service role only): per-source
// counts, nutrient coverage, macro-consistency outliers, foods without servings, barcodes.
//   npx vite-node scripts/nutrition/report.mts
import { createServiceClient, die, elapsed, isMain, loadNutrientDefinitions } from "./lib.mts";

interface SourceReport {
  foods: number;
  no_serving: number;
  missing_macro: number;
  barcodes: number;
  coverage: Record<string, number>;
  outlier_count: number;
  outliers: { id: string; name: string; kcal: number; expected: number }[];
}

const pct = (n: number, d: number): string => (d ? `${((100 * n) / d).toFixed(1).padStart(5)} %` : "    — ");

async function main(): Promise<void> {
  const t0 = Date.now();
  const client = createServiceClient();
  const defs = await loadNutrientDefinitions(client);
  const { data, error } = await client.rpc("nutrition_catalog_report");
  if (error) throw new Error(`nutrition_catalog_report: ${error.message}`);
  const report = (data ?? {}) as Record<string, SourceReport>;
  const sources = Object.keys(report).sort();

  console.log(`${"nutrient".padEnd(18)}${sources.map((s) => s.padStart(18)).join("")}`);
  console.log(`${"foods".padEnd(18)}${sources.map((s) => String(report[s].foods).padStart(18)).join("")}`);
  for (const d of defs) {
    console.log(`${d.key.padEnd(18)}${sources.map((s) => pct(report[s].coverage[d.key] ?? 0, report[s].foods).padStart(18)).join("")}`);
  }

  let total = 0;
  for (const s of sources) {
    const r = report[s];
    total += r.foods;
    console.log(`\n== ${s}: ${r.foods} foods · ${r.barcodes} barcodes`);
    console.log(`  missing a macro (kcal/protein/carbs/fat): ${r.missing_macro}`);
    console.log(`  without any serving: ${r.no_serving}`);
    console.log(`  kcal vs 4P+4C+9F+7A outliers (>25 %): ${r.outlier_count}`);
    for (const o of r.outliers) console.log(`    ${o.id}  ${o.name}  kcal ${o.kcal} vs macros ${o.expected}`);
  }
  console.log(`\n${total} foods across ${sources.length} sources · ${elapsed(t0)}`);
}

if (isMain(import.meta.url)) main().catch((e: unknown) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
