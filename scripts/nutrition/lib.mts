// Shared plumbing for the nutrition ingestion scripts: service client, nutrient
// definitions, batched ingest_foods RPC with retry, resumable state file, flags, unzip.
// Self-check:  npx vite-node --script scripts/nutrition/lib.mts
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** Where zips are extracted. Override with NUTRITION_SCRATCH=/some/dir. */
export const SCRATCH =
  process.env.NUTRITION_SCRATCH ??
  "/private/tmp/claude-501/-Users-rasmuspetterson-The-W-Tracker/41b11332-bd41-444e-83f8-5fdc2543bd10/scratchpad/nutrition";
const STATE_FILE = join(ROOT, ".nutrition-ingest-state.json");
export const BATCH_SIZE = 200;

// ---- ingest_foods payload (Phase 1 contract) ----------------------------------------
export interface FoodServingPayload {
  label: string;
  grams: number;
  source_unit: string | null;
  is_default: boolean;
}
export interface FoodPayload {
  source: string;
  source_id: string;
  name: string;
  name_fi: string | null;
  name_en: string | null;
  brand: string | null;
  country: string | null;
  category: string | null;
  food_type: "food" | "dish" | "branded" | "custom";
  data_quality: number;
  image_url: string | null;
  source_version: string;
  barcodes: string[];
  servings: FoodServingPayload[];
  nutrients: Record<string, number>;
}
export interface NutrientDef {
  id: number;
  key: string;
  unit: string;
  fineli_code: string | null;
  fineli_factor: number | null;
  usda_nutrient_id: number | null;
  usda_factor: number | null;
}

/** numeric(12,4) in the DB — round once here so payloads are stable. */
export const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

/** True when this module is the script being run (not imported by a test or another script). */
export function isMain(url: string): boolean {
  const entry = process.argv[1] ?? "";
  // node / `vite-node --script`: argv[1] is the entry file. Plain `vite-node file.mts -- flags`
  // rewrites argv to [node, vite-node, ...flags] and hides the entry — treat as main. vitest
  // leaves argv[1] = vitest, so importing the pure helpers in a test never runs main().
  return resolve(entry) === fileURLToPath(url) || basename(entry).startsWith("vite-node");
}

// ---- flags ----------------------------------------------------------------------------
export interface Flags {
  dryRun: boolean;
  limit?: number;
  from?: string;
  zip?: string;
  dataset?: string;
}
export function parseFlags(argv: string[]): Flags {
  const f: Flags = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = (): string => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) die(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case "--": break;
      case "--dry-run": f.dryRun = true; break;
      case "--limit": {
        const n = Number(value());
        if (!Number.isInteger(n) || n <= 0) die("--limit must be a positive integer");
        f.limit = n;
        break;
      }
      case "--from": f.from = value(); break;
      case "--zip": f.zip = resolve(value()); break;
      case "--dataset": f.dataset = value(); break;
      default: die(`unknown flag ${a} (known: --dry-run --limit N --from <source_id> --zip <path> --dataset <name>)`);
    }
  }
  return f;
}

// ---- state file -----------------------------------------------------------------------
export type IngestState = Record<string, { lastSourceId: string; done: boolean; total: number }>;
export const loadState = (file = STATE_FILE): IngestState =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IngestState) : {};
export const saveState = (state: IngestState, file = STATE_FILE): void =>
  writeFileSync(file, JSON.stringify(state, null, 2) + "\n");

