---
name: Tribes (Communities)
description: Apex-tier-gated communities. Owner must have is_apex_subscriber=true OR earned status_tier in (apex, legend). Max 3 tribes per owner.
type: feature
---
# Tribes — Apex-only Communities

Communities-feature where Apex members can create and run private/public tribes.

## Eligibility
- **Create**: `can_create_tribe(user_id)` returns true if `is_apex_subscriber = true` OR `status_tier IN ('apex','legend')`
- **Limit**: Max 3 owned tribes per user (enforced server-side in `create_tribe` RPC)
- **Join**: any authenticated user (subject to tribe `visibility`)

## Schema
- `tribes` — name, slug, description, cover_url, visibility (public/private), owner_id, member_count
- `tribe_members` — tribe_id, user_id, role (owner/admin/member), status (active/pending/banned)
- `tribe_posts` — content, image_url, likes_count
- `tribe_post_reactions` — simple like reactions

## Security
All writes go through SECURITY DEFINER RPCs:
- `create_tribe(name, description, visibility, cover_url)` → returns tribe id
- `join_tribe(tribe_id)` / `leave_tribe(tribe_id)` / `delete_tribe(tribe_id)`
- `approve_tribe_member(tribe_id, user_id, accept)` for private tribes
- Helpers: `is_tribe_member(tribe_id, user_id)`, `is_tribe_owner(tribe_id, user_id)`
- Direct INSERT/UPDATE/DELETE on `tribes` and `tribe_members` is blocked by RLS — only RPCs

## RLS
- `tribes`: SELECT visible if public OR member OR owner
- `tribe_posts`: members can post in their tribe; viewable by members or anyone for public tribes
- `tribe_members`: visible to authed if member of same tribe OR public tribe OR self

## UI
- `/tribes` — discovery list + "My Tribes"
- `/tribes/new` — gated create form (shows paywall CTA if user is not eligible)
- `/tribes/:id` — detail page with apex-aura header, member list, post composer + feed
- BottomNav has "Tribes" tab
