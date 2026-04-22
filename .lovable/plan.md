

# Plan: Add new badges for Apex, Legend & Tribe Fire achievements

Add a fresh wave of badges that reward the recent flame/tribe/tier work. New badges land in the existing `badges` table and are validated by the existing server-side `award_badge_if_earned` RPC. Client-side awarding logic in `src/lib/badge-awards.ts` is extended to recognise the new requirement types.

## New badges (15 total)

### Tribe Fire (collective streak) — 5 badges
Triggered by the user's tribe collective streak reaching milestones while user is an active member.
- **Spark Brother** — Tribe collective streak 7 days (common)
- **Tribe Ember** — Tribe collective streak 30 days (rare)
- **Tribe Inferno** — Tribe collective streak 90 days (epic)
- **Eternal Pyre** — Tribe collective streak 180 days (legendary)
- **Tribe Founder** — Be a founding member (creator) of a tribe that reaches collective streak 30 (epic)

### Tribe Battle — 3 badges
- **First Blood** — Win 1 tribe battle (common)
- **War Chief** — Win 5 tribe battles (rare)
- **Tribe Conqueror** — Win 15 tribe battles (epic)

### Apex tier — 3 badges
- **Apex Reached** — Reach Apex tier (epic)
- **Apex Stronghold** — Hold Apex tier 14 days (epic)
- **Founding Apex** — Apex via paid Apex Instant subscription (legendary)

### Legend tier — 2 badges
- **Legend Ascendant** — Reach Legend tier (legendary)
- **Eternal Legend** — Hold Legend tier 30 days (legendary)

### Personal flame depth — 2 badges
- **Inferno Personal** — Reach personal streak 100 (epic)
- **Phoenix** — Recover from a streak break of ≥30 and rebuild to ≥30 again (rare)

## Database

Migration inserts 15 rows into `public.badges` with: `name`, `description`, `icon` (lucide name), `rarity`, `requirement_type`, `requirement_value`, `category`.

New `requirement_type` values introduced:
- `tribe_collective_streak` (value = days)
- `tribe_founder_streak` (value = days)
- `tribe_battles_won` (value = wins)
- `tier_reached` (value = tier rank index: apex=6, legend=7)
- `tier_held_days` (value = days; uses companion `requirement_type` is split into `apex_held_days` / `legend_held_days` for clarity)
- `apex_founding` (value = 1, paid Apex)
- `personal_streak` (value = days; longer milestones than existing `streak`)
- `phoenix_recovery` (value = 1)

To keep the schema simple we use distinct types per metric instead of overloading `tier_held_days`:
`apex_reached`, `apex_held_days`, `apex_founding`, `legend_reached`, `legend_held_days`, `tribe_collective_streak`, `tribe_founder_streak`, `tribe_battles_won`, `personal_streak`, `phoenix_recovery`.

## Client awarding logic (`src/lib/badge-awards.ts`)

Extend `checkAndAwardBadges` and `getBadgeProgress` to compute these new stats and map them in `typeToStat`:

- `apex_reached` / `legend_reached` → derived from `profile.tier`.
- `apex_held_days` / `legend_held_days` → from `profile.tier_started_at` (or fall back to a new `tier_history` lookup if available; otherwise from days since `tier_promoted_at`).
- `apex_founding` → `profile.is_founding_apex` (existing flag from Apex Instant).
- `tribe_collective_streak` → query `tribes.collective_streak` for the user's active tribe (via `tribe_members`).
- `tribe_founder_streak` → same as above, gated on `tribes.created_by = user_id`.
- `tribe_battles_won` → count from `tribe_battles` where `winner_tribe_id` belongs to user.
- `personal_streak` → `profile.longest_streak` (already fetched).
- `phoenix_recovery` → derived: `longest_streak ≥ 30` AND current `streak ≥ 30` AND a recorded streak break in between (uses existing `streak_history` if present; otherwise simplified to `longest_streak ≥ 30 && streak ≥ 30 && longest_streak > streak`).

Trigger-driven types (none here) are not added to `TRIGGER_TYPES`; everything resolves client-side via the existing `award_badge_if_earned` RPC pattern.

## Where badges become visible

No UI rewrite required — they automatically appear in:
- `BadgeVault.tsx` (full grid, with progress from `getBadgeProgress`)
- `BadgeUnlockModal.tsx` (on first unlock after check-in)
- `FeaturedBadgeHero.tsx` profile showcase
- `BadgeShowcase.tsx` top-5 sorted by rarity (Legendary will surface)

Icons reuse existing lucide imports already supported by `BadgeCard`: `Flame`, `Crown`, `Sparkles`, `Zap`, `Shield`, `Swords`, `Users`, `Bird` (for Phoenix, falls back to `Sparkle` if not in icon map).

## Files touched

- `supabase/migrations/<timestamp>_flame_tribe_apex_badges.sql` (insert 15 badges)
- `src/lib/badge-awards.ts` (extend stats fetch + `typeToStat` for both `checkAndAwardBadges` and `getBadgeProgress`)
- `src/components/BadgeCard.tsx` (only if a missing icon needs to be registered — verify during implementation)
- `.lovable/memory/features/badge-system.md` (bump count to 117 and note new categories)

## Notes

- All requirement evaluations stay server-validated through `award_badge_if_earned` RPC — client just identifies candidates.
- New tribe-related badges only count time while user is an active member of the tribe being measured.
- `personal_streak` milestones (100) intentionally exceed existing streak badges to give long-term players new goals.

