-- Badge progress used to fire ~45 REST count queries per Profile open
-- (one per habit criterion + per-tribe member-streak loops in JS). One
-- SECURITY INVOKER function computes everything in a single round trip:
-- one FILTERed scan of the caller's daily_checkins + one grouped join for
-- tribe minimum streaks. INVOKER on purpose — RLS visibility stays exactly
-- what the JS queries had.

CREATE OR REPLACE FUNCTION public.user_badge_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH me AS (
  SELECT auth.uid() AS uid
),
dc AS (
  SELECT
    count(*) AS checkins,
    count(*) FILTER (WHERE workout) AS workouts,
    count(*) FILTER (WHERE cold_shower) AS cold_shower,
    count(*) FILTER (WHERE healthy_food) AS healthy_food,
    count(*) FILTER (WHERE protein_intake) AS protein,
    count(*) FILTER (WHERE hydration_liters >= 3) AS hydration,
    count(*) FILTER (WHERE no_phone_morning) AS no_phone_morning,
    count(*) FILTER (WHERE no_phone_evening) AS no_phone_evening,
    count(*) FILTER (WHERE reading) AS reading,
    count(*) FILTER (WHERE extra_workout) AS double_workout,
    count(*) FILTER (WHERE meditation_morning) + count(*) FILTER (WHERE meditation_evening) AS meditation,
    count(*) FILTER (WHERE proof_photo_url IS NOT NULL) AS proofs,
    count(*) FILTER (
      WHERE workout AND cold_shower AND healthy_food AND protein_intake
        AND hydration_liters >= 3 AND reading
        AND no_phone_morning AND no_phone_evening
    ) AS perfect_day
  FROM daily_checkins, me
  WHERE user_id = me.uid
),
my_tribes AS (
  SELECT tribe_id FROM tribe_members, me
  WHERE user_id = me.uid AND status = 'active'
),
owned AS (
  SELECT id AS tribe_id FROM tribes, me WHERE owner_id = me.uid
),
mins AS (
  -- Minimum member streak per tribe I'm in or own — the "collective streak"
  -- badge semantics (weakest link defines the tribe's shared streak).
  SELECT tm.tribe_id, min(COALESCE(p.streak, 0)) AS min_streak
  FROM tribe_members tm
  JOIN profiles p ON p.user_id = tm.user_id
  WHERE tm.status = 'active'
    AND tm.tribe_id IN (
      SELECT tribe_id FROM my_tribes
      UNION
      SELECT tribe_id FROM owned
    )
  GROUP BY tm.tribe_id
)
SELECT jsonb_build_object(
  'checkins', dc.checkins,
  'workouts', dc.workouts,
  'cold_shower', dc.cold_shower,
  'healthy_food', dc.healthy_food,
  'protein', dc.protein,
  'hydration', dc.hydration,
  'no_phone_morning', dc.no_phone_morning,
  'no_phone_evening', dc.no_phone_evening,
  'reading', dc.reading,
  'double_workout', dc.double_workout,
  'meditation', dc.meditation,
  'proofs', dc.proofs,
  'perfect_day', dc.perfect_day,
  'battles_won', (SELECT count(*) FROM battles b, me WHERE b.winner_id = me.uid),
  'referrals', (SELECT count(*) FROM referrals r, me WHERE r.referrer_id = me.uid),
  'tribe_battles_won', (
    SELECT count(*) FROM tribe_battles tb
    WHERE tb.status = 'completed'
      AND tb.winner_tribe_id IN (SELECT tribe_id FROM my_tribes)
  ),
  'tribe_collective_streak', COALESCE(
    (SELECT max(min_streak) FROM mins WHERE tribe_id IN (SELECT tribe_id FROM my_tribes)), 0),
  'tribe_founder_streak', COALESCE(
    (SELECT max(min_streak) FROM mins WHERE tribe_id IN (SELECT tribe_id FROM owned)), 0)
)
FROM dc;
$$;

REVOKE ALL ON FUNCTION public.user_badge_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_badge_stats() TO authenticated;
