---
name: Status Addiction Loops
description: Five hook mechanisms that make status feel alive — risk banner, daily pulse, live rivals, tier ladder, days-at-tier streak combo
type: feature
---

The status hierarchy uses five reinforcement loops on Index + Profile to drive daily return:

1. **TierRiskBanner** (`src/components/TierRiskBanner.tsx`) — shown only when `useTierRisk` returns `pressure` or `danger`. Loss aversion: countdown when streak < 24h, or "X pts above demotion line".
2. **DailyStatusPulse** (`src/components/DailyStatusPulse.tsx`) — daily micro-win bar showing rank delta vs `profiles.last_rank_snapshot`. Snapshot updated once per day per user.
3. **LiveRivals** (`src/components/LiveRivals.tsx`) — concrete rivals (1 above + 1 below by `rank_score`). The user just below is highlighted red + "🔥 catching up" if delta < 5 pts.
4. **TierLadder** (`src/components/TierLadder.tsx`, Profile only) — vertical map of all 7 tiers with requirements + unlocks modal. Locked tiers grayed with lock icon.
5. **RankPressureCard `daysAtTier`** — small "Xd at Performer" line under the pressure microcopy, derived from `profiles.rank_score_updated_at` heuristic.

DB: `profiles.last_rank_snapshot jsonb` (nullable, shape `{rank, score, timestamp}`).

Hooks: `use-tier-risk.ts`, `use-live-rivals.ts`, `use-daily-pulse.ts`.

Layout priority on Index: TierRiskBanner → DailyStatusPulse → RankPressureCard → LiveRivals → RoadToElite → CoachNudge → ...
