---
name: Badge Vault
description: 117 badges, server-side validation RPC, real-time progress, includes Apex/Legend/Tribe-Fire families
type: feature
---
117 total badges across categories: streak, workout, social, tier, tribe, special.

Server-side validation: `award_badge_if_earned(p_user_id, p_badge_id)` re-computes the stat from real DB data and only inserts into `user_badges` if the requirement is genuinely met. Client (`src/lib/badge-awards.ts`) only identifies *candidates* and calls the RPC.

Recent additions (15 badges): Apex Reached/Stronghold/Founding, Legend Ascendant/Eternal, Spark Brother / Tribe Ember / Tribe Inferno / Eternal Pyre / Tribe Founder, First Tribe Blood / War Chief / Tribe Conqueror, Inferno Personal, Phoenix.

Tribe collective streak = MIN personal streak among active members of the tribe (best across user's tribes).
Apex/Legend held days = days since `apex_subscription_started_at` while currently in tier.
Phoenix = `longest_streak ≥ 30 AND streak ≥ 30 AND longest_streak > streak`.

Trigger-driven types (NOT awarded by client): total_likes, total_comments, single_post_likes, total_kudos, season_champion, leaderboard_percentile.
