-- Per-user notification preferences.
--
-- One jsonb column instead of seven boolean columns: categories will drift
-- (new senders appear), and an absent key deliberately means "on" so existing
-- users need no backfill and new categories are opt-out by default.
--
-- Keys the app reads today:
--   streak_guard  bool  — local 20:00 streak warning
--   coach         bool  — coach morning nudge + proactive pushes
--   social        bool  — friends, messages, referrals
--   tribe         bool  — tribe events, battles, fire
--   briefing      bool  — weekly briefing push
--   winback       bool  — lapsed re-engagement pushes
--   reminder_hour int   — local streak-warning hour, 17–22 (default 20)
--
-- Validation lives in the client and in the edge senders (absent/malformed
-- key = on / default hour); no CHECK constraint so adding a key never needs
-- a migration.
--
-- Writable by the owner via the plain own-row UPDATE policy —
-- protect_profile_columns (20260529120000) does not cover this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- daily-reminder retired (2026-09-02): the client-side local notification owns
-- the 20:00 streak warning (exact count, works offline). With remote push now
-- actually registering tokens, the server twin would double every banner.
-- Unschedule is wrapped so the migration also applies where the job never
-- existed (fresh environments, local shadow DB).
DO $do$ BEGIN
  PERFORM cron.unschedule('daily-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;
