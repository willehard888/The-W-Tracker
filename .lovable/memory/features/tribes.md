---
name: Tribes (Communities)
description: Apex-tier-gated communities. Owner needs is_apex_subscriber=true OR earned status_tier in (apex, legend). Max 3 tribes per owner. Names case-insensitive unique. Invites supported. Tribe Leaderboard + private search + join requests.
type: feature
---
# Tribes — Apex-only Communities

Communities feature where Apex members create and run private/public tribes. Members can be invited individually or request to join private tribes.

## Eligibility
- **Create**: `can_create_tribe(user_id)` returns true if `is_apex_subscriber = true` OR `status_tier IN ('apex','legend')`
- **Limit**: Max 3 owned tribes per user (enforced in `create_tribe` RPC)
- **Join**: any authenticated user (subject to tribe `visibility`) or accept an invite

## Unique names
- Case-insensitive unique index `tribes_name_unique ON tribes (lower(name))`
- `create_tribe` RPC returns "Tribe name already taken — try another" before insert
- `TribeNew.tsx` performs a 400 ms debounced availability check (✓ Available / ✗ Already taken)

## Schema
- `tribes` — name, slug, description, cover_url, visibility (public/private), owner_id, member_count
- `tribe_members` — tribe_id, user_id, role (owner/admin/member), status (active/pending/banned)
- `tribe_posts` — content, image_url, likes_count
- `tribe_post_reactions` — like reactions
- `tribe_invites` — tribe_id, inviter_id, invitee_id, status (pending/accepted/declined/revoked); UNIQUE pending(tribe_id, invitee_id)
- `tribe_battles` — challenger/opponent tribe XP battle (3/7/14 days)

## Security — all writes via SECURITY DEFINER RPCs
- `create_tribe(name, description, visibility, cover_url)` → returns tribe id
- `join_tribe(tribe_id)` → returns 'active' (public) or 'pending' (private)
- `leave_tribe` / `delete_tribe`
- `approve_tribe_member(tribe_id, user_id, accept)` for private tribes
- `invite_to_tribe` / `respond_to_tribe_invite` / `revoke_tribe_invite`
- `create_tribe_battle` / `respond_to_tribe_battle` / `resolve_tribe_battle`
- `get_tribe_leaderboard(p_period, p_limit)` — ranks tribes by 'weekly' (last 7d daily_checkins.xp_earned sum) or 'all_time' (sum of profiles.xp). Returns only public tribes + viewer's own.
- `search_tribes(p_query, p_limit)` — finds public AND private tribes by name (ILIKE). Returns viewer_status: member | pending_join | pending_invite | none.
- Helpers: `is_tribe_member`, `is_tribe_owner`, `can_create_tribe`
- Direct INSERT/UPDATE/DELETE on tribes, tribe_members, tribe_invites, tribe_battles blocked by RLS

## Private join requests
- `join_tribe` already returns 'pending' for private tribes — UI handles it
- Owner sees "Pending requests" pill in TribeDetail hero with count → opens `TribePendingRequestsDialog` to approve/decline (calls `approve_tribe_member`)

## RLS
- `tribes`: SELECT visible if public OR member OR owner (private tribes hidden from generic SELECTs — search uses RPC)
- `tribe_posts`: members can post in their tribe; viewable by members or anyone for public tribes
- `tribe_members`: visible if member of same tribe OR public tribe OR self
- `tribe_invites`: visible to inviter, invitee, or tribe owner

## UI
- `/tribes` — discovery + "My Tribes" tabs, **TribeSearchBar** at top of Browse (debounced 300ms search via `search_tribes` RPC, finds private tribes too with Lock icon + "Request" button), **Tribe Leaderboard CTA card**, Featured Tribe hero, owner badges, pending Invites widget
- `/tribes/leaderboard` — Weekly/All-Time tabs, top 3 podium (gold/silver/bronze with Crown/Medal/Award), compact list 4–50, sticky "Your tribe" footer
- `/tribes/new` — gated create form with realtime name availability indicator
- `/tribes/:id` — parallax apex hero, members row, Invite button, Tribe Battles entry, **owner-only Pending requests pill** (count + dialog), like button on posts, Apex badge on apex/legend authors
- `/tribes/:id/battles` — Active/Pending/History tabs for tribe-vs-tribe XP battles
- `TribeInviteModal` — username search → send invite
- `TribePendingRequestsDialog` — owner approves/declines pending join requests
- BottomNav has "Tribes" tab
