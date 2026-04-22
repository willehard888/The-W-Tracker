---
name: Tribes (Communities)
description: Apex-tier-gated communities. Owner needs is_apex_subscriber=true OR earned status_tier in (apex, legend). Max 3 tribes per owner. Names case-insensitive unique. Invites supported.
type: feature
---
# Tribes — Apex-only Communities

Communities feature where Apex members create and run private/public tribes. Members can be invited individually.

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

## Security — all writes via SECURITY DEFINER RPCs
- `create_tribe(name, description, visibility, cover_url)` → returns tribe id
- `join_tribe(tribe_id)` / `leave_tribe(tribe_id)` / `delete_tribe(tribe_id)`
- `approve_tribe_member(tribe_id, user_id, accept)` for private tribes
- `invite_to_tribe(tribe_id, invitee_id)` — members only, max 50 pending per tribe, no self/duplicate
- `respond_to_tribe_invite(invite_id, accept)` — invitee only; accept inserts active member + bumps member_count
- `revoke_tribe_invite(invite_id)` — inviter or owner only
- Helpers: `is_tribe_member`, `is_tribe_owner`, `can_create_tribe`
- Direct INSERT/UPDATE/DELETE on tribes, tribe_members, tribe_invites blocked by RLS

## RLS
- `tribes`: SELECT visible if public OR member OR owner
- `tribe_posts`: members can post in their tribe; viewable by members or anyone for public tribes
- `tribe_members`: visible if member of same tribe OR public tribe OR self
- `tribe_invites`: visible to inviter, invitee, or tribe owner

## UI
- `/tribes` — discovery + "My Tribes" tabs, Featured Tribe hero with conic border + member-avatar stack, owner badges, pending Invites widget at top
- `/tribes/new` — gated create form with realtime name availability indicator
- `/tribes/:id` — parallax apex hero, members row, Invite button (members), like button on posts, Apex badge on apex/legend authors, cinematic empty state
- `TribeInviteModal` — username search → send invite, blocks members and already-invited
- BottomNav has "Tribes" tab
