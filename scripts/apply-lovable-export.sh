#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# apply-lovable-export.sh
#
# Applies the dump files Lovable generated (when they could not give us
# direct postgres credentials) against our destination Supabase project.
#
# Lovable delivered five files via the in-app chat — download them to
# migration/lovable-export/ before running this script:
#
#   migration/lovable-export/
#     ├── lovable-public-schema-data-pgdump.sql         (PUBLIC schema + data)
#     ├── lovable-auth-users-identities-inserts.sql      (auth.users with bcrypt + auth.identities)
#     ├── lovable-schema-ddl-approx.sql                  (table DDL from information_schema — fallback only)
#     ├── lovable-cloud-migration-export.sql             (combined umbrella file)
#     └── lovable-cloud-migration-summary.md             (row counts + blocker proof)
#
# Order of operations (matters):
#   1. Enable extensions on dest (pg_cron, pg_net, pgcrypto, uuid-ossp)
#   2. Apply the public-schema pgdump → creates tables + inserts rows
#   3. Apply the auth users + identities inserts → preserves password hashes
#      and the Apple Sign In identity mapping
#   4. Apply storage policies (scripts/recreate-storage-policies.sql)
#   5. Apply pg_cron jobs (scripts/recreate-cron-jobs.sql)
#   6. Rewire realtime publication
#
# Usage:
#   export DEST_REF=gcwuvijcuzhunkcauzom
#   export DEST_DB_PW='your-dest-db-password'
#   export DEST_REGION='eu-west-1'
#   bash scripts/apply-lovable-export.sh
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${DEST_REF:?DEST_REF is required — your own Supabase project ref}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="${ROOT_DIR}/migration/lovable-export"

# Two ways to configure the destination Postgres URL:
#   a) Pass the whole thing via DEST_URL (preferred — works regardless of
#      which pooler host/port your project lives on)
#   b) Pass DEST_DB_PW + DEST_REGION and we'll construct it. The pooler
#      prefix varies by region — newer eu-west-1 projects use `aws-1-` not
#      `aws-0-`. If construction fails, paste the URL from
#      Supabase → Connect → Session pooler into DEST_URL directly.
if [ -z "${DEST_URL:-}" ]; then
  : "${DEST_DB_PW:?DEST_DB_PW is required when DEST_URL is unset}"
  : "${DEST_REGION:?DEST_REGION is required when DEST_URL is unset}"
  : "${DEST_POOLER_PREFIX:=aws-1}"   # eu-west-1 today uses aws-1; older projects use aws-0
  DEST_URL="postgresql://postgres.${DEST_REF}:${DEST_DB_PW}@${DEST_POOLER_PREFIX}-${DEST_REGION}.pooler.supabase.com:5432/postgres"
fi

# Files Lovable's chat agent generated
PGDUMP_FILE="${EXPORT_DIR}/lovable-public-schema-data-pgdump.sql"
AUTH_FILE="${EXPORT_DIR}/lovable-auth-users-identities-inserts.sql"
DDL_FILE="${EXPORT_DIR}/lovable-schema-ddl-approx.sql"

# ── Pre-flight checks ─────────────────────────────────────────────────────
missing=0
for f in "$PGDUMP_FILE" "$AUTH_FILE"; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing: ${f}"
    missing=1
  fi
done
if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Download the files from Lovable's chat into:"
  echo "  ${EXPORT_DIR}/"
  echo ""
  echo "Files needed at minimum:"
  echo "  - lovable-public-schema-data-pgdump.sql"
  echo "  - lovable-auth-users-identities-inserts.sql"
  exit 1
fi

# Detect destination PostgreSQL version — abort if not 17.x
echo "▶ Verifying destination is PostgreSQL 17…"
PG_VER=$(psql -At "$DEST_URL" -c "SHOW server_version;" 2>&1 | head -1)
case "$PG_VER" in
  17.*) echo "  ✅ Destination on $PG_VER" ;;
  *)
    echo "  ❌ Destination is $PG_VER — source is PG 17.6"
    echo "     Upgrade destination at:"
    echo "     https://supabase.com/dashboard/project/${DEST_REF}/settings/infrastructure"
    exit 1
    ;;
esac
echo ""

# ── Step 1: Extensions ────────────────────────────────────────────────────
echo "▶ Step 1/5 — Enabling required extensions on destination"
psql -v ON_ERROR_STOP=1 "$DEST_URL" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL
echo "  ✅ Extensions enabled"
echo ""

