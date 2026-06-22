-- Verified battle results: flag whether the winner's performance was backed by
-- real HealthKit activity (for activity-based battle types). Ties battles to the
-- "verified discipline" wedge — a win you can trust, not just an honor-system photo.
-- Idempotent. (The resolve-battles edge function writes these columns.)

ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS winner_verified boolean,
  ADD COLUMN IF NOT EXISTS verification_notes jsonb;
