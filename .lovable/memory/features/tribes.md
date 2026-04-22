---
name: Tribes (Communities)
description: Apex-tier-gated communities. Owner needs is_apex_subscriber=true OR earned status_tier in (apex, legend). Max 3 tribes per owner. Names case-insensitive unique. Invites supported. Tribe Leaderboard + private search + join requests. Owner can edit tribe + promote up to 2 admins.
type: feature
---
# Tribes — Apex-only Communities

Communities feature where Apex members create and run private/public tribes. Members can be invited individually or request to join private tribes.

## Eligibility
- **Create**: `can_create_tribe(user_id)` returns true if `is_apex_subscriber = true` OR `status_tier IN ('apex','legend')`
- **Limit**: Max 3 owned tribes per user (enforced in `create_tribe` RPC)
- **Join**: any authenticated user (subject to tribe `visibility`) or accept an invite

## Roles & management
- Roles: `owner` (1), `admin` (max 2), `member`
- Owner-only via SECURITY DEFINER RPCs:
  - `update_tribe(p_tribe_id, p_name, p_description, p_visibility, p_cover_url, p_clear_cover)` — edit name/desc/visibility/cover, validates uniqueness + slug
  - `set_tribe_member_role(p_tribe_id, p_user_id, p_role)` — promote/demote, blocks > 2 admins, cannot change owner or self
  - `remove_tribe_member(p_tribe_id, p_user_id)` — kick member, decrements member_count
- Helper: `is_tribe_admin(_tribe_id, _user_id)` returns true for owner OR active admin
- `TribeManageDialog` — owner UI: edit metadata + promote/demote/remove members (Manage button on hero)
- Members row shows Crown badge for owner, Shield badge for admin

## Unique names
- Case-insensitive unique index `tribes_name_unique ON tribes (lower(name))`
- `create_tribe` and `update_tribe` RPCs return "Tribe name already taken — try another" before insert/update
- `TribeNew.tsx` performs a 400 ms debounced availability check (✓ Available / ✗ Already taken)

## Schema
- `tribes` — name, slug, description, cover_url, visibility (public/private), owner_id, member_count
- `tribe_members` — tribe_id, user_id, role (owner/admin/member), status (active/pending/banned)
- `tribe_posts` — content, image_url, video_url, likes_count, kudos_count, comments_count, reported
- `tribe_post_reactions` — like reactions
- `tribe_post_kudos` — Apex-only kudos (2/month shared budget); +10 XP to receiver via trigger
- `tribe_post_comments` — threaded replies (parent_id), edit/delete supported
- `tribe_post_reports` — moderation reports (visible to owner + admins via RLS)
- `tribe_invites` — tribe_id, inviter_id, invitee_id, status; UNIQUE pending(tribe_id, invitee_id)
- `tribe_battles` — challenger/opponent tribe XP battle (3/7/14 days)

## Security — all writes via SECURITY DEFINER RPCs
- Tribe lifecycle: `create_tribe`, `update_tribe`, `delete_tribe`
- Membership: `join_tribe`, `leave_tribe`, `approve_tribe_member`, `set_tribe_member_role`, `remove_tribe_member`
- Invites: `invite_to_tribe`, `respond_to_tribe_invite`, `revoke_tribe_invite`
- Battles: `create_tribe_battle`, `respond_to_tribe_battle`, `resolve_tribe_battle`
- Discovery: `get_tribe_leaderboard(p_period, p_limit)`, `search_tribes(p_query, p_limit)`
- Helpers: `is_tribe_member`, `is_tribe_owner`, `is_tribe_admin`, `can_create_tribe`
- Direct INSERT/UPDATE/DELETE on tribes, tribe_members, tribe_invites, tribe_battles blocked by RLS

## UI
- `/tribes` — discovery + "My Tribes" tabs, **TribeSearchBar**, Tribe Leaderboard CTA, Featured Tribe hero
- `/tribes/leaderboard` — Weekly/All-Time tabs, top 3 podium, sticky "Your tribe" footer
- `/tribes/new` — gated create form with realtime name availability indicator
- `/tribes/:id` — parallax apex hero, members row (Crown=owner, Shield=admin), Manage button (owner), Invite, Pending requests pill, Reports pill, real-time feed
- `TribeManageDialog` — owner-only: edit name/desc/visibility/cover, manage roles (max 2 admins), remove members
- `TribeInviteModal` / `TribePendingRequestsDialog` / `TribeReportsDialog`
- `/tribes/:id/battles` — Active/Pending/History tabs