# ── Step 2: Apply public-schema dump ──────────────────────────────────────
echo "▶ Step 2/5 — Restoring public schema + data from pg_dump"
echo "  File: $(basename "$PGDUMP_FILE")"
SIZE=$(wc -c < "$PGDUMP_FILE" | tr -d ' ')
echo "  Size: ${SIZE} bytes"
echo ""
echo "  WARNING: this will DROP existing public-schema objects on dest."
echo "  Press Ctrl-C in 10s to abort, otherwise migration proceeds…"
sleep 10

# psql --single-transaction wraps the whole file in BEGIN/COMMIT so any
# error rolls back. ON_ERROR_STOP=1 makes the first failure abort the
# transaction (and thus the script).
psql -v ON_ERROR_STOP=1 --single-transaction "$DEST_URL" < "$PGDUMP_FILE"
echo "  ✅ Public schema restored"
echo ""

# ── Step 3: Apply auth users + identities ─────────────────────────────────
echo "▶ Step 3/5 — Restoring auth.users + auth.identities (with bcrypt hashes)"
echo "  File: $(basename "$AUTH_FILE")"
# auth schema needs INSERTs ran outside the public restore transaction
# because RLS triggers on auth.users may reference public schema tables
# that just got created.
psql -v ON_ERROR_STOP=1 "$DEST_URL" < "$AUTH_FILE"
USER_COUNT=$(psql -At "$DEST_URL" -c "SELECT count(*) FROM auth.users;" 2>&1 | head -1)
echo "  ✅ auth.users now has ${USER_COUNT} rows"
echo ""

# ── Step 4: Storage policies + cron + realtime ────────────────────────────
echo "▶ Step 4/5 — Storage policies, cron jobs, realtime publication"
psql -v ON_ERROR_STOP=1 "$DEST_URL" \
  -f "${ROOT_DIR}/scripts/recreate-storage-policies.sql"
echo "  ✅ Storage RLS policies applied"

if [ -f "${ROOT_DIR}/scripts/recreate-cron-jobs.sql" ]; then
  psql -v ON_ERROR_STOP=1 "$DEST_URL" \
    -f "${ROOT_DIR}/scripts/recreate-cron-jobs.sql"
  echo "  ✅ pg_cron jobs scheduled"
fi

psql -v ON_ERROR_STOP=1 "$DEST_URL" <<'SQL'
DO $$
BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF FOUND THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE
        public.battles, public.direct_messages, public.kudos, public.profiles;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    ALTER PUBLICATION supabase_realtime ADD TABLE
      public.battles, public.direct_messages, public.kudos, public.profiles;
  END IF;
END $$;
SQL
echo "  ✅ Realtime publication wired (battles, direct_messages, kudos, profiles)"
echo ""

# ── Step 5: Smoke test ─────────────────────────────────────────────────────
echo "▶ Step 5/5 — Sanity counts on destination"
psql "$DEST_URL" <<'SQL'
SELECT 'auth.users'      AS what, count(*) FROM auth.users
UNION ALL SELECT 'auth.identities',     count(*) FROM auth.identities
UNION ALL SELECT 'public.profiles',     count(*) FROM public.profiles
UNION ALL SELECT 'public.badges',       count(*) FROM public.badges
UNION ALL SELECT 'public.coach_daily_briefs', count(*) FROM public.coach_daily_briefs;
SQL
echo ""

echo "✅ Lovable export applied successfully."
echo ""
echo "Next steps (NOT done by this script):"
echo "  1. bash scripts/migrate-storage.sh    (65 MB of feed-images + proof-photos)"
echo "  2. Set edge function secrets on dest (see MIGRATION_PLAYBOOK.md §3)"
echo "  3. Deploy edge functions:"
echo "       for f in supabase/functions/*/; do"
echo "         supabase functions deploy \"\$(basename \"\$f\")\" --project-ref ${DEST_REF}"
echo "       done"
echo "  4. Configure Apple Sign In provider on dest (MIGRATION_PLAYBOOK.md §6)"
echo "  5. Update .env + Vercel env vars (MIGRATION_PLAYBOOK.md §4 + §5)"
echo "  6. git commit && git push  →  Codemagic builds  →  TestFlight"
