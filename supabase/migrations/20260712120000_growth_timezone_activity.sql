-- ============================================================
-- Growth engine — per-user timezone + last-active primitive
-- ============================================================
-- Server push jobs were timezone-blind: daily-reminder blasted everyone at
-- 18:00 UTC and coach-morning-nudge fired at UTC midnight, so a "reminder"
-- landed at random local hours worldwide. And nothing reached users who had
-- stopped opening the app (all win-back was device-local). Both need two
-- facts we never stored on the main profile: the user's local timezone and
-- when they were last active.
--
--   1. profiles.timezone (IANA, e.g. 'Europe/Helsinki') + utc_offset_minutes
--      + last_active_at.
--   2. touch_activity() — a heartbeat the client calls on foreground. Server
--      stamps last_active_at (trusted clock); client supplies its IANA tz.
--   3. users_due_for_streak_reminder(hour) — set-based, DST-correct selection
--      of who to nudge *right now*, so the reminder job can run hourly and hit
--      each user once at their own local evening.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS utc_offset_minutes int,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Index the win-back / activity scans (lapsed = last_active_at::date = today - N).
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON public.profiles (last_active_at);

-- ------------------------------------------------------------
-- Heartbeat: client calls on app foreground. Server owns the timestamp;
-- the client only supplies its timezone (validated against pg_timezone_names
-- so a bad string can never break the AT TIME ZONE math downstream).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_activity(
  p_timezone text DEFAULT NULL,
  p_utc_offset_minutes int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  UPDATE public.profiles p
  SET last_active_at = now(),
      timezone = CASE
        WHEN p_timezone IS NOT NULL AND p_timezone <> ''
             AND EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p_timezone)
        THEN p_timezone
        ELSE p.timezone
      END,
      utc_offset_minutes = COALESCE(p_utc_offset_minutes, p.utc_offset_minutes),
      updated_at = now()
  WHERE p.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_activity(text, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.touch_activity(text, int) TO authenticated;

-- ------------------------------------------------------------
-- Who should get the streak reminder at this hour? Runs set-based in the DB
-- (DST-correct via AT TIME ZONE) so the edge function stays a thin sender.
-- A user qualifies when, in THEIR local time, it's the target hour, they have
-- a live streak, and they haven't checked in on their local calendar day yet.
-- NULL timezone (user hasn't opened the updated app yet) falls back to UTC so
-- no one is silently dropped during rollout — they still get one nudge/day.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_due_for_streak_reminder(p_target_hour int)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
  FROM public.profiles p
  WHERE p.streak > 0
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))) = p_target_hour
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_checkins d
      WHERE d.user_id = p.user_id
        AND (d.checked_in_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
            = (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
    );
$$;

REVOKE ALL ON FUNCTION public.users_due_for_streak_reminder(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.users_due_for_streak_reminder(int) TO service_role;

-- ------------------------------------------------------------
-- Lapsed win-back: users whose LAST active day was exactly N days ago (in
-- their local time). Exact-day match means each lapsed tier fires once with no
-- dedup table — a lapsed user isn't opening the app, so last_active_at is
-- frozen and matches "today - N" on exactly one calendar day.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_lapsed(p_days_ago int)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
  FROM public.profiles p
  WHERE p.last_active_at IS NOT NULL
    AND (p.last_active_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
        = (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date - p_days_ago;
$$;

REVOKE ALL ON FUNCTION public.users_lapsed(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.users_lapsed(int) TO service_role;
