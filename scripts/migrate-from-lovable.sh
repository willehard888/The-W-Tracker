#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# migrate-from-lovable.sh
#
# Clean-break migration from the Lovable-managed Supabase project to your
# own Supabase project. Implements Option B from Lovable's transfer
# guidance: pg_dump the source → psql restore into destination, preserving
# auth users (including password hashes / Apple identity links), public
# schema (profiles, badges, tribes, etc.), and storage metadata.
#
# What this script DOES:
#   1. Dumps schema + data + auth from the source (Lovable) project
#   2. Restores everything into the destination (your-org) project
#   3. Sets OPENROUTER_API_KEY on the destination project
#   4. Deploys every edge function from supabase/functions/ to the dest
#
# What this script does NOT do — handle these manually after the script:
#   • Storage bucket FILES (only metadata moves with pg_dump). Use
#     `supabase storage cp` to copy proof photos / feed media if you
#     need them. New users won't notice missing historical media.
#   • OAuth provider config (Apple Sign In, Google). Add them in
#     Authentication → Providers on the destination project and update
#     the redirect URL in Apple Developer / Google Cloud Console.
#   • Scheduled cron jobs. Re-create with pg_cron after migration (see
#     scripts/recreate-cron-jobs.sql — generated as a sibling).
#   • Stripe / RevenueCat webhook URLs. Point them at the new project.
#
# Usage:
#   export SOURCE_REF=zjdljojkgrpgxurugixf
#   export SOURCE_DB_PW='lovable-db-password'
#   export DEST_REF=gcwuvijcuzhunkcauzom
#   export DEST_DB_PW='your-db-password'
#   export SOURCE_REGION='eu-central-1'    # match the source project region
#   export DEST_REGION='eu-central-1'      # match the destination project region
#   export OPENROUTER_API_KEY='sk-or-v1-...'
#   bash scripts/migrate-from-lovable.sh
#
# Prerequisites:
#   • supabase CLI (≥ 1.155) logged in via `supabase login --token $SUPABASE_ACCESS_TOKEN`
#   • pg_dump + psql (PostgreSQL ≥ 14) on PATH
#   • A clean destination project (or one that has the matching schema —
#     pg_dump --clean --if-exists wipes & recreates each object)
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${SOURCE_REF:?SOURCE_REF is required (the Lovable project ref)}"
: "${SOURCE_DB_PW:?SOURCE_DB_PW is required (Lovable Cloud → Database → Reset password)}"
: "${DEST_REF:?DEST_REF is required (your own Supabase project ref)}"
: "${DEST_DB_PW:?DEST_DB_PW is required (destination project's DB password)}"
: "${SOURCE_REGION:?SOURCE_REGION is required (e.g. eu-central-1 — same as source project)}"
: "${DEST_REGION:?DEST_REGION is required (e.g. eu-central-1 — same as destination project)}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required (sk-or-v1-...)}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP_FILE="${ROOT_DIR}/scripts/_lovable-dump.sql"

# Use the pooler ports (5432) — port 6543 is the transaction-pooler which
# doesn't support all the COPY / extension commands pg_dump issues.
SOURCE_URL="postgresql://postgres.${SOURCE_REF}:${SOURCE_DB_PW}@aws-0-${SOURCE_REGION}.pooler.supabase.com:5432/postgres"
DEST_URL="postgresql://postgres.${DEST_REF}:${DEST_DB_PW}@aws-0-${DEST_REGION}.pooler.supabase.com:5432/postgres"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Lovable → Own-org Supabase migration"
echo "  Source: ${SOURCE_REF}  (region ${SOURCE_REGION})"
echo "  Dest:   ${DEST_REF}    (region ${DEST_REGION})"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# Step 1: dump schema + data + auth from source
# ──────────────────────────────────────────────────────────────────────────
echo "▶ Step 1/4 — Dumping source project into ${DUMP_FILE}"
echo "  (this can take 30 s – several minutes depending on data size)"

pg_dump \
  --clean --if-exists \
  --quote-all-identifiers \
  --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  "${SOURCE_URL}" > "${DUMP_FILE}"

DUMP_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
DUMP_LINES=$(wc -l < "${DUMP_FILE}")
echo "  ✅ Dump complete — ${DUMP_SIZE}, ${DUMP_LINES} lines"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# Step 2: restore into destination
# ──────────────────────────────────────────────────────────────────────────
echo "▶ Step 2/4 — Restoring dump into destination project"
echo "  WARNING: --clean --if-exists in the dump will DROP existing"
echo "  objects in public / auth / storage on the destination first."
echo ""
read -r -p "  Continue? (yes/no) " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "  Aborted by user. Dump file kept at ${DUMP_FILE} for inspection."
  exit 1
fi

# Step 2a: enable non-default extensions on destination BEFORE the dump
# restore. Lovable's inventory confirmed the source uses pg_cron, pg_net,
# pgcrypto, uuid-ossp (plus plpgsql, pg_stat_statements, supabase_vault
# which Supabase auto-enables). Without these enabled first, the restore
# will fail on the first CREATE EXTENSION line in the dump.
echo "  ▸ Enabling required extensions on destination…"
psql -v ON_ERROR_STOP=1 "${DEST_URL}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL
echo "  ✅ Extensions enabled"
echo ""

