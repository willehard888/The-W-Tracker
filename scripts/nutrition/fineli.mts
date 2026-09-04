// Fineli (THL open data, CC BY 4.0) → ingest_foods.
//   npx vite-node scripts/nutrition/fineli.mts -- --zip ~/Downloads/Fineli_Rel20.zip [--dry-run] [--limit N] [--from FOODID]
// Without --zip it tries https://fineli.fi/fineli/content/file/47, which is usually
// Cloudflare-gated for non-browsers — download the zip in a browser and pass --zip.
// Pure mapping helpers (sentenceCase, buildFineliFoods) are exported for tests; main() only
// runs when this file is the script entry.
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseNumber, readCsvRecords, type Rec } from "./csv.mts";
import {
  SCRATCH, createServiceClient, die, elapsed, isMain, loadNutrientDefinitions, parseFlags,
  requireFile, round4, runIngest, unzipToScratch, type FoodPayload, type FoodServingPayload, type NutrientDef,
} from "./lib.mts";

export const FINELI_URL = "https://fineli.fi/fineli/content/file/47";
/** Unit codes that are not real portions: "G" (1 g) and the 1000 kJ reference portion. */
export const FINELI_SKIP_UNITS = new Set(["G", "PORT1000KJ"]);

export interface FineliTables {
  food: Rec[];           // FOODID, FOODNAME, FOODTYPE
  nameFi: Rec[];         // FOODID, FOODNAME
  nameEn: Rec[];         // FOODID, FOODNAME
  componentValue: Rec[]; // FOODID, EUFDNAME, BESTLOC
  component: Rec[];      // EUFDNAME, COMPUNIT
  addUnit: Rec[];        // FOODID, FOODUNIT, MASS
  unitFi: Rec[];         // THSCODE, DESCRIPT
  unitEn: Rec[];         // THSCODE, DESCRIPT
}

