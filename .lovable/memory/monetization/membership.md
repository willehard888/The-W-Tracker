---
name: Membership
description: Two paid tiers — €4.99/mo Member (with 7-day trial) and €15.99/mo Apex Instant (immediate Apex tier + Tribe creation)
type: feature
---
# Membership Model

The app has TWO paid tiers. There is no permanent free tier beyond the 7-day trial that begins on signup.

## Tier 1 — Member (€4.99/mo)
- RevenueCat product `elitemonthly499`, Stripe fallback for web
- **7-day free trial** auto-starts on signup (`profiles.trial_started_at = now()`)
- DB function `has_active_access(user_id)` returns true if `is_elite = true` OR `trial_started_at > now() - interval '7 days'`
- Unlocks ALL core features: daily check-ins, XP, streaks, leaderboard, battles, AI Coach, reading the Elite Feed
- Allows COMPETING for the earned `elite`/`apex`/`legend` status tiers

## Tier 2 — Apex Instant (€15.99/mo) — bought, not earned
- RevenueCat product `apexmonthly1599`, Stripe Price `price_1TOvbkBm4ZLIG9fvoppvTJ7D`
- **No trial** — only the €4.99 tier has a trial
- Sets `profiles.is_apex_subscriber = true` AND `is_elite = true` (Apex includes Member benefits)
- `update_status_tier` function pins tier to at least `apex` while subscription is active (cannot decay below it from inactivity)
- Additional unlocks beyond Member:
  - **Tribes (communities)** — can create up to 3 tribes (also available to earned `apex`/`legend`)
  - "Founding Apex" `⚡` badge next to name (vs `🔥` for earned Apex)
  - Eligible for exclusive Apex Founder badges

## What earned Elite/Apex/Legend means
- `status_tier` is awarded by `update_status_tier()` based on rank percentile + activity + streak
- Elite tier (top 5%, 14/30 active, 30+ day streak) unlocks posting in Elite Feed
- The earned tier is preserved as a status symbol; subscribers get the same UI but with the `⚡` distinction

## Access gating
After trial expires for non-subscribers: `AccessGate` hard-redirects every route except `/paywall`, `/auth`, `/landing`, `/privacy`, `/terms`, `/reset-password`, `/onboarding`, `/apple-username`, `/ios-debug`, `/apple-auth-launch`, `/u/*` (public profile), and `/oauth*` callbacks.

## Paywall page (`src/pages/Paywall.tsx`)
- Two `PaywallTierCard` components side-by-side
- Member card: "Become a Member" / €4.99/mo + 7-day trial / "Earn Elite the right way"
- Apex card: "Skip the grind" / €15.99/mo / flame+gold accent / "Founding Apex" status
- Active subscriber sees "Membership Active" with relevant tier badge

## Sync infrastructure
- `revenuecat-webhook` handles INITIAL_PURCHASE, RENEWAL, EXPIRATION for both `pro` and `apex_subscriber` entitlements
- `check-subscription` Edge Function reads Stripe price IDs and updates `is_elite` + `is_apex_subscriber`
- `set_elite_status()` RPC for direct elite toggle (legacy/admin)
