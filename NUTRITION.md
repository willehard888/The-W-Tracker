# Nutrition engine — operations runbook

The nutrition engine is a real food database (Fineli + USDA FoodData Central + Open Food
Facts), a deterministic calculation engine that lives in SQL (`nutrition_for_grams`) and is
mirrored on the client, a meal diary with per-item nutrition snapshots, user recipes, barcode
lookup, an AI photo scanner that only *identifies* food, a daily dashboard and personal
targets. This file is the part that needs a human with keys.

## One-time setup (founder)

1. **Push the schema.** Pre-flight, then push:
   ```bash
   supabase db query --linked "select name from pg_available_extensions where name in ('pg_trgm','unaccent')"
   supabase db push
   ```
   Migrations `20260905100000` … `20260905100600` create the catalog, diary, recipes, targets,
   scan cache, the `meal-photos` bucket and every RPC. Smoke:
   ```bash
   supabase db query --linked "select public.normalize_barcode('012345678905')"   -- 0012345678905
   supabase db query --linked "select count(*) from public.nutrient_definitions"   -- ~50
   ```
2. **Secrets for the edge functions** (never in the client, never in git):
   ```bash
   supabase secrets set USDA_FDC_API_KEY=<key from https://fdc.nal.usda.gov/api-key-signup/> OFF_USER_AGENT="WhealthFactory/1.0 (rasmus.willehard@gmail.com)"
   ```
   `DEMO_KEY` is limited to 30 requests/hour — get a real key. `OPENROUTER_API_KEY` already
   exists (the scanner reuses it).
3. **Deploy functions** (deploys all of them):
   ```bash
   npm run deploy:functions
   ```
4. **Load the generic food catalog.** Fineli's site sits behind a browser challenge, so
   download the open-data zip in a browser first (https://fineli.fi/fineli/en/avoin-data →
   the release zip). USDA zips come from https://fdc.nal.usda.gov/download-datasets/
   (Foundation Foods CSV and SR Legacy CSV).
   ```bash
   export SUPABASE_SERVICE_ROLE_KEY=<service role key>
   npm run nutrition:fineli -- --zip ~/Downloads/Fineli_Rel20.zip
   npm run nutrition:usda   -- --dataset foundation --zip ~/Downloads/FoodData_Central_foundation_food_csv_2026-04.zip
   npm run nutrition:usda   -- --dataset sr_legacy  --zip ~/Downloads/FoodData_Central_sr_legacy_food_csv_2018-04.zip
   npm run nutrition:report
   unset SUPABASE_SERVICE_ROLE_KEY
   ```
   Scripts are idempotent (upsert on `(source, source_id)`) and resumable
   (`.nutrition-ingest-state.json`, gitignored). `--dry-run` and `--limit 200` exist for a
   first pass. Expect ~4 k Fineli + ~10 k USDA foods, a few minutes.
5. **Regenerate the client types** so the app compiles against the new tables:
   ```bash
   npm run types:gen
   ```
   Commit `src/integrations/supabase/types.ts` with the feature.

## Open Food Facts bulk import (Nordic)

Branded products sold in FI/SE/NO/DK/EE are bulk-loaded from the OFF JSONL dump (source `off`,
`source_id` = the raw OFF code, the same row `nutrition-lookup` writes on demand). Everything
else branded still arrives on demand through `nutrition-lookup` (barcode scan, "Search online"),
and unknown barcodes are remembered for 7 days so OFF is not hammered.

Expect 150–200 k products ≈ 0.5 GB in Postgres (foods + nutrients + servings + barcodes) —
a Pro project, not the free tier. The dump itself is 12.8 GB gzipped and is streamed through
`grep` once; only the Nordic slice (≈0.4–0.7 GB) is kept on disk.

```bash
export SCRATCH=${NUTRITION_SCRATCH:-/private/tmp/claude-501/-Users-rasmuspetterson-The-W-Tracker/41b11332-bd41-444e-83f8-5fdc2543bd10/scratchpad/nutrition}; mkdir -p "$SCRATCH"
curl -sSL --retry 5 https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz | gunzip \
 | LC_ALL=C grep -aF -e '"en:finland"' -e '"en:sweden"' -e '"en:norway"' -e '"en:denmark"' -e '"en:estonia"' \
 | gzip -1 > "$SCRATCH/off-nordic.jsonl.gz"        # 12.8 GB gz streamed, never stored; ≈0.4–0.7 GB result
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
npm run nutrition:off -- --file "$SCRATCH/off-nordic.jsonl.gz" --dry-run --limit 20
npm run nutrition:off -- --file "$SCRATCH/off-nordic.jsonl.gz" --concurrency 3      # ~10–20 min, resumable
npm run nutrition:report
supabase db query --linked "ANALYZE public.foods, public.food_nutrients, public.food_servings, public.food_barcodes"
unset SUPABASE_SERVICE_ROLE_KEY
npm run types:gen
```

The script skips products without per-100 g energy, without a valid GS1 barcode, or with
label typos (kcal > 900 or a macro > 100 g per 100 g), keeps one product per barcode (better
`data_quality`, then newer `last_modified_t`) and prints every skip count. `--dry-run` needs no
service key (nutrient definitions come from the migration seed). `--countries fi,se` narrows
the set; `--concurrency 1..8` runs that many `ingest_foods` batches in flight (deadlocks on
`food_barcodes` are retried — the RPC is idempotent).

