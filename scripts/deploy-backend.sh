#!/usr/bin/env bash
# Deploy the Supabase backend (edge functions + optionally DB migrations) in
# one shot, so you never have to remember per-function commands again.
#
#   npm run deploy:functions   → deploy ALL edge functions
#   npm run deploy:backend     → deploy ALL edge functions + push migrations
#
# Migrations: `db push` applies any migration files in supabase/migrations that
# the linked project hasn't run yet. The Supabase CLI may prompt you for the
# database password — type it directly into your terminal (it's never stored
# here). Migrations only ever run once per file, so re-running is safe.

set -euo pipefail

PROJECT_REF="gcwuvijcuzhunkcauzom"
PUSH_DB="no"
[[ "${1:-}" == "--db" ]] && PUSH_DB="yes"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32m✓ %s\033[0m\n" "$1"; }

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

bold "▶ Deploying ALL edge functions to $PROJECT_REF …"
# No function slug = deploy every function under supabase/functions/.
supabase functions deploy --project-ref "$PROJECT_REF"
ok "Edge functions deployed."

if [[ "$PUSH_DB" == "yes" ]]; then
  bold "▶ Pushing database migrations (you may be asked for the DB password) …"
  supabase db push --linked
  ok "Migrations applied."
else
  printf "\033[33mℹ Skipped DB migrations. Run with --db (npm run deploy:backend) to include them.\033[0m\n"
fi

ok "Backend deploy complete."
