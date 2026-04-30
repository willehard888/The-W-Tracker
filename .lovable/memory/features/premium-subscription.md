---
name: Premium subscription & The Vault
description: €17.99/mo Premium tier replaces Apex purchase, unlocks The Vault content hub. Apex remains earnable (top 10%) but not buyable.
type: feature
---
**Premium tier (€17.99/mo or €172.99/yr)**
- Replaces purchasable Apex; product IDs `premiummonthly1799` / `premiumyearly17299` in App Store Connect.
- Falls back to legacy Apex IDs (`Apex888`, `apexyearly17299`) at the same price during rollout.
- RevenueCat entitlement: `premium`. Webhook + check-subscription set `is_premium=true` on any active sub (premium or legacy apex).
- DB: `profiles.is_premium`, RPC `has_premium(uuid)`, `set_elite_status` mirrors flag server-side.

**The Vault (`/vault`)**
- Premium-gated content hub. 5 categories (all "Coming Soon"): Recipes, Workouts, Recovery, Mind & Mood (EFT/EMDR/somatic), Nervous System Reset (hypnosis).
- Non-premium → redirected to `/paywall`. Lazy-loaded via ModalStack + preloaded as priority route.

**Paywall single-screen IAP flow**
- Single `PremiumHero` card (replaces dual Member/Apex UI).
- State machine: `idle | purchasing | verifying | error`. Polls `checkSubscription` for up to 8s after IAP, then redirects to `/vault`.
- Inline error banner with Try-again/Dismiss — never modal stacking.
- Apex still shown as "earned only" disclaimer at bottom.
