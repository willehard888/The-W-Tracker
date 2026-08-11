-- ============================================================
-- feed_post_day_stats — day-stats for check-in proof photos in the Elite Feed
-- ============================================================
-- Check-in proof photos are auto-posted to feed_posts with image_url set to the
-- SAME public URL stored on daily_checkins.proof_photo_url. daily_checkins RLS
-- is own-rows-only, so the feed cannot join it client-side — this SECURITY
-- DEFINER RPC (same sanctioned pattern as verified_authors) batch-resolves the
-- day's stats for the visible feed images. The URL equality join also perfectly
-- discriminates proof posts (proof-photos bucket) from composer posts
-- (feed-images bucket): composer URLs simply match nothing.
--
-- Privacy: exposes only aggregate day facts (xp, habit COUNT, verified flag,
-- day) — not habit contents. Equivalent to what the auto-post's content string
-- ("Daily check-in ✅ — 340 XP earned") already reveals, plus the verified flag
-- that the feed already shows at author level.
-- ============================================================

CREATE OR REPLACE FUNCTION public.feed_post_day_stats(p_image_urls text[])
RETURNS TABLE (
  image_url   text,
  xp_earned   int,
  habits_done int,
  verified    boolean,
  checkin_day date
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
    (dc.checked_in_at AT TIME ZONE 'UTC')::date AS checkin_day
  FROM public.daily_checkins dc
  WHERE auth.uid() IS NOT NULL                       -- authenticated members only
    AND array_length(p_image_urls, 1) BETWEEN 1 AND 60  -- feed page is 50
    AND dc.proof_photo_url = ANY (p_image_urls);
$$;

REVOKE ALL ON FUNCTION public.feed_post_day_stats(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_post_day_stats(text[]) TO authenticated;
