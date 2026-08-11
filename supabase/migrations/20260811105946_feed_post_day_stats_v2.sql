-- ============================================================
-- feed_post_day_stats v2 — adds streak_at_day for the feed sticker's
-- historical streak flame.
-- ============================================================
-- streak_at_day = consecutive distinct UTC check-in days ending at that
-- row's check-in day. Computed from history (no snapshot column exists),
-- so it is "days in a row as of that photo" — it can differ from
-- profiles.streak when a streak shield preserved a gap. Display-only.
--
-- Return-type change ⇒ DROP + recreate (OR REPLACE refuses a different
-- RETURNS TABLE), grants re-applied verbatim. Privacy unchanged: adds only
-- a day count, which the feed already shows at author level (current
-- streak on every post).
-- ============================================================

DROP FUNCTION IF EXISTS public.feed_post_day_stats(text[]);

CREATE FUNCTION public.feed_post_day_stats(p_image_urls text[])
RETURNS TABLE (
  image_url     text,
  xp_earned     int,
  habits_done   int,
  verified      boolean,
  checkin_day   date,
  streak_at_day int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dc.proof_photo_url AS image_url,
    COALESCE(dc.xp_earned, 0) AS xp_earned,
    -- Habit count: the personalized habits jsonb when populated; legacy
    -- boolean columns otherwise (habits = '{}' even on some recent rows).
    GREATEST(
      COALESCE((SELECT count(*)::int FROM jsonb_each(COALESCE(dc.habits, '{}'::jsonb)) e
                WHERE e.value = to_jsonb(true)), 0),
      ( (dc.workout IS TRUE)::int + (dc.cold_shower IS TRUE)::int
      + (dc.healthy_food IS TRUE)::int + (dc.protein_intake IS TRUE)::int
      + (dc.meditation_morning IS TRUE)::int + (dc.meditation_evening IS TRUE)::int
      + (dc.no_phone_morning IS TRUE)::int + (dc.no_phone_evening IS TRUE)::int
      + (dc.reading IS TRUE)::int )
    ) AS habits_done,
    (dc.verified_at IS NOT NULL) AS verified,
    (dc.checked_in_at AT TIME ZONE 'UTC')::date AS checkin_day,
    s.streak_at_day
  FROM public.daily_checkins dc
  CROSS JOIN LATERAL (
    -- Maximal consecutive run ending at this row's day: over distinct days
    -- ≤ checkin_day (desc), a day belongs to the run iff d = day - (rn-1).
    -- After the first gap d falls by ≥2 per rn step, so the equality can
    -- never re-align — count(*) is exactly the run length.
    SELECT count(*)::int AS streak_at_day
    FROM (
      SELECT x.d, ROW_NUMBER() OVER (ORDER BY x.d DESC) AS rn
      FROM (
        SELECT DISTINCT (c2.checked_in_at AT TIME ZONE 'UTC')::date AS d
        FROM public.daily_checkins c2
        WHERE c2.user_id = dc.user_id
          AND (c2.checked_in_at AT TIME ZONE 'UTC')::date
              <= (dc.checked_in_at AT TIME ZONE 'UTC')::date
      ) x
    ) y
    WHERE y.d = (dc.checked_in_at AT TIME ZONE 'UTC')::date - (y.rn - 1)::int
  ) s
  WHERE auth.uid() IS NOT NULL                          -- authenticated members only
    AND array_length(p_image_urls, 1) BETWEEN 1 AND 60  -- feed page is 50
    AND dc.proof_photo_url = ANY (p_image_urls);
$$;

REVOKE ALL ON FUNCTION public.feed_post_day_stats(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_post_day_stats(text[]) TO authenticated;
