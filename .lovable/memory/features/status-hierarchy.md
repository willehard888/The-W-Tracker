---
name: Status Hierarchy
description: 7-tier status system. Tiers 1-4 are EARNED through XP/consistency/rank. Apex can also be BOUGHT via €15.99/mo subscription which protects against decay. Legend is rebranded as "Founder" (top 0.1%, fully earned).
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
- `tier="legend"` → 🔱 Founder (Crown icon, purple/gold/rose gradient — always earned, no founding/earned split)
NOT shown on leaderboards, tribes, feed.

## Legend → Founder rebrand
Top 0.1% tier is labeled **"Founder"** (shortLabel "FDR"). Requirements unchanged (99.9 percentile, 30 active days, 30-day streak). Visual identity unchanged (purple/gold/rose conic gradient). Cannot be purchased.

## Visual treatment per tier
- Recruit/Normal: muted, default secondary
- Operator: teal accent
- Performer: blue accent
- High performer: purple accent
- Elite: gold (Crown icon, gold ring/badge, glow-pulse 2.4s)
- Apex: flame-orange + gold gradient (Zap icon, double-ring aura, apex-aura-large CSS class, glow-pulse 1.8s)
- Founder (formerly Legend): conic gradient (purple/gold/rose), Sparkles icon, animate-spin-slow ring

## Feature unlocks
- `elite`/`apex`/`legend` status tier → can post in Elite Feed (RLS check)
- `apex`/`legend` status tier OR `is_apex_subscriber` → can create Tribes
- Other features (AI Coach, Elite Feed reading) gate on `is_elite` (subscription) not earned tier
