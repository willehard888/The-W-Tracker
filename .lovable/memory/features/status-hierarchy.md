---
name: Status Hierarchy
description: 7-tier status system. Tiers 1-4 are EARNED through XP/consistency/rank. Apex can also be BOUGHT via €15.99/mo subscription which protects against decay. Legend (top 0.1%) houses the Founders Circle.
type: feature
---
# Status Hierarchy

7 tiers in `status_tier` enum, ordered weakest to strongest:
`recruit` → `normal`/`operator` → `performer` → `high_performer` → `elite` → `apex` → `legend`

## Earning vs buying
- **Earned tier**: `update_status_tier(user_id)` recalculates based on rank_score percentile, 30-day activity, current streak
  - Tier degrades automatically with inactivity (e.g. broken streak drops Elite back to high_performer)
  - Earned Apex is rare (top 1% by rank_score)
- **Apex Instant subscription** (€15.99/mo, `is_apex_subscriber = true`): pins tier to at least `apex`
  - `update_status_tier` checks `is_apex_subscriber` and refuses to lower the tier below `apex`
  - These users wear a `⚡` "Founding Apex" mark; earned Apex wear `🔥`
  - Both get identical visual effects (apex aura, flame+gold gradients)

## Apex/Founder badge UI (ApexBadge.tsx)
Tiny inline pill rendered ONLY on profile pages (Profile, PublicProfile, UserProfile) — kept rare/exclusive.
- `tier="apex"` + `isFounding={true}` → ⚡ Founding Apex (subscriber, "Day-One Member")
- `tier="apex"` + `isFounding={false}` → 🔥 Earned Apex (top 1%)
- `tier="legend"` → 🔱 Founder pill on Legend tier (Crown icon, purple/gold/rose gradient — denotes Founders Circle membership inside Legend)
NOT shown on leaderboards, tribes, feed.

## Legend tier — houses the Founders Circle
Top 0.1% tier remains labeled **"Legend"** (shortLabel "LGD", emoji 🔱). Requirements unchanged (99.9 percentile, 30 active days, 30-day streak). Cannot be purchased — fully earned.
- The "Founders Circle" is the inner narrative for Legends + Day-One Apex subscribers, surfaced via the Founder ApexBadge pill on Legend profiles and microcopy ("Legends & Founders only", "The Founders Circle is watching").
- Visual identity unchanged (purple/gold/rose conic gradient).

## Visual treatment per tier
- Recruit/Normal: muted, default secondary
- Operator: teal accent
- Performer: blue accent
- High performer: purple accent
- Elite: gold (Crown icon, gold ring/badge, glow-pulse 2.4s)
- Apex: flame-orange + gold gradient (Zap icon, double-ring aura, apex-aura-large CSS class, glow-pulse 1.8s)
- Legend: conic gradient (purple/gold/rose), Sparkles icon, animate-spin-slow ring

## TierLadder progressive UI (`src/components/TierLadder.tsx`)
Header reads "Your Ascension · 7 levels of dominance" with rotating Crown icon and gold divider. Each tier row escalates visually with rank: Recruit flat → Operator/Performer/HP get progressively stronger borders+glows → Elite gold ring → Apex/Legend get conic-spinning border (`apex-conic-border`) and increasing row height (52px → 72px). Current tier row uses `tier-shimmer-sweep` (gold light pulse every ~4s), a "Current Tier" gold ribbon and a pulsing dot on the left rail. Locked tiers show silhouette icons with a `+N` "TrendingUp" hint instead of a flat lock. A vertical gold gradient rail on the left fills proportionally to current rank/6 (metro-map style).

## Founding Apex commercial positioning (`src/components/ApexBadge.tsx`)
Founding Apex (paid €15.99/mo subscriber) is intentionally larger and flashier than Earned Apex to drive conversions:
- Crown+Zap stacked icon (purchased + instant)
- `.founding-premium-shimmer` CSS — credit-card style gold→amber→flame conic with sweeping white stripe every ~3.4s
- Sparkle accent that pulses
- Tooltip: "Founding Apex — €15.99/mo · Day-One Member · Tier locked at Apex"
- On Profile.tsx, subscriber additionally gets a "PREMIUM · DAY-ONE" ribbon above the username
Earned Apex (🔥 Flame) stays restrained — the visual gap is the funnel.

## Feature unlocks
- `elite`/`apex`/`legend` status tier → can post in Elite Feed (RLS check)
- `apex`/`legend` status tier OR `is_apex_subscriber` → can create Tribes
- Other features (AI Coach, Elite Feed reading) gate on `is_elite` (subscription) not earned tier
