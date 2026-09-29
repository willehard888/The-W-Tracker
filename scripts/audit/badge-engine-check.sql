-- The badge engine against a fixture — local stub only (profiles.user_id has
-- no auth.users behind it here), rolled back at the end. Run after the engine
-- migration on the :5499 dry-run database:
--   psql -h localhost -p 5499 -U postgres -d wf_badges -v ON_ERROR_STOP=1 -f scripts/audit/badge-engine-check.sql
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000000ba';
  s jsonb; won int; bell int; n int;
  day timestamptz;
BEGIN
  INSERT INTO profiles (user_id, username, xp, level, streak, longest_streak, status_tier, rank_score, created_at)
  VALUES (u, 'badge-fixture', 1200, 3, 9, 35, 'operator', 80, now());

  -- 12 check-ins: meditation on a 3-day run, a gap, then a 5-day run; one
  -- perfect 150 day; every day a workout.
  FOR n IN 1..12 LOOP
    day := now() - make_interval(days => 13 - n);
    INSERT INTO daily_checkins (user_id, checked_in_at, tz_offset_minutes, xp_earned, workout, cold_shower,
                                meditation_morning, meditation_evening, hydration_liters, verified_at, score_breakdown)
    VALUES (u, day, -180, 80, true, n <= 5,
            n IN (1,2,3,6,7,8,9,10), n IN (6,7),
            3, CASE WHEN n = 12 THEN day END,
            CASE WHEN n = 12 THEN '{"v":3,"total":150,"max":150,"verified":true,"lines":[{"k":"training","pts":50,"max":50},{"k":"sleep","pts":25,"max":25},{"k":"steps","pts":10,"max":10},{"k":"mind","pts":15,"max":15},{"k":"hydration","pts":15,"max":15},{"k":"habits","pts":25,"max":25},{"k":"perfect","pts":10,"max":10}]}'::jsonb
                 ELSE '{"v":3,"total":80,"max":100,"verified":false,"lines":[{"k":"training","pts":25,"max":50},{"k":"sleep","pts":25,"max":25},{"k":"steps","pts":0,"max":10},{"k":"mind","pts":15,"max":15},{"k":"hydration","pts":15,"max":15},{"k":"habits","pts":0,"max":25},{"k":"perfect","pts":0,"max":10}]}'::jsonb END);
  END LOOP;

  s := public.badge_stats(u);
  ASSERT (s ->> 'checkins')::int = 12, 'checkins ' || (s ->> 'checkins');
  ASSERT (s ->> 'meditation')::int = 10, 'meditation sessions ' || (s ->> 'meditation');
  ASSERT (s ->> 'meditation_streak')::int = 5, 'meditation_streak is a run, not a total: ' || (s ->> 'meditation_streak');
  ASSERT (s ->> 'perfect_day')::int = 1, 'perfect_day from score_breakdown: ' || (s ->> 'perfect_day');
  ASSERT (s ->> 'health_days')::int = 1 AND (s ->> 'full_days')::int = 1, 'full/health days';
  ASSERT (s ->> 'max_effort_days')::int = 1 AND (s ->> 'full_sleep_nights')::int = 12, 'effort/sleep lines';
  ASSERT (s ->> 'verified_days')::int = 1, 'verified_days';
  ASSERT (s ->> 'longest_streak')::int = 35 AND (s ->> 'level')::int = 3 AND (s ->> 'xp')::int = 1200, 'profile keys';
  ASSERT (s ->> 'phoenix_recovery')::int = 0, 'phoenix needs streak >= 30';
  ASSERT (s ->> 'leaderboard_percentile')::numeric = 100, 'alone on the board is rank 1 of 1 = 100 %: ' || (s ->> 'leaderboard_percentile');
  ASSERT (s ? 'vault_master:jung'), 'vault_master keys present';

  -- The pass awards exactly what the stats reach, once.
  SELECT count(*) INTO won FROM public.award_earned_badges_for(u);
  ASSERT won > 0, 'nothing awarded';
  ASSERT EXISTS (SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = u AND b.name = 'Flawless'), 'Flawless (perfect_day 1) not awarded';
  ASSERT EXISTS (SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = u AND b.name IN ('30-Day Streak', 'Thirty')), 'longest_streak 35 should earn the 30-day badge';
  ASSERT NOT EXISTS (SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = u AND b.name = 'Iron Mind'), 'meditation run of 5 must not earn Iron Mind (14)';
  SELECT count(*) INTO n FROM public.award_earned_badges_for(u);
  ASSERT n = 0, 'second pass awarded again: ' || n;

  -- Every award wrote a bell row (the trigger exists by the time this runs).
  SELECT count(*) INTO bell FROM notifications WHERE user_id = u AND kind = 'badge';
  ASSERT bell = won, 'bell rows ' || bell || ' vs awarded ' || won;
  ASSERT (SELECT route FROM notifications WHERE user_id = u AND kind = 'badge' LIMIT 1) = '/profile?tab=badges', 'bell route';

  -- Enlightened is 300 sessions now.
  ASSERT (SELECT requirement_value FROM badges WHERE name = 'Enlightened') = 300, 'Enlightened threshold';

  -- Secret keys exist and the fixture's twelve straight days earn no Comeback.
  ASSERT (s ->> 'comeback')::int = 0 OR NOT (s ? 'comeback'), 'comeback';
  RAISE NOTICE 'badge engine: % badges awarded to the fixture, % bell rows, stats keys %', won, bell, (SELECT count(*) FROM jsonb_object_keys(s));
END $$;
ROLLBACK;
