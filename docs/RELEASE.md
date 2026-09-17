# Releasing Whealth Factory

One app, one founder, one button that cannot be un-pressed. This file is what
you read before you press it.

- **App Store Connect app id** `6761115803` · **bundle id** `app.lovable.wtracker` · **team** `TY6T95YVU9`
- **Supabase project** `gcwuvijcuzhunkcauzom`
- **iOS pipeline** Xcode Cloud → TestFlight → `testflight-distribute.yml` assigns the external group

---

## 1. The gate

Nothing reaches `main` without this, as **one** command. A `;` between the
steps once let a broken build through, so it is `&&` all the way:

```bash
npx tsc -p tsconfig.app.json --noEmit && node scripts/type-debt.mjs && node scripts/style-guard.mjs && npx vitest run --coverage && npm run build
```

Then, for anything the app shell renders:

```bash
npx cap copy ios
```

What each step protects:

| Step | Protects |
|---|---|
| `tsc` | types, but **not** JSX inside ternary parens — only the build catches those |
| `type-debt.mjs` | a ratchet. Strict-error and `as any` counts may fall, never rise. A count that *collapses* (41 → 1) means the sweep crashed, not that debt vanished — treat it as a failure |
| `style-guard.mjs` | no literal brand colours. Use `hsl(var(--gold))`, never the triple |
| `vitest --coverage` | the suite plus the coverage ratchet: a new file under `src/lib/` or `src/data/` needs its test in the same change |
| `npm run build` | esbuild. The only step that catches a JSX comment inside a ternary |

**Run it with nothing else running.** Several tests do real render work and the
per-test timeout is 20 s; with a parallel build or a second agent on the same
machine they time out and the gate reports failures that pass in isolation. If
a failure says `Test timed out in 20000ms`, re-run that file alone before
believing it.

## 2. Backend

Migrations and edge functions deploy through scripts, never by hand:

```bash
npm run deploy:functions   # every edge function
npm run deploy:backend     # every edge function + supabase db push
```

Rules that came from real incidents:

- **Write the migration file, never hand-run SQL against production.** The
  schema history is the only record of why something is the way it is.
- **Dry-run first.** `scripts/audit/release-lockdown-fixture.sql` builds a stub
  schema on a local Postgres and `release-lockdown-check.sql` asserts one thing
  per change. A policy drop that also breaks the app is cheap to find there and
  expensive to find in production.
- **Quote your heredocs.** An unquoted shell heredoc turns `$$` into the shell's
  PID and silently corrupts a function body. Use `<<'EOF'` or write a `.py`.
- **Inside `SECURITY DEFINER`, `current_user` is the owner.** Read the caller
  from `auth.role()` / `auth.uid()`, never from `current_user`.
- **Supabase grants EXECUTE to `anon` and `authenticated` on every new public
  function**, and Postgres grants it to `PUBLIC`. Revoking from `anon` alone
  leaves the `PUBLIC` grant handing it straight back. Revoke from both.
- **End a migration with** `NOTIFY pgrst, 'reload schema';` or PostgREST keeps
  serving the old signature.
- Re-creating `search_foods` needs `SELECT extensions.similarity('trgm','trgm');`
  first, or it fails 42501.

After applying, verify from the catalogs (read-only) rather than trusting the
apply: policies gone, grants revoked, the predicate present, an anon probe
answering 42501.

## 3. Shipping a build

1. Gate green, `npx cap copy ios`, simulator walk (see RUNBOOK).
2. One commit per workstream, then a **single** `git push origin main`. A newer
   push cancels a running Xcode Cloud run, so batch the work.
3. `node scratchpad/xc/newest.mjs` for the new run; poll it. If 15 minutes pass
   with no run, Xcode Cloud missed the push — start one via the ASC API
   (`POST /v1/ciBuildRuns`, workflow `7B4F737C-0184-46B2-9E37-A61DA6FE7DFB`).