/** "KANANMUNA, KEITETTY" → "Kananmuna, keitetty". Mixed-case input is left alone. */
export function sentenceCase(s: string): string {
  const t = s.trim();
  if (t !== t.toUpperCase()) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

const normUnit = (u: string): string => u.trim().toUpperCase().replace(/^[µΜ]G$/, "UG");

export interface FineliBuild {
  foods: FoodPayload[];
  skippedNoKcal: number;
  unitMismatches: string[];
}

export function buildFineliFoods(t: FineliTables, defs: NutrientDef[], sourceVersion: string): FineliBuild {
  // nutrient code → definitions; drop a mapping whose unit disagrees with component.csv
  // (only when the factor is 1 — a factor ≠ 1 is a deliberate conversion like kJ→kcal, mg→g).
  const compUnit = new Map(t.component.map((r) => [r.EUFDNAME.trim(), normUnit(r.COMPUNIT)]));
  const unitMismatches: string[] = [];
  const byCode = new Map<string, NutrientDef[]>();
  for (const d of defs) {
    if (!d.fineli_code) continue;
    const u = compUnit.get(d.fineli_code);
    if (u !== undefined && (d.fineli_factor ?? 1) === 1 && u !== d.unit.toUpperCase()) {
      unitMismatches.push(`${d.key} (${d.fineli_code}): Fineli ${u} vs ${d.unit} — values skipped`);
      continue;
    }
    byCode.set(d.fineli_code, [...(byCode.get(d.fineli_code) ?? []), d]);
  }

  const nutrients = new Map<string, Record<string, number>>();
  for (const r of t.componentValue) {
    const ds = byCode.get(r.EUFDNAME.trim());
    if (!ds) continue;
    const v = parseNumber(r.BESTLOC);
    if (!Number.isFinite(v) || v < 0) continue;
    const bag = nutrients.get(r.FOODID) ?? {};
    for (const d of ds) bag[d.key] = round4(v * (d.fineli_factor ?? 1));
    nutrients.set(r.FOODID, bag);
  }

  const unitLabel = new Map<string, string>();
  for (const r of [...t.unitEn, ...t.unitFi]) unitLabel.set(r.THSCODE.trim(), r.DESCRIPT.trim()); // FI wins
  const servings = new Map<string, FoodServingPayload[]>();
  for (const r of t.addUnit) {
    const code = r.FOODUNIT.trim();
    const grams = parseNumber(r.MASS);
    if (FINELI_SKIP_UNITS.has(code) || !Number.isFinite(grams) || grams <= 0 || grams > 5000) continue;
    const list = servings.get(r.FOODID) ?? [];
    const label = `${unitLabel.get(code) || code} (${grams} g)`;
    if (list.some((s) => s.label === label)) continue;
    list.push({ label, grams, source_unit: code, is_default: list.length === 0 });
    servings.set(r.FOODID, list);
  }

  const nameFi = new Map(t.nameFi.map((r) => [r.FOODID, r.FOODNAME]));
  const nameEn = new Map(t.nameEn.map((r) => [r.FOODID, r.FOODNAME]));
  const foods: FoodPayload[] = [];
  let skippedNoKcal = 0;
  for (const r of t.food) {
    const id = r.FOODID.trim();
    const bag = nutrients.get(id);
    if (!bag || bag.kcal === undefined) { skippedNoKcal++; continue; }
    const fi = sentenceCase(nameFi.get(id) ?? r.FOODNAME ?? "") || null;
    const en = sentenceCase(nameEn.get(id) ?? "") || null;
    const type = r.FOODTYPE.trim().toUpperCase();
    foods.push({
      source: "fineli",
      source_id: id,
      name: fi ?? en ?? id,
      name_fi: fi,
      name_en: en,
      brand: null,
      country: "FI",
      category: type.toLowerCase() || null,
      food_type: type === "DISH" ? "dish" : "food",
      data_quality: 1,
      image_url: null,
      source_version: sourceVersion,
      barcodes: [],
      servings: servings.get(id) ?? [],
      nutrients: bag,
    });
  }
  return { foods, skippedNoKcal, unitMismatches };
}

/** "…/Fineli_Rel20/food.csv" or "Fineli_Rel20.zip" → "Fineli_Rel20"; else "Fineli". */
export function fineliVersion(...paths: string[]): string {
  const m = paths.join(" ").match(/Rel[_ ]?(\d+)/i);
  return m ? `Fineli_Rel${m[1]}` : "Fineli";
}

async function downloadFineli(): Promise<string> {
  console.log(`no --zip given — trying ${FINELI_URL} …`);
  const res = await fetch(FINELI_URL).catch((e: unknown) => die(`download failed: ${e instanceof Error ? e.message : String(e)}`));
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isHtml = (res.headers.get("content-type") ?? "").includes("text/html");
  if (!res.ok || isHtml || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    die("Fineli is behind a browser challenge: download the open-data zip in a browser and pass --zip <path>", 2);
  }
  mkdirSync(SCRATCH, { recursive: true });
  const out = join(SCRATCH, "fineli-open-data.zip");
  writeFileSync(out, bytes);
  console.log(`saved ${out} (${(bytes.length / 1e6).toFixed(1)} MB)`);
  return out;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const flags = parseFlags(process.argv.slice(2));
  const zip = flags.zip ?? (await downloadFineli());
  const dir = unzipToScratch(zip);
  const csv = (name: string, columns: string[]): Rec[] =>
    readCsvRecords(requireFile(dir, name), { delimiter: ";", encoding: "windows-1252", columns });
  const tables: FineliTables = {
    food: csv("food.csv", ["FOODID", "FOODNAME", "FOODTYPE"]),
    nameFi: csv("foodname_FI.csv", ["FOODID", "FOODNAME"]),
    nameEn: csv("foodname_EN.csv", ["FOODID", "FOODNAME"]),
    componentValue: csv("component_value.csv", ["FOODID", "EUFDNAME", "BESTLOC"]),
    component: csv("component.csv", ["EUFDNAME", "COMPUNIT"]),
    addUnit: csv("foodaddunit.csv", ["FOODID", "FOODUNIT", "MASS"]),
    unitFi: csv("foodunit_FI.csv", ["THSCODE", "DESCRIPT"]),
    unitEn: csv("foodunit_EN.csv", ["THSCODE", "DESCRIPT"]),
  };
  const version = fineliVersion(requireFile(dir, "food.csv").slice(dir.length), basename(zip));
  console.log(`parsed ${tables.food.length} foods, ${tables.componentValue.length} component values (${version}) in ${elapsed(t0)}`);

  const client = createServiceClient();
  const defs = await loadNutrientDefinitions(client);
  const { foods, skippedNoKcal, unitMismatches } = buildFineliFoods(tables, defs, version);
  for (const m of unitMismatches) console.warn(`  unit mismatch: ${m}`);
  const r = await runIngest(client, "fineli", foods, flags);
  console.log(
    `\nfineli: ${foods.length} foods parsed · ${skippedNoKcal} skipped without kcal · ${r.batches} batches (${r.processed} foods` +
      `${Object.entries(r.actions).map(([k, v]) => ` · ${v} ${k}`).join("")}) · ${elapsed(t0)}`,
  );
}

if (isMain(import.meta.url)) main().catch((e: unknown) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