**Monthly refresh:** OFF republishes the dump nightly. Re-run the runbook with
`--since <the max last_modified_t the previous run printed as "next run: --since N">` so only
products edited since then are re-ingested.

**ODbL separability:** the OFF rows are single-source and can be switched off in one statement —
`UPDATE foods SET is_active = false WHERE source = 'off'`. Never `DELETE` them: recipe items
reference `foods` with `ON DELETE RESTRICT`, and diary items keep their snapshots but lose the
link. Attribution: "Data from Open Food Facts (ODbL)" — the in-app sheet renders the fuller
line from `food_sources`.

## Data sources and what we owe them

| Source | What we take | Licence | In-app attribution |
|---|---|---|---|
| Fineli (THL) | ~4 000 Finnish generic foods and dishes, full micronutrients, Finnish names | CC BY 4.0 | "Lähde: Terveyden ja hyvinvoinnin laitos, Fineli" + a note that units were converted and kcal derived from kJ |
| USDA FoodData Central | Foundation + SR Legacy generic foods; Branded on demand | CC0 (attribution requested) | "U.S. Department of Agriculture, FoodData Central" |
| Open Food Facts | Branded products by barcode / name | ODbL 1.0 + DbCL 1.0 (images CC BY-SA, not used) | "© Open Food Facts contributors, ODbL" with a per-product link |

Open Food Facts rows are kept single-source (never merged into Fineli/USDA rows) so the
ODbL-derived subset stays separable. Product images are not rendered because their CC BY-SA
credit UI is not built. The attribution sheet in the app is generated from `food_sources`.

## Limits and cost

- Photo scans: 15/day on trial, 60/day paid (`bump_ai_usage`, kind `nutrition`), model
  `google/gemini-2.5-flash` via OpenRouter, roughly $0.003–0.005 per scan; identical photos
  hit a per-user cache and cost nothing.
- Online food lookups: 300/day per user (kind `nutrition_lookup`). OFF allows 15 product
  reads and 10 searches per minute *per IP*, shared across all edge-function egress — the
  7-day miss cache and the explicit "Search online" button are what keep us under it.
- The scanner never returns nutrition numbers; the model reports food names, preparation and
  a gram range with confidence, and the database supplies nutrition for the matched food.
  Everything it produces is labelled *Estimated* and must be confirmed before it is saved.

## Troubleshooting

- `permission denied to set parameter "pg_trgm.word_similarity_threshold"` on `db push`: a migration that (re)creates a function with a `SET pg_trgm.*` clause must first call any pg_trgm function (`SELECT extensions.similarity('a','a');`) so the GUC exists in that session; the local dry run runs as superuser and never sees this.

- `similarity()` / `unaccent` "does not exist" in a new SQL function → the function must
  `SET search_path = public, extensions` (the extensions live in the `extensions` schema).
- `ingest_foods` rejects a batch with an unknown nutrient key → the script's mapping and
  `nutrient_definitions` drifted; fix the seed, never the data.
- `nutrition-lookup` answers `upstream_rate_limited` → OFF is throttling the shared egress IP;
  it retries once with backoff, then the client shows "Not found. Nothing was invented."
- Scanner returns `invalid_ai_response` → the model answered outside the forced tool call;
  it is retryable, nothing was cached.
- HealthKit does not report per-type write denials; a denied write fails silently by design
  and never blocks the diary.

## Local dry run of the SQL (no Docker needed)

Every migration and RPC was executed on a local PostgreSQL 17 before it ever reached prod,
with the client engine's contract fixture asserted against `nutrition_for_grams` and the
calc/RLS check scripts. Homebrew's `postgresql@17` is keg-only and collides with the
force-linked `libpq`, so run its binaries from their own bin dir:

```bash
export PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH LANG=C LC_ALL=C
PGDATA=/tmp/wf-pgdata; initdb -D $PGDATA -U postgres --auth=trust --locale=C -E UTF8
pg_ctl -D $PGDATA -o "-p 5499 -k /tmp" -l $PGDATA/pg.log start
psql -h /tmp -p 5499 -U postgres -c 'CREATE DATABASE wf'
psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -q -f scripts/nutrition/local-stubs.sql
for f in supabase/migrations/2026090[56]*.sql; do psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -q -f $f || break; done
for c in contract-check calc-check rls-check search-check; do psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -q -f scripts/nutrition/$c.sql || break; done
node scripts/nutrition/gen-local-types.mjs > /tmp/local-types.ts && node scripts/nutrition/splice-types.mjs /tmp/local-types.ts
pg_ctl -D $PGDATA stop
```

`local-stubs.sql` fakes only what Supabase provides (roles, `auth.uid()`, storage tables,
`has_active_access`, `bump_ai_usage`); the migrations themselves are the real files. The
last line regenerates the nutrition entries of `src/integrations/supabase/types.ts` from the
local schema — `npm run types:gen` against prod supersedes it.

## Verification before shipping

The gate chain (`npx tsc --noEmit && node scripts/type-debt.mjs && node scripts/style-guard.mjs &&
npx vitest run && npm run build`), the SQL checks in `scripts/nutrition/*.sql`, and the native
walkthrough on the iPhone simulator listed in the plan. Re-run the 30-photo weighed-meal
accuracy benchmark after any prompt or model change and publish the medians in the release
notes — they are the number behind the "Estimated" label.
