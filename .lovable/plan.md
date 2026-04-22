
# Home Page → Next Level

Transform the Home into a single cinematic, scroll-orchestrated dashboard. Tighter hierarchy, fewer redundant cards, stronger personality per tier, and one unified "Hero Stack" at the top.

## New Layout (top → bottom)

```text
┌─────────────────────────────────────┐
│  HERO HEADER                        │  ← name + tier crest + greeting
│  • Tier-themed parallax aura        │
│  • Live "rank pulse" line           │
├─────────────────────────────────────┤
│  COMMAND DECK (sticky-ish)          │  ← STREAK + LOCK YOUR DAY
│  ┌──────────┬───────────────────┐   │     side-by-side on ≥sm,
│  │ Streak   │  Lock Your Day    │   │     stacked on mobile.
│  │ (compact)│  (premium CTA)    │   │     Both share one outer
│  └──────────┴───────────────────┘   │     shimmer frame.
├─────────────────────────────────────┤
│  TIER RISK BANNER (only if at risk) │
├─────────────────────────────────────┤
│  RANK ARENA                         │  ← merged DailyStatusPulse +
│  • Big rank number + percentile     │     RankPressureCard + Live Rivals
│  • Rivals strip below               │     into one tabbed/segmented card
├─────────────────────────────────────┤
│  PROGRESS RAIL                      │  ← Level XP bar + Road to Elite
│  Level | Elite | Quests             │     in a 3-tab segmented card
├─────────────────────────────────────┤
│  COACH STRIP                        │  ← AI Coach + Latest Nudge +
│  Horizontal scroll cards            │     Weekly Briefing in one row
├─────────────────────────────────────┤
│  GROWTH ROW                         │  ← Invite CTA + Recent Badges
├─────────────────────────────────────┤
│  Tier message footer                │
└─────────────────────────────────────┘
```

## Key Upgrades

**1. Hero Header (new)**
- Greeting ("Good evening, @name") with `TierUsername` colors.
- Animated tier crest (ApexBadge / Crown) floating with subtle parallax.
- One-line "rank pulse" ticker: "#127 · Top 4% · +12 this week" with live count-up.

**2. Command Deck**
- Streak + Lock-Your-Day fused in a single bordered frame so they read as ONE primary action zone.
- Compact streak variant (number + flame + 1 milestone segment).
- Lock Your Day keeps premium gold but adds a tier-tinted accent (purple for Legend, orange for Apex, gold default).

**3. Rank Arena (consolidation)**
- Merges `DailyStatusPulse`, `RankPressureCard`, `LiveRivals` into ONE card with segmented tabs: **Today / Pressure / Rivals**.
- Removes 3 stacked cards → 1 tall card with swipeable content.

**4. Progress Rail (consolidation)**
- Level XP block, Road to Elite, and Daily Quests teaser become a 3-tab segmented card.
- Reduces vertical scroll significantly.

**5. Coach Strip**
- Horizontal snap-scroll row: AI Coach entry · Latest Nudge · Weekly Briefing.
- Each card 80% viewport width, swipeable, premium gold borders.

**6. Tier-Reactive Background**
- Page background gradient + ambient particles shift hue based on `profile.status_tier`:
  - Legend → purple/gold dual aura
  - Apex → orange/gold
  - Elite → gold/teal
  - Below → muted gold

**7. Scroll Choreography**
- Sequential `animate-reveal` with staggered delays already exists; add `IntersectionObserver` reveal for sections below the fold so they animate in as user scrolls.
- Subtle parallax on hero aura (translateY based on scroll).

## Technical Plan

**Files to edit**
- `src/pages/Index.tsx` — full restructure, remove duplicate streak/level cards, new section components.

**Files to create**
- `src/components/home/HeroHeader.tsx` — greeting + tier crest + rank ticker.
- `src/components/home/CommandDeck.tsx` — streak (compact) + Lock-Your-Day fused frame.
- `src/components/home/RankArena.tsx` — segmented tabs wrapping existing 3 components.
- `src/components/home/ProgressRail.tsx` — segmented tabs wrapping Level XP + RoadToElite + Daily Quests teaser.
- `src/components/home/CoachStrip.tsx` — horizontal snap row of coach/nudge/briefing.
- `src/hooks/use-scroll-reveal.ts` — IntersectionObserver helper.

**Component changes**
- `src/components/StreakDisplay.tsx` — add `compact` prop (smaller number, single milestone segment, no floating particles) reusing existing tier system.
- Keep all existing data queries in `Index.tsx`; pass data down as props (no new network calls).

**CSS additions** (`src/index.css`)
- `@keyframes hero-aura-drift` — slow parallax drift for hero glow.
- `.snap-x-strip` utility for horizontal coach strip.
- `.segmented-tab` + `.segmented-tab-active` for tab styling.

**Behavior**
- All existing queries, navigation, and tier-risk logic preserved.
- No DB/RLS/migrations required.
- Mobile-first; ≥sm breakpoint uses 2-col Command Deck.
- Reduced-motion: skips parallax + particle motion (existing pattern).

**Out of scope**
- No new backend, no new tables, no auth changes.
- Streak animation system (already done in previous loop) stays as-is, only adds `compact` variant.
