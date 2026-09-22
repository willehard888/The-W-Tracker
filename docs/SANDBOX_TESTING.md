# Sandbox purchase testing

How a subscription purchase is proven end to end without spending money, and what
was learned setting it up (2026-09-15).

## What has to be true first

- **App Store Connect**: both sold subscriptions (`WhealthFactory499` monthly,
  `WhealthFactoryYearly` yearly) must be `READY_TO_SUBMIT`. A product in `MISSING_METADATA`
  (no review screenshot) never loads in the sandbox. Check and fix with
  `node scripts/asc-subscriptions.mjs [--apply --screenshot <png>]`.
- **Prices**: one base price in Finland, Apple's equalization everywhere else.
  `node scripts/asc-subscription-prices.mjs [--apply]` reads the FIN point and sets the
  equalized point in the other 174 territories. The 2026-09-01 reprice had reached only FIN.
- **RevenueCat**: offering `default` with `$rc_monthly → WhealthFactory499` and
  `$rc_annual → WhealthFactoryYearly`, entitlement `The W Tracker Pro`.
- **Webhook**: `revenuecat-webhook` applies `SANDBOX` events exactly like production
  ones, for every account. App Review buys in the sandbox, so dropping them (as the
  webhook once did for non-admins) would leave a reviewer's purchase doing nothing.
  The ledger row carries `props.environment`, so `admin_metrics_overview()` and the
  founder digest count money only.

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
3. **Cancel**: Start free trial → Apple sheet → Cancel → back to the offer, one `purchase_cancelled`.
4. **Monthly**: Start free trial → Apple's sheet reads "2 weeks free, then 8,99 €" (an
   Apple ID that used the trial before sees the price alone and the CTA "Unlock full
   access") → Subscribe → "Confirming access…" → Home. Expect: one `webhook_events` row
   for the user (`INITIAL_PURCHASE`, `period_type = TRIAL`), `profiles.is_premium = true`,
   one `trial_started` from the webhook (`purchase_completed` when no trial applied) and
   one `purchase_completed` with `props.sandbox = true` from the client. In the sandbox the
   two-week trial lasts about 3 minutes.
5. **Renewals**: a sandbox tester renews a month every 5 minutes; a TestFlight purchase on
   the device's own Apple ID renewed on a ~1 day clock instead (RevenueCat: "renews in
   9 hours"). `RENEWAL` webhooks arrive as the periods end, `is_premium` stays true.
6. **Yearly**: from the forced paywall, Subscribe to the yearly. With an active monthly in
   the same group Apple treats it as a plan change that takes effect at the next renewal:
   the sheet completes, RevenueCat sends `PRODUCT_CHANGE` (the ledger records the chosen
   product), and the yearly's own `RENEWAL` arrives when the monthly period ends. Tapping the
   monthly again while it is active completes instantly with no new transaction.
7. **Restore**: Paywall → Restore → `purchase_restored`.
8. **Expiry**: after the sixth renewal `EXPIRATION` sets `is_premium / is_elite = false`
   (~35 min for a sandbox tester's monthly, days on the TestFlight clock). The QA account
   keeps access through its credits. A trial that lapses without converting arrives as
   `EXPIRATION` with `period_type = TRIAL` → `trial_expired`.

Proven 2026-09-15/16 on willehard: monthly `INITIAL_PURCHASE`, then monthly → yearly
`PRODUCT_CHANGE` to `WhealthFactoryYearly`, both `SANDBOX`, flags true. Still unobserved:
`RENEWAL`, `EXPIRATION`, restore.

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

**RevenueCat (done 2026-09-16):** product `WhealthFactoryYearly` (`prod1b5c57d5b1`) added,
attached to the entitlement "The W Tracker Pro", and offering `default` → package `$rc_annual`
now points at it. The paywall's yearly row sells the new product from the next app launch
(offerings are fetched at start; no app build needed).
