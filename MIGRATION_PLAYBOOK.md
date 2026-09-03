# Migration Playbook — Lovable → own Supabase

> **Historical record.** The migration COMPLETED in August 2026; the app now
> runs entirely on the destination project below. The one-shot
> `scripts/migrate-from-lovable.sh` referenced in this document was removed
> once the cutover finished. Kept because it documents where every piece of
> prod state came from.

Verified values from Lovable's one-shot inventory reply (May 19, 2026):

| Field | Source (Lovable) | Destination (own) |
|---|---|---|
| Project ref | `zjdljojkgrpgxurugixf` | `gcwuvijcuzhunkcauzom` |
| Region | `eu-central-1` (Lovable's default — verify in Database panel) | `eu-west-1` (Ireland) |
| Org | Lovable's master org (no access) | "The real W group" |
| PostgreSQL | 17.6 — **destination must also be PG 17** | confirm in dashboard |
| Storage | 65 MB across 19 objects in 2 public buckets | empty |
| Realtime tables | battles, direct_messages, kudos, profiles | recreated by script |
| Extensions | pg_cron, pg_net, pgcrypto, uuid-ossp | created by script before restore |

## 0. Prerequisites checklist

From Lovable Cloud:
- [ ] **`SOURCE_DB_PW`** — click-path:
      `Lovable editor → top nav → Cloud → Database → "Reset database password" → copy immediately`
- [ ] **`SOURCE_REGION`** — visible on same Database page next to the connection string (likely `eu-central-1`)

From own Supabase project:
- [ ] **`DEST_DB_PW`** — https://supabase.com/dashboard/project/gcwuvijcuzhunkcauzom/settings/database → "Reset database password"
- [ ] **`DEST_SERVICE_KEY`** — https://supabase.com/dashboard/project/gcwuvijcuzhunkcauzom/settings/api-keys → `service_role` (NOT `anon`)
- [ ] **`SOURCE_ANON_KEY`** — already in repo's `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] **`VITE_SUPABASE_PUBLISHABLE_KEY`** (new dest anon key) — same dashboard, `anon` key
- [ ] **Verify destination is on PG 17** — Dashboard → Database → Infrastructure. If on 15, click "Upgrade" first. **DO NOT START THE MIGRATION ON PG 15.**

Local:
- [x] `OPENROUTER_API_KEY` set (already in `.env`)
- [ ] `pg_dump` 17.x available (`brew install postgresql@17`)
- [ ] `supabase` CLI logged in (`supabase login` if not)

## 1. Run the data migration (10 min)

```bash
cd /Users/rasmuspetterson/The-W-Tracker

# from Lovable Cloud → Database → Reset
export SOURCE_REF=zjdljojkgrpgxurugixf
export SOURCE_DB_PW='paste-from-lovable'
export SOURCE_REGION='eu-central-1'              # confirm against Lovable's UI

# from own Supabase
export DEST_REF=gcwuvijcuzhunkcauzom
export DEST_DB_PW='paste-from-own-supabase'
export DEST_REGION='eu-west-1'

# already known
export OPENROUTER_API_KEY=$(grep '^OPENROUTER_API_KEY' .env 2>/dev/null | cut -d= -f2- | tr -d '"' )

bash scripts/migrate-from-lovable.sh
```

What this does (now updated with Lovable's inventory):
1. pg_dump `public + auth + storage` schemas from source
2. **Create `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp` extensions on dest**
3. psql restore the dump into destination (single transaction; rolls back if any step fails)
4. Run `scripts/recreate-storage-policies.sql` (bucket policies)
5. Run `scripts/recreate-cron-jobs.sql` (pg_cron schedules)
6. Re-add the four realtime publication tables
7. Set `OPENROUTER_API_KEY` on destination
8. Deploy all 25 edge functions to destination via `supabase functions deploy`

## 2. Migrate storage objects (2 min — 65 MB)

```bash
export SOURCE_REF=zjdljojkgrpgxurugixf
export SOURCE_ANON_KEY=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY' .env | cut -d= -f2- | tr -d '"')
export DEST_REF=gcwuvijcuzhunkcauzom
export DEST_SERVICE_KEY='paste-service-role-from-own-supabase'

bash scripts/migrate-storage.sh
```

Downloads all 19 objects from source's two public buckets and re-uploads them
into the destination's buckets. Re-runnable: existing local files are reused;
existing destination objects are overwritten via `x-upsert: true`.

## 3. Set remaining edge function secrets (2 min)

Edge functions need secrets set on the destination so they actually work.
`OPENROUTER_API_KEY` is set by the migration script (step 1); the rest are
manual because only you know the values.

```bash
# Replace each <value> with the actual value you already have stored
# (RevenueCat, Stripe, APNs values are in your password manager / Codemagic env)
supabase secrets set --project-ref gcwuvijcuzhunkcauzom \
  APNS_AUTH_KEY="<value>" \
  APNS_BUNDLE_ID="app.lovable.wtracker" \
  APNS_KEY_ID="<value>" \
  APNS_TEAM_ID="TY6T95YVU9" \
  REVENUECAT_API_KEY="<value>" \
  REVENUECAT_WEBHOOK_SECRET="<value>" \
  STRIPE_SECRET_KEY="<value>" \
  STRIPE_WEBHOOK_SECRET="<value>"
```

(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
are auto-injected by Supabase — do NOT set them manually.)

## 4. Update `.env` (1 min)

```bash
NEW_REF=gcwuvijcuzhunkcauzom
NEW_KEY='eyJ...new-anon-key-from-dest-dashboard...'
sed -i.bak \
  -e "s|zjdljojkgrpgxurugixf|${NEW_REF}|g" \
  -e "s|VITE_SUPABASE_PUBLISHABLE_KEY=\".*\"|VITE_SUPABASE_PUBLISHABLE_KEY=\"${NEW_KEY}\"|g" \
  -e "s|SUPABASE_PUBLISHABLE_KEY=\".*\"|SUPABASE_PUBLISHABLE_KEY=\"${NEW_KEY}\"|g" \
  .env
rm .env.bak
grep -E "SUPABASE_URL|PROJECT_ID|PUBLISHABLE_KEY" .env  # verify
```

## 5. Update Vercel env vars (2 min)

https://vercel.com/dashboard → W Tracker project → Settings → Environment Variables

For both **Preview** and **Production**:
- `VITE_SUPABASE_URL` = `https://gcwuvijcuzhunkcauzom.supabase.co`
- `VITE_SUPABASE_PROJECT_ID` = `gcwuvijcuzhunkcauzom`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (new anon key)

Trigger redeploy: Deployments → … on latest → Redeploy.

## 6. Configure Apple Sign In on the new project (2 min)

```bash
node scripts/generate-apple-client-secret.cjs \
  --key-file=/Users/rasmuspetterson/Downloads/AuthKey_6L5NPVL699.p8 \
  --team-id=TY6T95YVU9 \
  --key-id=6L5NPVL699 \
  --client-id=app.lovable.wtracker | pbcopy
```

Then https://supabase.com/dashboard/project/gcwuvijcuzhunkcauzom/auth/providers
→ Apple → Enable:
- Client IDs: `app.lovable.wtracker`
- Secret Key: Cmd+V (paste JWT)
- Save

Apple Developer Console → your Services ID → Sign in with Apple → add this
new callback URL:
```
https://gcwuvijcuzhunkcauzom.supabase.co/auth/v1/callback
```

## 7. Commit + push (2 min)

```bash
git add .env
git commit -m "chore(supabase): point at gcwuvijcuzhunkcauzom after Lovable cutover"
git push origin main
```

Codemagic auto-triggers → new TestFlight build with the new backend.

## 8. Smoke test (5 min)

After Codemagic build lands in TestFlight:
- [ ] Install new build (build ~785)
- [ ] **Apple Sign In** works → reaches Home
- [ ] Existing email account `rasmus.willehard@gmail.com` can log in (password hash carried over via auth schema dump)
- [ ] Profile shows correct streak / tier / posts
- [ ] **Feed images** load (storage objects migrated)
- [ ] **Tribes** tab loads (route added earlier)
- [ ] Leaderboard loads with users
- [ ] Submit a check-in → succeeds + proof photo uploads
- [ ] Coach card on home shows brief (edge function works → OPENROUTER_API_KEY set)
- [ ] Subscribe via RevenueCat → succeeds (`REVENUECAT_*` secrets set)
- [ ] Realtime: send a kudos → recipient sees it live (publication wired)

Anything broken → check Supabase Dashboard → Logs → Postgres / Edge functions.

## 9. After 7 days

When confident the destination is the source of truth, email
`support@lovable.dev`:

> Subject: Please delete project `zjdljojkgrpgxurugixf`
>
> Migration verified, my data is fully on `gcwuvijcuzhunkcauzom`.
> Please permanently delete `zjdljojkgrpgxurugixf` to stop the dormant
> instance.

(Lovable's build agent confirmed deletion scheduling is staff-only.)

## Rollback (in case migration breaks something)

The source Lovable project is **untouched by the migration** — we only
pg_dump from it, never write. To roll back:

1. Revert `.env`: `git checkout HEAD~1 .env`
2. Revert Vercel env vars to old project ref
3. Commit + push → TestFlight build reverts to Lovable backend
4. Investigate the destination's issue; retry.

## Known gotchas (from Lovable's reply)

- **PG version mismatch**: Source is PG 17. If destination is on PG 15,
  the dump restore will partially fail on PG-17-only features. Upgrade
  destination first.
- **Region mismatch**: source `eu-central-1`, destination `eu-west-1`.
  No code consequence, but latency from app → DB is slightly different
  (≤ 30 ms — irrelevant for our load).
- **OAuth provider config doesn't transfer via pg_dump** — must be
  reconfigured manually on dest (step 6).
- **Edge function logs**: existing logs stay on source, are not migrated.
  Use the new dashboard for any debugging post-cutover.
- **`LOVABLE_API_KEY`**: was auto-injected on source, doesn't exist on
  dest. Edge function code already migrated to `OPENROUTER_API_KEY` in a
  previous PR — no action needed.

## Cleanup of stale playbook entry

The playbook said "24 edge functions" — Lovable confirmed 25.
Discrepancy is now resolved: the `_shared/` directory was counted by
`ls supabase/functions/` but it's not a deployable function. Whether
`migrate-from-lovable.sh` deploys 24 or 25 depends on whether `_shared`
is in the loop's filter; the script skips dotfiles + underscores
correctly.
