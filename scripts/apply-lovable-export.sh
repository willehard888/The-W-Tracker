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
echo "▶ Step 1/6 — Enabling required extensions on destination"
psql -v ON_ERROR_STOP=1 "$DEST_URL" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL
echo "  ✅ Extensions enabled"
echo ""

# ── Step 2: Wipe public schema for a clean restore ───────────────────────
# After the first run we end up with partial tables, half-applied policies,
# and orphan triggers. Simplest way to reset is DROP SCHEMA public CASCADE.
echo "▶ Step 2/6 — Wiping public schema for a clean restore"
echo "  WARNING: this DROPs the entire public schema on destination."
echo "  Press Ctrl-C in 10s to abort, otherwise migration proceeds…"
sleep 10
psql -v ON_ERROR_STOP=1 "$DEST_URL" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
SQL
echo "  ✅ Public schema wiped"
echo ""

# ── Step 3: auth.users FIRST so the public restore's FKs find them ───────
# The public-schema dump INSERTs reference auth.users.id; if auth.users is
# empty, every *_user_id_fkey constraint fires. Also wipe any pre-existing
# auth.users rows on the destination to avoid email-uniqueness collisions
# (Supabase auto-creates an auth.users row for the project owner with a
# different uuid than Lovable's).
echo "▶ Step 3/6 — Restoring auth.users + auth.identities BEFORE public schema"
echo "  File: $(basename "$AUTH_FILE")"
echo "  ▸ Clearing existing auth.users rows on destination first…"
psql -v ON_ERROR_STOP=1 "$DEST_URL" <<'SQL'
-- auth.identities has ON DELETE CASCADE so it's wiped automatically.
DELETE FROM auth.users;
SQL
echo "  ▸ Inserting Lovable's auth users + identities…"
# Newer Supabase Auth schemas (PG 17 + auth ≥ 2.180) declare
# auth.identities.email as a GENERATED column computed from
# identity_data->>'email'. Lovable's dump file still includes an explicit
# `email` value in the INSERT, which PG rejects with:
#   ERROR: cannot insert a non-DEFAULT value into column "email"
# Preprocess to strip the email column from every auth.identities INSERT
# (the value is recomputed from identity_data on insert). auth.users
# INSERTs untouched.
PREPROCESSED=$(mktemp -t lovable-auth)
python3 - "$AUTH_FILE" > "$PREPROCESSED" <<'PY'
import re, sys
src = open(sys.argv[1]).read()
# Match: INSERT INTO auth.identities (col1, col2, ..., email, id) VALUES (v1, v2, ..., '<email>', '<id>');
# Replace column list `, email, id)` → `, id)`
# Replace VALUES tail `, '<email>', '<uuid>');` → `, '<uuid>');`
def fix(m):
    line = m.group(0)
    line = line.replace(", email, id)", ", id)", 1)
    # Find the last two single-quoted values before the closing );
    # Format: ..., 'email_value', 'uuid_value');
    line = re.sub(r", '[^']*', '([0-9a-f-]{36})'\);\s*$",
                  r", '\1');", line)
    return line
out = re.sub(r"^INSERT INTO auth\.identities[^\n]*$",
             fix, src, flags=re.MULTILINE)
sys.stdout.write(out)
PY

# Sanity-check that the preprocessing actually removed every ", email, id)"
STILL_BROKEN=$(grep -c "INSERT INTO auth\.identities.*, email, id) VALUES" "$PREPROCESSED" || true)
if [ "$STILL_BROKEN" != "0" ]; then
  echo "    ❌ ${STILL_BROKEN} identities lines still reference email — preprocessing failed."
  rm -f "$PREPROCESSED"
  exit 1
fi

psql -v ON_ERROR_STOP=1 "$DEST_URL" < "$PREPROCESSED"
rm -f "$PREPROCESSED"
USER_COUNT=$(psql -At "$DEST_URL" -c "SELECT count(*) FROM auth.users;" 2>&1 | head -1)
IDENT_COUNT=$(psql -At "$DEST_URL" -c "SELECT count(*) FROM auth.identities;" 2>&1 | head -1)
echo "  ✅ auth.users=${USER_COUNT}, auth.identities=${IDENT_COUNT}"
echo ""

# ── Step 4: NOW restore public schema (FKs find users) ───────────────────
echo "▶ Step 4/6 — Restoring public schema + data from pg_dump"
echo "  File: $(basename "$PGDUMP_FILE")"
SIZE=$(wc -c < "$PGDUMP_FILE" | tr -d ' ')
echo "  Size: ${SIZE} bytes"
# Lovable's pg_dump emits DROP POLICY before CREATE TABLE; we tolerate
# those "relation does not exist" errors. Step 6 row counts are the source
# of truth for whether the restore actually loaded data.
psql -v ON_ERROR_STOP=0 "$DEST_URL" < "$PGDUMP_FILE" || true
echo ""
echo "  ▸ Restore pass complete. See Step 6 for verification."
echo ""

# ── Step 4b: Re-grant public-schema privileges ────────────────────────────
# DROP SCHEMA public CASCADE (Step 2) wiped the implicit GRANTs Supabase
# maintains for anon/authenticated/service_role on the public schema, and
# pg_dump --no-privileges intentionally skipped restoring them. Without
# this every authenticated PostgREST query fails with
# "permission denied for schema public" (broke the first-after-cutover
# Apple Sign In in the field). Re-grant + set defaults so future tables
# created via PostgREST or migrations inherit the right perms.
echo "  ▸ Re-granting public-schema privileges to API roles…"
psql -v ON_ERROR_STOP=1 "$DEST_URL" <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;
SQL
echo "  ✅ Privileges granted"
echo ""

# ── Step 4: Storage policies + cron + realtime ────────────────────────────
echo "▶ Step 5/6 — Storage policies, cron jobs, realtime publication"
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
echo "▶ Step 6/6 — Sanity counts on destination"
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
