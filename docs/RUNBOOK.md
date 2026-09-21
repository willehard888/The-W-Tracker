# Runbook

What runs on its own, what to check when it doesn't, and how to look without
breaking anything. `docs/RELEASE.md` covers shipping; this is the day after.

---

## Reading production safely

Read-only SQL against the linked project:

```bash
supabase db query --linked -o json "select ..."
```

Writes go through migrations, never through this. The one exception nobody
should need: there isn't one.

**QA hygiene, non-negotiable:** test with the QA account only, change its state
only through the app, never post to a surface the founder sees, never send a
battle challenge from QA to a real member, and sign out before deleting a QA
account.

## Edge functions

29 functions. Three ways in:

- **Client-called** (a member's JWT): `ai-coach`, `coach-*`, `nutrition-scan`,
  `nutrition-lookup`, `moderate-content`, `notify-message`, `delete-account`.
- **Cron-called** (the service key, checked by `_shared/service-auth.ts`):
  `sync-streaks`, `coach-insights`, `coach-proactive`, `weekly-briefing-generate`,
  `winback-lapsed`, `tribe-nudges`, `founder-digest`, `tribe-notify`,
  `notify-social`, `notify-referral`, `waitlist-welcome`.
- **Public** (`verify_jwt = false`, guarded by their own secret or by being
  read-only): `revenuecat-webhook`, `og-image`, `og-profile`.

Every model call goes through `_shared/openrouter.ts` and nothing else — a test
fails if `openrouter.ai` appears anywhere else under `supabase/functions`. That
is where consent, `data_collection: "deny"` and the request timeout live.

## Scheduled jobs

```sql
select jobname, schedule from cron.job order by jobname;
```

| Job | When (UTC) | Does |
|---|---|---|
| `moderation-sweeper` | every 5 min | approves posts stuck pending |
| `resolve-battles` | every 15 min | settles finished 1v1 battles |
| `tribe-battles-resolve` | every 30 min | settles tribe battles |
| `coach-proactive-hourly` | hourly | trigger-ladder outreach |
| `tribe-nudges-hourly` | :05 hourly | event reminders, fire-at-risk nudge |
| `sync-streaks` | 03:00 | streak decay, honouring shields |
| `coach-insights-nightly` | 03:15 | nightly Whealth Index synthesis |
| `tribe-fire-refresh` | 03:20 | tribe fire tiers |
| `analytics-retention` | 04:30 | deletes analytics_events older than 180 d |
| `meal-scan-cache-retention` | 04:40 | deletes meal_scan_cache older than 30 d |
| `archives-retention` | 04:50 | deletes deleted_account_archives older than 30 d |
| `winback-lapsed` | 16:00 | 3/7/14-day win-back pushes |
| `weekly-briefing-generate` | Mon 06:00 | Sunday Briefing |
| `founder-digest-weekly` | Mon 06:00 | the founder's digest |
| `tribe-challenges-close` | Mon 00:10 | closes weekly tribe challenges |

`scripts/recreate-cron-jobs.sql` recreates them. A job that vanished silently is
the failure mode to watch for: nothing pages when a cron stops, so the digest is
the early-warning system.

## The money path

RevenueCat → `revenuecat-webhook` → the `webhook_events` ledger → `profiles`.

The decision is a pure function in `_shared/rc-entitlement.ts`
(`activeProducts`, `decideEntitlement`, `planTransfer`) with the event sequences
under test. Three things it exists to get right, each of which was wrong before:

- `TRANSFER` carries no `app_user_id`, so it is handled before that check. The
  account the subscription left loses its flags; the destination gains them only
  if the source really held something live.
- A refund (`CANCELLATION` with `cancel_reason: CUSTOMER_SUPPORT`) revokes
  immediately, not at some later expiry Apple never promised to send.
- A revoke applies only when no other product is still unexpired. One member
  holding two subscriptions must not lose access when the first one expires.

To debug an entitlement: read that member's last ledger rows, replay them
through `decideEntitlement` in a test, and only then touch anything.

## Push

`_shared/apns.ts` is the only sender, and it records every send. If a member says
push is broken: do they have a row in `push_tokens`; did `push_sent` get written;
did `notification_prefs` mute that kind. A send that returns 200 is the phone's
problem; a send that never happened is ours.

## The simulator

```bash
npm run ios:copy
```

then build `ios/App/App.xcworkspace`, scheme `App`, on an iPhone simulator, and
walk the app. Coordinates are device points (402×874), roughly screenshot px ÷
2.245. Two things the browser preview cannot tell you: real proportion (402 pt
is not 800 px) and touch behaviour (`<Reveal>` is disabled on `pointer: coarse`,
hover states stick in the browser and do not exist on a phone).

Always check: the offline banner with the network off, resume after backgrounding,
a check-in queued offline and flushed, the AI consent sheet both ways, the
paywall's pending and error states, report and block on every surface.

## Known flakes

The vitest suite renders real component trees and several tests sit near the
20 s per-test timeout. Under parallel load — another build, another agent on the
same machine — `TribeManageDialog`, `AthleteProfileOnboarding`, `NutritionDiary`,
`Exercises` and `Recipes` time out and pass in isolation. A failure whose message
is `Test timed out in 20000ms` is a load artefact until proven otherwise; re-run
the file on its own before believing it. A real failure names an assertion.

## Things that are deliberate, not bugs

- **W-Index 64 on one screen and 66 on another**, and rank `#3/6` vs `#5/5`:
  different universes on purpose. Label them; do not unify them.
- **`isUsernameAllowed("scunthorpe_fc")` is false.** The deny-list matches
  substrings. Documented in its test as a known cost.
- **The Vault's content is generated**, not hand-written SQL:
  `scripts/vault-content.mjs` replays `base.json` plus the `/vault/` migrations
  in a fixed shape. Hand-written SQL in a vault migration is ignored.
