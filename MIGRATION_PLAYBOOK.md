# Migration Playbook — Lovable → own Supabase

Source:  `zjdljojkgrpgxurugixf` (Lovable's org, no direct access)
Dest:    `gcwuvijcuzhunkcauzom` (own org, "The real W group", eu-west-1)

## 0. Prerequisites checklist

Wait until Lovable provides:
- [ ] `SOURCE_DB_PW` — Lovable's project DB password (from Lovable Cloud → Database → Reset password, OR from the inventory Lovable dumps to `/mnt/documents/migration-inventory.md`)
- [ ] `SOURCE_REGION` — region of Lovable's project (likely `eu-central-1` or `eu-west-1`)
- [ ] Storage object dump / signed bulk-download URLs (proof photos, feed media, avatars)

From own Supabase project:
- [ ] `DEST_DB_PW` — from https://supabase.com/dashboard/project/gcwuvijcuzhunkcauzom/settings/database → Reset DB Password
- [ ] `DEST_REGION` = `eu-west-1` (Ireland)
- [ ] **VITE_SUPABASE_PUBLISHABLE_KEY** (new anon key) — from Settings → API Keys

Local:
- [ ] `OPENROUTER_API_KEY` set (already in env)
- [ ] `supabase` CLI installed + logged in via `supabase login`
- [ ] `pg_dump` available on PATH (`brew install postgresql@15`)

## 1. Run the data migration (10 min)

```bash
cd /Users/rasmuspetterson/The-W-Tracker

export SOURCE_REF=zjdljojkgrpgxurugixf
export SOURCE_DB_PW='paste-from-lovable'
export SOURCE_REGION='eu-central-1'   # or whatever Lovable confirmed
export DEST_REF=gcwuvijcuzhunkcauzom
export DEST_DB_PW='paste-from-own-supabase'
export DEST_REGION='eu-west-1'
export OPENROUTER_API_KEY='sk-or-v1-...'  # already set in env

bash scripts/migrate-from-lovable.sh
```

This pg_dumps source → restores to dest → deploys all 24 edge functions → sets OpenRouter key.

## 2. Update `.env` (1 min)

```bash
# Edit .env — replace zjdljojkgrpgxurugixf with gcwuvijcuzhunkcauzom
# AND replace the PUBLISHABLE_KEY value with the new one from own project's Settings → API

# OR use sed:
NEW_REF=gcwuvijcuzhunkcauzom
NEW_KEY='eyJ...new-anon-key...'
sed -i.bak \
  -e "s|zjdljojkgrpgxurugixf|${NEW_REF}|g" \
  -e "s|VITE_SUPABASE_PUBLISHABLE_KEY=\".*\"|VITE_SUPABASE_PUBLISHABLE_KEY=\"${NEW_KEY}\"|g" \
  -e "s|SUPABASE_PUBLISHABLE_KEY=\".*\"|SUPABASE_PUBLISHABLE_KEY=\"${NEW_KEY}\"|g" \
  .env
rm .env.bak
```

Verify:
```bash
grep -E "SUPABASE_URL|PROJECT_ID|PUBLISHABLE_KEY" .env
# All should reference gcwuvijcuzhunkcauzom and use the new anon key.
```

## 3. Update Vercel env vars (2 min)

https://vercel.com/dashboard → W Tracker project → Settings → Environment Variables

For both **Preview** and **Production**:
- `VITE_SUPABASE_URL` = `https://gcwuvijcuzhunkcauzom.supabase.co`
- `VITE_SUPABASE_PROJECT_ID` = `gcwuvijcuzhunkcauzom`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (new anon key)

Trigger redeploy: Deployments → … on latest → Redeploy.

## 4. Configure Apple Sign In on the new project (2 min)

https://supabase.com/dashboard/project/gcwuvijcuzhunkcauzom/auth/providers

→ Apple → Enable:
- Client IDs: `app.lovable.wtracker`
- Secret Key: regenerate via
  ```bash
  node scripts/generate-apple-client-secret.cjs \
    --key-file=/Users/rasmuspetterson/Downloads/AuthKey_6L5NPVL699.p8 \
    --team-id=TY6T95YVU9 \
    --key-id=6L5NPVL699 \
    --client-id=app.lovable.wtracker | pbcopy
  ```
- Save

## 5. Recreate cron jobs (2 min)

```bash
psql "$DEST_URL" -f scripts/recreate-cron-jobs.sql
```

## 6. Commit + push (2 min)

```bash
git add .env
git commit -m "chore(supabase): point .env at gcwuvijcuzhunkcauzom after Lovable migration"
git push origin main
```

Codemagic auto-triggers → new TestFlight build with the new backend.

## 7. Smoke test (5 min)

After Codemagic build lands in TestFlight:
- [ ] Install new build
- [ ] Apple Sign In works → reaches Home
- [ ] Existing email account `rasmus.willehard@gmail.com` can log in (password hash carried over)
- [ ] Profile shows correct streak / tier / posts
- [ ] Tribes tab loads (was 404 before, now wired)
- [ ] Leaderboard loads with users
- [ ] Submit a check-in → succeeds
- [ ] Coach card on home shows brief

Anything broken → check Supabase Dashboard → Logs to see why.

## 8. After 7 days

When confident the destination is the source of truth, ask Lovable to delete `zjdljojkgrpgxurugixf` permanently.

## Rollback (in case migration breaks something)

The original Lovable project is untouched by the migration (we only pg_dump from it, never write). To roll back:
1. Revert `.env`: `git checkout HEAD~1 .env`
2. Revert Vercel env vars to old project ref
3. Commit + push → TestFlight build reverts to Lovable backend
4. Investigate the dest project's issue, retry.
