# Sandbox purchase testing

How a subscription purchase is proven end to end without spending money, and what
was learned setting it up (2026-09-15).

## What has to be true first

- **App Store Connect**: both sold subscriptions (`WhealthFactory499` monthly,
  `eliteyearly4799` yearly) must be `READY_TO_SUBMIT`. A product in `MISSING_METADATA`
  (no review screenshot) never loads in the sandbox. Check and fix with
  `node scripts/asc-subscriptions.mjs [--apply --screenshot <png>]`.
- **Prices**: one base price in Finland, Apple's equalization everywhere else.
  `node scripts/asc-subscription-prices.mjs [--apply]` reads the FIN point and sets the
  equalized point in the other 174 territories. The 2026-09-01 reprice had reached only FIN.
- **RevenueCat**: offering `default` with `$rc_monthly → WhealthFactory499` and
  `$rc_annual → eliteyearly4799`, entitlement `The W Tracker Pro`.
- **Webhook**: `revenuecat-webhook` accepts a `SANDBOX` event only when the `app_user_id`
  holds the `admin` role in `user_roles` (or `DEBUG_ALLOW_SANDBOX=true` is set). Everyone
  else's sandbox events are acknowledged and dropped. The QA account (`@mogger888`) is an
  admin. The ledger row carries `props.environment`, so `admin_metrics_overview()` counts
  money only.

Both ASC scripts take `--key <p8> --key-id <id> --issuer <uuid>` or the
`ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY` env vars, and are read-only without `--apply`.

## Where it runs

- **iPhone + TestFlight (works)**: a TestFlight build purchases in the sandbox with the
  device's own App Store account. No sandbox tester needed.
- **iOS Simulator (does not work on iOS 26)**: the purchase sheet asks for a sandbox
  tester, accepts the password, then StoreKit reports the purchase as cancelled and the
  account never persists under Settings → Developer → Sandbox Apple Account. Four attempts,
  four `purchase_cancelled` rows. Product prices do load in the simulator (no account
  needed), which is enough to prove the ASC state.

## The walk (QA account, ~3 minutes)

1. Profile → ⋮ → Open Settings → Founder → **Paywall test mode**. The offer screen opens
   even though the account has access (the harness only ever closes the gate). "Exit test
   mode" on the paywall releases it.
2. Prices should read the store's price for the device's region (8,99 € / 89,99 € in
   Finland). If they read the hard-coded fallback and the CTA says "Store not ready", read
   `/ios-debug`'s RevenueCat block.
3. **Cancel**: Unlock → Apple sheet → Cancel → back to the offer, one `purchase_cancelled`.
4. **Monthly**: Unlock → Subscribe → "Confirming access…" → Home. Expect: one
   `webhook_events` row for the user, `profiles.is_premium = true`, one
   `purchase_completed` with `props.environment = 'SANDBOX'` from the webhook and one with
   `props.sandbox = true` from the client.
5. **Renewals**: sandbox renews a month every 5 minutes; `RENEWAL` webhooks arrive,
   `is_premium` stays true.
6. **Yearly**: from the forced paywall, Subscribe again. Apple allows both to run because
   the two products sit in different subscription groups (see below).
7. **Restore**: Paywall → Restore → `purchase_restored`.
8. **Expiry**: after the sixth renewal (~35 min for monthly) `EXPIRATION` sets
   `is_premium / is_elite = false`. The QA account keeps access through its credits.

Read-only checks (aggregates, never per-user rows in a shared log):

```sql
select event, count(*), max(created_at) from analytics_events
 where user_id = '<qa user id>' and created_at > now() - interval '1 hour' group by 1;
select count(*) from webhook_events where app_user_id = '<qa user id>' and source = 'revenuecat';
select is_premium, is_elite from profiles where user_id = '<qa user id>';
```

## The yearly plan and its group (fixed 2026-09-15)

`eliteyearly4799` was created in the "Elite Monthly" group while the monthly lives in
"Whealth Factory", so Apple treated them as unrelated products: no upgrade/downgrade, and a
customer could hold both. Products cannot move between groups, so
`scripts/asc-create-yearly.mjs` created **`WhealthFactoryYearly`** inside the Whealth Factory
group (level 1, next to the monthly) with the en-US localization, 89,99 € in Finland plus
Apple's equalization everywhere, availability in every territory and the review screenshot.
Apple rejects `preserveCurrentPrice`/`startDate` on a subscription's first price
(409 "problem with the pricing information"); the bare relationship is the starting price.

The product ids live in ONE list, `supabase/functions/_shared/products.ts`, mirrored by
`src/lib/products.ts` (parity test): monthly `WhealthFactory499`, yearly
`WhealthFactoryYearly`, legacy `eliteyearly4799` kept only so an existing subscription keeps
its access.

**RevenueCat (dashboard, founder):** Products → add `WhealthFactoryYearly` (or let the ASC
import find it) → attach it to the entitlement "The W Tracker Pro" → Offerings → `default` →
package `$rc_annual` → product `WhealthFactoryYearly`. Until this is done the paywall's yearly
row still sells the old product.