4. Confirm the distributor: `gh run list --workflow=testflight-distribute.yml`,
   then grep the log for `build N → external group: distributed ✅`. There are
   two same-named TestFlight groups; the external one needs explicit assignment,
   which is what that Action does.
5. Build numbers are minutes since 2026-01-01 UTC, so "newest build is the one
   with number ≥ N" is always a true statement to hand over:
   ```bash
   echo $(( ($(date -u +%s) - $(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "2026-01-01T00:00:00Z" +%s)) / 60 ))
   ```

## 4. The store page

`scripts/asc-listing.mjs` holds the App Store page as text — descriptions,
keywords, promo, categories, age-rating answers and the review notes. It prints
by default and only writes with `--apply`; `--build <n>` attaches a build to
version 1.0. Everything it touches is the unsubmitted draft.

What the API cannot do, and only the founder can:

1. A **non-admin reviewer account** with no credits (the QA account is admin and
   Premium, so a reviewer would never reach the paywall), typed into ASC.
2. A mailbox that actually receives mail at **support@whealthfactory.com**.
3. The **App Privacy** form — not exposed by the API. It must match
   `ios/App/App/PrivacyInfo.xcprivacy` plus the AI processors named in the
   privacy policy.
4. **Screenshots** (6.9" 1320×2868 or 1290×2796), and deleting the two stray
   iMessage sets.
5. Apple Developer: **Associated Domains** on the App ID (the
   `applinks:www.whealthfactory.com` entitlement is inert without it); Supabase
   Auth redirect allow-list gets `https://www.whealthfactory.com/**`; confirm
   request logging is off in the OpenRouter account.
6. Pressing **Submit**, with both subscriptions attached to the version.

## 5. Review notes, in short

The reviewer needs to know: the 14-day trial is in-app and starts at signup (the
trial pill in the header opens the paywall); subscriptions live in the "Whealth
Factory" group; HealthKit is optional and read-only unless the two writes are
opted into; model calls go to OpenAI and Google through OpenRouter and are gated
behind the AI-consent sheet (guideline 5.1.2(i)) while automated moderation is
disclosed and not switchable (guideline 1.2); report and block are on every
user-generated surface; account deletion is Profile › ⋮ › Delete account.

## 6. When something is wrong in production

**Roll back the client** by pushing a revert to `main` and shipping the next
build — there is no way to un-release a TestFlight build, only to supersede it.

**Roll back the backend** with a new forward migration. Never `db reset`, never
edit an applied migration file.

**A wrong entitlement** (someone paid and has no access, or the reverse) is
decided by `supabase/functions/_shared/rc-entitlement.ts` from the
`webhook_events` ledger. Read the member's last rows first; the decision is a
pure function and reproducible in a test before anything is written.

**Push stopped** → check `push_tokens`, then the APNs key, then
`_shared/apns.ts`. The bridge has been silently missing before; a send that
returns no error is not proof a phone buzzed.

**A cron stopped** → `select jobname, schedule from cron.job` and compare with
`scripts/recreate-cron-jobs.sql`, which is the list of what should exist.

## 7. Secrets

Stored as Supabase function secrets and GitHub Actions secrets. Rotating one is
always: create the new value at the provider → set it in both places → deploy →
verify one real call → revoke the old value.

| Secret | Used by |
|---|---|
| `OPENROUTER_API_KEY` | every model call, through `_shared/openrouter.ts` only |
| `REVENUECAT_WEBHOOK_SECRET` | `revenuecat-webhook` |
| `APNS_*` (key, key id, team id, bundle id) | `_shared/apns.ts` |
| `RESEND_API_KEY` | `waitlist-welcome` |
| `SUPABASE_SERVICE_ROLE_KEY` | every cron-only function, through `_shared/service-auth.ts` |
| `APP_ORIGIN` | `og-profile` share-card redirect |

`DEBUG_ALLOW_SANDBOX` turns every free Apple sandbox purchase into a real
entitlement. It belongs to one TestFlight session and nothing else — the deploy
script warns loudly whenever it exists at all. Unset it the moment the test ends.
