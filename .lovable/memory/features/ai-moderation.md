---
name: AI Content Moderation
description: AI moderator for proof photos and Elite Feed posts — Gemini 2.5 Flash, hash cache, fail-closed for images, low-confidence admin queue
type: feature
---

## Architecture

Edge function `moderate-content` reviews user-submitted images and text using Lovable AI Gateway (`google/gemini-2.5-flash`) via tool calling. Returns `{ action, severity, confidence, categories, reason, cache_hit }`.

## Optimization

1. **Client preflight** (`src/lib/moderation-preflight.ts`): validate file (10KB–10MB, image/*), generate 256px JPEG thumbnail, SHA-256 hash. Thumbnail (≈30KB) is moderated as `image_b64` data URL — skips full upload if blocked.
2. **Hash cache** (`moderation_cache` table, service-role only): repeat images return in ~50ms with no AI call.
3. **Fail-CLOSED for images** on `proof` / `feed_post` if AI gateway times out (8s AbortController) or errors. Text-only posts remain fail-OPEN.
4. **Confidence routing**: `action=block && confidence < 0.85` → downgraded to `flag` and inserted into `moderation_queue` for admin review at `/admin/moderation`.
5. **Per-instance throttle**: ad-hoc 5/min/user (in-memory Map) — backend rate-limit primitives not yet available.
6. **Severity** field (low/medium/high/critical) drives UI color / admin urgency.

## Tables

- `moderation_cache (image_hash PK, action, categories, confidence, severity, reason, created_at)` — RLS on, no policies (service role only).
- `moderation_queue (...status: pending|approved|rejected, reviewed_by, reviewed_at)` — admin SELECT/UPDATE only.
- `content_moderations` extended with `severity`, `cache_hit`, `latency_ms`.

## UI

- `useModeration()` hook (`src/hooks/use-moderation.ts`) wraps preflight + invoke + AbortController.
- `<ModerationGate>` (`src/components/ModerationGate.tsx`) overlay: validating → reviewing → blocked, with thumbnail preview, slow-state cancel button after 5s.
- `DailyCheckin.tsx` and `EliteFeed.tsx` moderate BEFORE storage upload.
- `/admin/moderation` (`AdminModeration.tsx`) — admin-only realtime queue with approve/reject. Reject deletes the feed post and its image from storage.

## Friendly messages

Category-specific messages in `getFriendlyMessage()` (e.g. nudity → "Modesty required", spam → "No promotional content allowed", ai_generated → "Real proofs only").