# Step 2b: restore the dump. `--single-transaction` runs the whole restore
# in a single transaction; if anything errors out, the destination rolls
# back to its pre-migration state. `-v ON_ERROR_STOP=1` makes psql exit
# non-zero on the first failure so we don't silently complete a partial
# migration.
echo "  ▸ Restoring dump…"
psql \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  "${DEST_URL}" < "${DUMP_FILE}"

echo "  ✅ Restore complete"
echo ""

# Step 2c: recreate storage RLS policies (the dump may have them, but
# running this is idempotent and guarantees they exist).
echo "  ▸ Recreating storage buckets + RLS policies…"
psql -v ON_ERROR_STOP=1 "${DEST_URL}" \
  -f "${ROOT_DIR}/scripts/recreate-storage-policies.sql"
echo "  ✅ Storage policies in place"
echo ""

# Step 2d: recreate pg_cron jobs (cron schema is not transferred by
# default pg_dump because it lives in the `cron` schema and Supabase's
# permissions disallow it).
if [ -f "${ROOT_DIR}/scripts/recreate-cron-jobs.sql" ]; then
  echo "  ▸ Recreating pg_cron jobs…"
  psql -v ON_ERROR_STOP=1 "${DEST_URL}" \
    -f "${ROOT_DIR}/scripts/recreate-cron-jobs.sql"
  echo "  ✅ Cron jobs scheduled"
  echo ""
fi

# Step 2e: recreate realtime publication tables (the dump should carry
# this but be defensive — re-add the four tables Lovable confirmed are
# in supabase_realtime).
echo "  ▸ Recreating supabase_realtime publication tables…"
psql -v ON_ERROR_STOP=1 "${DEST_URL}" <<'SQL'
DO $$
BEGIN
  -- Drop existing tables from the publication first to avoid duplicate errors
  PERFORM 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF FOUND THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE
        public.battles, public.direct_messages, public.kudos, public.profiles;
    EXCEPTION WHEN OTHERS THEN
      -- Tables may not be in the publication yet — that's fine
      NULL;
    END;
    ALTER PUBLICATION supabase_realtime ADD TABLE
      public.battles, public.direct_messages, public.kudos, public.profiles;
  END IF;
END $$;
SQL
echo "  ✅ Realtime publication wired"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# Step 3: set OPENROUTER_API_KEY on destination
# ──────────────────────────────────────────────────────────────────────────
echo "▶ Step 3/4 — Setting OPENROUTER_API_KEY on destination project"
supabase secrets set OPENROUTER_API_KEY="${OPENROUTER_API_KEY}" \
  --project-ref "${DEST_REF}"
echo "  ✅ Secret set"
echo ""

# ──────────────────────────────────────────────────────────────────────────
# Step 4: deploy every edge function in supabase/functions/
# ──────────────────────────────────────────────────────────────────────────
echo "▶ Step 4/4 — Deploying edge functions"

# Auto-discover function names from supabase/functions/ (skip _shared).
mapfile -t FUNCTIONS < <(
  find "${ROOT_DIR}/supabase/functions" -mindepth 1 -maxdepth 1 -type d \
    -not -name '_*' \
    -exec basename {} \; | sort
)

echo "  Functions to deploy (${#FUNCTIONS[@]}):"
printf '    • %s\n' "${FUNCTIONS[@]}"
echo ""

supabase link --project-ref "${DEST_REF}" 2>&1 | tail -3 || true
supabase functions deploy "${FUNCTIONS[@]}" --project-ref "${DEST_REF}"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ Migration complete."
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  Manual follow-ups (NOT automated by this script):"
echo "    1. OAuth providers (Apple / Google) — re-add in destination"
echo "       Dashboard → Authentication → Providers, point Apple"
echo "       Developer Console + Google Cloud at the new redirect URL"
echo "       https://${DEST_REF}.supabase.co/auth/v1/callback"
echo ""
echo "    2. Storage files — pg_dump only moved metadata. Copy buckets:"
echo "       supabase storage cp s3://<bucket> s3://<bucket> \\"
echo "         --source-project-ref ${SOURCE_REF} \\"
echo "         --target-project-ref ${DEST_REF} --recursive"
echo ""
echo "    3. Cron jobs (pg_cron) — re-enable in Dashboard → Database →"
echo "       Extensions, then run the SQL in scripts/recreate-cron-jobs.sql"
echo ""
echo "    4. Stripe & RevenueCat webhooks — point at new project URL:"
echo "       https://${DEST_REF}.supabase.co/functions/v1/stripe-webhook"
echo "       https://${DEST_REF}.supabase.co/functions/v1/revenuecat-webhook"
echo ""
echo "    5. Vercel env vars — flip VITE_SUPABASE_URL etc. to point at"
echo "       https://${DEST_REF}.supabase.co + the new anon key, then"
echo "       Vercel → Deployments → Redeploy."
echo ""
echo "    6. Decommission Lovable — Lovable dashboard → Settings → Cloud"
echo "       → Disable Cloud. Keep paused for 30 days as rollback safety."
echo ""
echo "  Dump file kept at: ${DUMP_FILE}"
echo "  (Safe to delete after you've verified everything works.)"