// ---- supabase -------------------------------------------------------------------------
function readDotEnv(name: string): string | undefined {
  const p = join(ROOT, ".env");
  if (!existsSync(p)) return undefined;
  const m = readFileSync(p, "utf8").match(new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\n]*)"?`, "m"));
  return m?.[1].trim() || undefined;
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? readDotEnv("SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) die("SUPABASE_URL is not set (env or .env).");
  if (!key) {
    die(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is never committed — export it in this shell first:\n" +
        "  export SUPABASE_SERVICE_ROLE_KEY=...   (Supabase dashboard → Project settings → API → service_role)",
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function loadNutrientDefinitions(client: SupabaseClient): Promise<NutrientDef[]> {
  const { data, error } = await client
    .from("nutrient_definitions")
    .select("id, key, unit, fineli_code, fineli_factor, usda_nutrient_id, usda_factor")
    .order("id");
  if (error) throw new Error(`nutrient_definitions: ${error.message}`);
  const defs = (data ?? []) as NutrientDef[];
  if (!defs.length) throw new Error("nutrient_definitions is empty — apply the Phase 1 migrations first.");
  return defs;
}

const RETRIES = 3;
async function rpcIngest(client: SupabaseClient, batch: FoodPayload[]): Promise<{ action: string }[]> {
  for (let attempt = 1; ; attempt++) {
    const { data, error, status } = await client.rpc("ingest_foods", { p_foods: batch });
    if (!error) return (data ?? []) as { action: string }[];
    // status 0 = fetch failed (postgrest-js swallows network errors into the error object)
    const retryable = status === 0 || status >= 500 || /fetch failed|ECONN|socket|timed? ?out/i.test(error.message);
    if (!retryable || attempt === RETRIES) {
      throw new Error(`ingest_foods failed (HTTP ${status}): ${error.message}${error.details ? ` — ${error.details}` : ""}`);
    }
    const wait = 1000 * 2 ** (attempt - 1);
    console.warn(`  attempt ${attempt}/${RETRIES} failed (HTTP ${status}: ${error.message}) — retrying in ${wait} ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

export interface IngestResult {
  batches: number;
  processed: number;
  actions: Record<string, number>;
}

/** Sends foods to ingest_foods in batches; onBatch(lastSourceId) fires after each committed batch. */
export async function ingestBatch(
  client: SupabaseClient,
  foods: FoodPayload[],
  batchSize = BATCH_SIZE,
  opts: { dryRun?: boolean; onBatch?: (lastSourceId: string) => void } = {},
): Promise<IngestResult> {
  const batches = Math.ceil(foods.length / batchSize);
  const actions: Record<string, number> = {};
  for (let b = 0; b < batches; b++) {
    const batch = foods.slice(b * batchSize, (b + 1) * batchSize);
    const first = batch[0].source_id;
    const last = batch[batch.length - 1].source_id;
    const t0 = Date.now();
    if (opts.dryRun) {
      console.log(`  [dry-run] batch ${b + 1}/${batches}: ${batch.length} foods (${first} … ${last})`);
    } else {
      const counts: Record<string, number> = {};
      for (const r of await rpcIngest(client, batch)) counts[r.action] = (counts[r.action] ?? 0) + 1;
      for (const [k, v] of Object.entries(counts)) actions[k] = (actions[k] ?? 0) + v;
      const detail = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ") || "no rows returned";
      console.log(`  batch ${b + 1}/${batches}: ${batch.length} foods → ${detail} (${Date.now() - t0} ms)`);
    }
    opts.onBatch?.(last);
  }
  return { batches, processed: foods.length, actions };
}

/** Resume/--from/--limit/--dry-run handling around ingestBatch, with the state file. */
export async function runIngest(client: SupabaseClient, source: string, foods: FoodPayload[], flags: Flags): Promise<IngestResult> {
  const state = loadState();
  const prev = state[source];
  let start = 0;
  if (flags.from) {
    start = foods.findIndex((f) => f.source_id === flags.from);
    if (start < 0) die(`--from ${flags.from}: no such source_id in ${source}`);
  } else if (prev && !prev.done) {
    const i = foods.findIndex((f) => f.source_id === prev.lastSourceId);
    if (i >= 0) {
      start = i + 1;
      console.log(`resuming ${source} after ${prev.lastSourceId} (${start}/${foods.length} done — delete ${basename(STATE_FILE)} to restart)`);
    }
  }
  const slice = foods.slice(start, flags.limit ? start + flags.limit : undefined);
  console.log(`${source}: ${slice.length} of ${foods.length} foods to ingest${flags.dryRun ? " (dry-run, nothing written)" : ""}`);
  const result = await ingestBatch(client, slice, BATCH_SIZE, {
    dryRun: flags.dryRun,
    onBatch: (lastSourceId) => {
      if (flags.dryRun) return;
      state[source] = { lastSourceId, done: false, total: foods.length };
      saveState(state);
    },
  });
  if (!flags.dryRun && !flags.limit && slice.length) {
    state[source] = { lastSourceId: slice[slice.length - 1].source_id, done: true, total: foods.length };
    saveState(state);
  }
  return result;
}

// ---- zip / files ----------------------------------------------------------------------
export function unzipToScratch(zipPath: string): string {
  if (!existsSync(zipPath)) die(`zip not found: ${zipPath}`);
  const dir = join(SCRATCH, basename(zipPath).replace(/\.zip$/i, ""));
  mkdirSync(dir, { recursive: true });
  execFileSync("unzip", ["-oq", zipPath, "-d", dir], { stdio: "inherit" });
  return dir;
}

/** Case-insensitive recursive search by basename (zips carry a release-folder prefix). */
export function findFile(dir: string, name: string): string | undefined {
  const lower = name.toLowerCase();
  const hit = readdirSync(dir, { recursive: true }).find((p) => basename(String(p)).toLowerCase() === lower);
  return hit === undefined ? undefined : join(dir, String(hit));
}
export const requireFile = (dir: string, name: string): string =>
  findFile(dir, name) ?? die(`${name} not found under ${dir}`);

export const elapsed = (t0: number): string => `${((Date.now() - t0) / 1000).toFixed(1)} s`;

// ---- self-check -----------------------------------------------------------------------
export function runSelfCheck(): void {
  const dir = mkdtempSync(join(tmpdir(), "nutrition-state-"));
  const file = join(dir, "state.json");
  try {
    assert.deepEqual(loadState(file), {}, "missing file → empty state");
    const s: IngestState = { fineli: { lastSourceId: "123", done: false, total: 4 } };
    saveState(s, file);
    assert.deepEqual(loadState(file), s, "state round-trip");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(
    parseFlags(["--", "--dry-run", "--limit", "5", "--from", "x", "--zip", "a.zip", "--dataset", "foundation"]),
    { dryRun: true, limit: 5, from: "x", zip: resolve("a.zip"), dataset: "foundation" },
  );
  assert.deepEqual(parseFlags([]), { dryRun: false });
  assert.equal(round4(650.5 / 4.184), 155.4732);
  console.log("lib.mts self-check: OK");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) runSelfCheck();
