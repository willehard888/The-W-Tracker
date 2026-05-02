---
name: Status Hierarchy
description: 7-tier status system. Legend is INVITE-ONLY (redeem_legend_invite RPC + legend_invites table, admin-managed codes). Apex earned via top 10% + 30/30. Elite via top 20% OR 20 days + 21 streak.
type: feature
---
# Status Hierarchy

7 tiers in `status_tier` enum, ordered weakest to strongest:
`recruit` → `normal`/`operator` → `performer` → `high_performer` → `elite` → `apex` → `legend`

## Server-side thresholds (`update_status_tier` / `update_all_status_tiers`)
| Tier | Requirement |
|---|---|
| **Legend** | INVITE ONLY — `legend_pinned = true` via `redeem_legend_invite(code)` RPC. Cannot be earned through XP/streaks. |
| **Apex** | percentile ≥ 90 AND 30 active days AND 30-day streak — OR `is_apex_subscriber = true` / unexpired `apex_credits_until` |
| **Elite** | percentile ≥ 80 **OR** (20 active days AND 21-day streak) |
| **High Performer** | percentile ≥ 70 **OR** (15 active days AND 14-day streak) |
| **Performer** | percentile ≥ 50 AND 7 active days |
| **Operator** | percentile ≥ 25 AND 5 active days |
| **Recruit** | default / `rank_score = 0` |

## Legend invite-only flow
- Table `legend_invites` (code unique, created_by, used_by, expires_at, note)
- Admin RPC `create_legend_invite(p_code?, p_expires_at?, p_note?)` — autogenerates code if omitted
- User RPC `redeem_legend_invite(p_code)` — pins legend_pinned=true, sets status_tier='legend', triggers founding-apex auto-grant
- Admin UI: `/admin/legend-invites` (linked from `/admin/moderation`)
- User UI: `RedeemLegendInviteDialog` mounted in TierLadder Legend detail view ("Redeem invite code" button)
- Codes are single-use; once redeemed user is locked at Legend permanently

## Apex/Founder badge UI (ApexBadge.tsx)
Tiny inline pill rendered ONLY on profile pages. Founders Circle = Legends + Day-One Apex subscribers.

## Visual treatment
- Legend: conic gradient (purple/gold/rose), Crown "Founder"/"Invite" badges in TierLadder rank-6 row.
- Apex: flame-orange + gold gradient (Zap icon, "Earn" badge for non-Apex viewers).

## Feature unlocks
- `elite`/`apex`/`legend` status_tier → can post in Elite Feed (RLS check)
- `apex`/`legend` status_tier OR `is_apex_subscriber` → can create Tribes / give tribe kudos
- AI Coach + Elite Feed reading gate on `is_elite` (subscription) not earned tier
