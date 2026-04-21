---
name: Road to Elite
description: Earned Elite status tier requires top 5% rank + 14 active days + 30-day streak. Live progress card on Index and Profile.
type: feature
---
# Road to Elite

Elite is the top earned `status_tier` — never sold, only earned.

## Server-side criteria (`update_status_tier` / `update_all_status_tiers`)
- **Legend**: percentile ≥ 99.9 AND 30 active days AND 30-day streak
- **Apex**: percentile ≥ 99 AND 30 active days AND 30-day streak
- **Elite**: percentile ≥ 95 AND 14 active days AND **30-day streak**
- **High Performer**: percentile ≥ 90 AND 14 active days AND **14-day streak**
- **Performer**: percentile ≥ 75 AND 7 active days
- **Operator**: percentile ≥ 50 AND 7 active days
- **Recruit**: default

## Client-side
- Hook `src/hooks/use-road-to-elite.ts` fetches `rank_score`, 30-day activity day count, current streak
- Component `src/components/RoadToElite.tsx`: gold-themed progress card with 3 requirements (Rank score, Active days, Streak), shown on Profile + Index for any active member whose `status_tier` is below `elite`
- Hidden once tier ≥ elite (replaced by elite badge/crown UI elsewhere)

## What Elite tier unlocks
- Posting in Elite Feed (RLS check on `feed_posts.INSERT` requires `status_tier IN ('elite','apex','legend')`)
- Elite-only badges (`elite_member` etc.)
- Profile gold glow / crown
- 2× XP multiplier (legacy elite perk, still tier-gated)
