// Open Food Facts (ODbL) Nordic bulk import → ingest_foods.
//   npm run nutrition:off -- --file "$SCRATCH/off-nordic.jsonl.gz" [--countries fi,se] [--since <unix>] [--concurrency 3]
//                             [--dry-run] [--limit N] [--from <code>]
// Input: the OFF JSONL dump (OFF_DUMP_URL, 12.8 GB gz) or, better, its grep pre-filter to the Nordic
// country tags (NUTRITION.md runbook). Either is streamed line by line; nothing is held in memory
// beyond the usable Nordic products.
// --dry-run works without SUPABASE_SERVICE_ROLE_KEY: nutrient definitions then come from the
// migration seed (lib.mts seedNutrientDefinitions) instead of the database, and no client call is made.
// Pure helpers (mapLine, scanOff, countryTags, plausible) are exported for tests; main() only runs
// when this file is the script entry.
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import {
  OFF_COUNTRIES, buildNutrientMaps, mapOffProduct, type IngestFood, type NutrientMaps, type OffProduct,
} from "../../supabase/functions/nutrition-lookup/map";
import {
  createServiceClient, die, elapsed, isMain, loadNutrientDefinitions, parseFlags, runIngest, seedNutrientDefinitions,
} from "./lib.mts";

export const OFF_DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";
const MAX_KCAL = 900; // pure fat — nothing edible exceeds it per 100 g
const MACROS = ["protein_g", "fat_g", "carbs_g"];
const PROGRESS_EVERY = 100_000;

export type Skip = "too_old" | "no_kcal" | "no_barcode" | "implausible";

/** ISO codes (any case) → OFF country tags; no codes = every Nordic tag; unknown code → throw. */
export function countryTags(codes?: string[]): Set<string> {
  if (!codes) return new Set(OFF_COUNTRIES.map(([tag]) => tag));
  return new Set(codes.map((c) => {
    const hit = OFF_COUNTRIES.find(([, code]) => code === c.toUpperCase());
    if (!hit) throw new Error(`--countries: unknown "${c}" (known: ${OFF_COUNTRIES.map(([, code]) => code.toLowerCase()).join(",")})`);
    return hit[0];
  }));
}

/** Per 100 g: kcal ≤ 900 and each macro ≤ 100 g — anything else is a label typo. */
export const plausible = (n: Record<string, number>): boolean =>
  n.kcal <= MAX_KCAL && MACROS.every((k) => (n[k] ?? 0) <= 100);

export interface Mapped {
  modified: number;
  food: IngestFood | null;
  skip: Skip | null;
}

/**
 * One dump line → ingest payload or a skip reason; null when the product is not in `tags`
 * (a substring prefilter runs before JSON.parse — the dump is ~3.5 M lines). Bad JSON throws.
 */
export function mapLine(line: string, tags: Set<string>, maps: NutrientMaps, since = 0): Mapped | null {
  if (!line.includes('"countries_tags"')) return null;
  let hit = false;
  for (const t of tags) if (line.includes(`"${t}"`)) { hit = true; break; }
  if (!hit) return null;
  const p = JSON.parse(line) as OffProduct;
  if (!p.countries_tags?.some((t) => tags.has(t))) return null;
  const modified = typeof p.last_modified_t === "number" ? p.last_modified_t : 0;
  const skip = (reason: Skip): Mapped => ({ modified, food: null, skip: reason });
  if (since > 0 && modified <= since) return skip("too_old");
  const food = mapOffProduct(p, maps);
  if (!food) return skip("no_kcal");
  if (!food.barcodes.length) return skip("no_barcode");
  if (!plausible(food.nutrients)) return skip("implausible");
  return { modified, food, skip: null };
}

export interface ScanResult {
  foods: IngestFood[];
  lines: number;
  matched: number;
  skipped: Partial<Record<Skip, number>>;
  badJson: number;
  maxModified: number;
}

const better = (a: IngestFood, b: IngestFood): boolean =>
  a.data_quality < b.data_quality || (a.data_quality === b.data_quality && Number(a.source_version) > Number(b.source_version));

/** Streams a .jsonl or .jsonl.gz dump; one food per normalised barcode (better quality, then newer, wins). */
export async function scanOff(file: string, tags: Set<string>, maps: NutrientMaps, opts: { since?: number } = {}): Promise<ScanResult> {
  const raw = createReadStream(file);
  const rl = createInterface({ input: file.endsWith(".gz") ? raw.pipe(createGunzip()) : raw, crlfDelay: Infinity });
  const byBarcode = new Map<string, IngestFood>();
  const r: ScanResult = { foods: [], lines: 0, matched: 0, skipped: {}, badJson: 0, maxModified: 0 };
  for await (const line of rl) {
    r.lines++;
    if (r.lines % PROGRESS_EVERY === 0) console.log(`  ${r.lines} lines · ${r.matched} matched · ${byBarcode.size} usable`);
    let m: Mapped | null;
    try {
      m = mapLine(line, tags, maps, opts.since);
    } catch {
      r.badJson++;
      continue;
    }
    if (!m) continue;
    r.matched++;
    r.maxModified = Math.max(r.maxModified, m.modified);
    if (m.skip) { r.skipped[m.skip] = (r.skipped[m.skip] ?? 0) + 1; continue; }
    if (!m.food) continue;
    const key = m.food.barcodes[0];
    const prev = byBarcode.get(key);
    if (!prev || better(m.food, prev)) byBarcode.set(key, m.food);
  }
  r.foods = [...byBarcode.values()];
  return r;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.file) die(`--file <path> is required — the OFF JSONL dump (${OFF_DUMP_URL}); see NUTRITION.md for the grep pre-filter`);
  if (!existsSync(flags.file)) die(`file not found: ${flags.file}`);
  const tags = countryTags(flags.countries);
  const offline = flags.dryRun && !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = offline ? createClient("http://localhost", "dry-run") : createServiceClient();
  const defs = offline ? seedNutrientDefinitions() : await loadNutrientDefinitions(client);
  const maps = buildNutrientMaps(defs);

  const scan = await scanOff(flags.file, tags, maps, { since: flags.since });
  const skipped = Object.entries(scan.skipped).map(([k, v]) => `${v} ${k}`).join(" · ") || "none";
  console.log(
    `scanned ${scan.lines} lines · ${scan.matched} in ${[...tags].join(",")} · ${scan.foods.length} usable` +
      ` · skipped: ${skipped} · ${scan.badJson} bad json · ${elapsed(t0)}`,
  );

  const r = await runIngest(client, "off", scan.foods, flags);
  console.log(
    `\noff: ${scan.foods.length} foods · ${r.batches} batches (${r.processed} foods` +
      `${Object.entries(r.actions).map(([k, v]) => ` · ${v} ${k}`).join("")}) · ${elapsed(t0)}`,
  );
  if (scan.maxModified) console.log(`next run: --since ${scan.maxModified}`);
}

if (isMain(import.meta.url)) main().catch((e: unknown) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
