# Database migrations — workflow

The remote migration history was **baselined** on 2026-08-03: for a long time the schema was applied
by hand in the Supabase SQL editor, so the remote `supabase_migrations` history was empty even though
the migration files existed. All 129 existing migrations were marked **applied** with
`supabase migration repair --status applied <version…>` (metadata only — it never touches the schema),
and the one confirmed drift (`handle_new_user`'s friendly-username fix, applied via the editor) was
captured in `20260725140000_capture_handle_new_user_friendly_username.sql`. `supabase migration list`
now shows local == remote with **0 unsynced** migrations.

## Making a schema change from now on

**Preferred — tracked migration:**
```bash
supabase migration new <descriptive_name>      # creates supabase/migrations/<ts>_<name>.sql
# …write the SQL…
supabase db push                               # applies ONLY new migrations to the linked project
```
Because the history is baselined, `db push` applies just the new file — it will **not** replay the
129 existing migrations.

**If you must apply via the SQL editor** (hotfix), record it afterwards so the history stays honest:
```bash
# 1. commit the same SQL as supabase/migrations/<ts>_<name>.sql
# 2. mark it applied (it's already live):
supabase migration repair --status applied <ts>
```

## Read-only prod SQL (safe, no secret handling)
```bash
supabase db query --linked "select …"          # runs via the Management API; keeps auth internal
```

## One open item (needs Docker)
A full `supabase db pull` (requires Docker for the shadow DB) should be run once to capture any
remaining drift from early hand-run SQL (e.g. growth RPCs) into a migration. Docker was unavailable at
baseline time, so only the confirmed `handle_new_user` drift was captured. Everything since is tracked.
