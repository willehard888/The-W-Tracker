---
name: Membership
description: €4.99/mo hard entry paywall for the entire app with 7-day trial. Elite is an EARNED status tier, not bought.
type: feature
---
# Membership Model

The app requires a paid membership to use AT ALL. There is no "free tier" beyond the 7-day trial.

## Pricing & Trial
- **€4.99/mo** subscription (RevenueCat product `elitemonthly499`, Stripe fallback for web)
- **7-day free trial** auto-starts on signup (`profiles.trial_started_at = now()`)
- DB function `has_active_access(user_id)` returns true if `is_elite = true` OR `trial_started_at > now() - interval '7 days'`
- After trial: `AccessGate` hard-redirects every route except `/paywall`, `/auth`, `/landing`, `/privacy`, `/terms`, `/reset-password`, `/onboarding`, `/apple-username`, `/ios-debug`, `/apple-auth-launch`, `/u/*` (public profile), and `/oauth*` callbacks

## What Membership Unlocks (all paid features)
- Daily check-ins, XP, levels, streaks
- Global leaderboard + monthly seasons
- 1v1 battles
- AI Coach (formerly Elite-only, now member-only)
- Reading the Elite Feed
- Ability to *compete for* the earned Elite tier

## What Elite Tier Means (NOT tied to subscription)
- `status_tier = 'elite'` is awarded by `update_status_tier()` based on:
  - Top 5% rank percentile AND
  - 14 active days in last 30 days AND
  - 30+ day current streak
- Elite tier unlocks: posting in Elite Feed (RLS on `feed_posts` checks `status_tier IN ('elite','apex','legend')`), Elite badges, profile glow
- `is_elite` boolean = subscription flag only (member status). Reading Elite Feed and using AI Coach require `is_elite OR active trial`, not the earned tier.

## Paywall page (`src/pages/Paywall.tsx`)
- Hero: "Become a Member" / "€4.99/mo + 7-day trial"
- Lists member features (not "Elite perks")
- If already member: shows "Membership Active" with link to Profile / Road to Elite (no "Elite unlocked" celebration)

## Sync
- RevenueCat webhook handles INITIAL_PURCHASE, RENEWAL, EXPIRATION → toggles `is_elite`
- `set_elite_status()` RPC + `check-subscription` Edge Function for Stripe path
