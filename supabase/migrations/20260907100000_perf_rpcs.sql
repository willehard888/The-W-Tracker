-- ============================================================
-- Perf: data RPCs — one round-trip where the client used to make many.
--
-- whealth_live_inputs   the 12 own-row reads behind the live Whealth Index
--                       (use-live-whealth-index.ts) folded into one jsonb.
--                       SECURITY INVOKER: every table keeps its own RLS, so
--                       the payload is exactly what the caller could already
--                       read row by row. lessons_total therefore counts only
--                       the vault_articles the caller may see (trial/paid) —
--                       that gate is intentional and matches the old
--                       head-count query.
-- season_board          the season leaderboard (fetchSeasonBoard) computed in
--                       SQL instead of pulling 2 000 profiles + every baseline
--                       to the phone. Same math, same order, plus the caller's
--                       rank over the FULL ranked set.
-- ============================================================

CREATE OR REPLACE FUNCTION public.whealth_live_inputs()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'checkins', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'checked_in_at', c.checked_in_at, 'sleep_hours', c.sleep_hours, 'hydration_liters', c.hydration_liters,
        'workout', c.workout, 'meditation_morning', c.meditation_morning, 'meditation_evening', c.meditation_evening,
        'protein_intake', c.protein_intake, 'healthy_food', c.healthy_food,
        'no_phone_morning', c.no_phone_morning, 'no_phone_evening', c.no_phone_evening,
        'journal_entry', c.journal_entry, 'habits', c.habits, 'verified_at', c.verified_at
      ) ORDER BY c.checked_in_at ASC), '[]'::jsonb)
      FROM daily_checkins c
      WHERE c.user_id = auth.uid() AND c.checked_in_at >= now() - interval '28 days'
    ),
    -- Ascending by night_date, like the coach-insights edge function. The old
    -- client path read recent_night_metrics (newest-first), which silently
    -- inverted recoveryParts' `slice(-7)` = "last 7 nights" into the OLDEST 7.
    'nights', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'night_date', n.night_date, 'resting_hr', n.resting_hr, 'hrv_sdnn', n.hrv_sdnn,
        'respiratory_rate', n.respiratory_rate, 'sleep_total_min', n.sleep_total_min,
        'sleep_deep_min', n.sleep_deep_min, 'sleep_rem_min', n.sleep_rem_min, 'sleep_start', n.sleep_start
      ) ORDER BY n.night_date ASC), '[]'::jsonb)
      FROM health_night_metrics n
      WHERE n.user_id = auth.uid() AND n.night_date >= (now() - interval '28 days')::date
    ),
    'days', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'snapshot_date', d.snapshot_date, 'steps', d.steps, 'active_kcal', d.active_kcal,
        'workout_minutes', d.workout_minutes, 'mindful_minutes', d.mindful_minutes
      ) ORDER BY d.snapshot_date ASC), '[]'::jsonb)
      FROM health_sync_snapshots d
      WHERE d.user_id = auth.uid() AND d.snapshot_date >= (now() - interval '28 days')::date
    ),
    'reflections', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'reflection_date', r.reflection_date, 'energy_1to5', r.energy_1to5, 'mood_1to5', r.mood_1to5,
        'win', r.win, 'friction', r.friction
      ) ORDER BY r.reflection_date ASC), '[]'::jsonb)
      FROM coach_reflections r
      WHERE r.user_id = auth.uid() AND r.reflection_date >= (now() - interval '28 days')::date
    ),
    'lessons', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('quiz_score', l.quiz_score)), '[]'::jsonb)
      FROM vault_lesson_progress l WHERE l.user_id = auth.uid()
    ),
    'lessons_total', (SELECT count(*) FROM vault_articles),
    -- Newest first: the PR/stall logic treats element 0 as the latest set.
    'lifts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'exercise_slug', w.exercise_slug, 'exercise_name', w.exercise_name, 'weight', w.weight, 'reps', w.reps
      ) ORDER BY w.logged_on DESC, w.updated_at DESC), '[]'::jsonb)
      FROM (
        SELECT exercise_slug, exercise_name, weight, reps, logged_on, updated_at
        FROM workout_set_logs WHERE user_id = auth.uid()
        ORDER BY logged_on DESC, updated_at DESC LIMIT 120
      ) w
    ),
    'tribe_count', (SELECT count(*) FROM tribe_members t WHERE t.user_id = auth.uid()),
    'friend_count', (
      SELECT count(*) FROM friendships f
      WHERE f.status = 'accepted' AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    ),
    'i_am', (SELECT a.i_am FROM coach_athlete_profile a WHERE a.user_id = auth.uid()),
    'meals', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('log_date', m.log_date, 'kcal', m.kcal, 'protein_g', m.protein_g)), '[]'::jsonb)
      FROM meal_logs m
      WHERE m.user_id = auth.uid() AND m.log_date >= (now() - interval '28 days')::date
    ),
    -- Newest first: the client picks the first target whose effective_from <= day.
    'targets', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('effective_from', t.effective_from, 'protein_g', t.protein_g)
                                ORDER BY t.effective_from DESC), '[]'::jsonb)
      FROM nutrition_targets t WHERE t.user_id = auth.uid()
    )
  );
$$;
REVOKE ALL ON FUNCTION public.whealth_live_inputs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whealth_live_inputs() TO authenticated;

-- Universe = profiles with xp > 0; season_points = xp above this season's
-- baseline (no baseline → 0 → hidden: only people who competed THIS season
-- are listed). Order: season_points DESC, xp DESC, user_id (deterministic).
-- profiles and leaderboard_season_baselines are readable by every member
-- (USING (true)), so SECURITY INVOKER costs nothing and adds no new exposure.
CREATE OR REPLACE FUNCTION public.season_board(p_season_id uuid, p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH scored AS (
    SELECT p.user_id, p.username, p.xp, p.level, p.streak, p.avatar_url, p.status_tier,
           GREATEST(p.xp - COALESCE(b.baseline_xp, p.xp), 0) AS season_points
    FROM profiles p
    LEFT JOIN leaderboard_season_baselines b ON b.season_id = p_season_id AND b.user_id = p.user_id
    WHERE p.xp > 0
  ), ranked AS (
    SELECT s.*, row_number() OVER (ORDER BY s.season_points DESC, s.xp DESC, s.user_id) AS rn
    FROM scored s WHERE s.season_points > 0
  )
  SELECT jsonb_build_object(
    'top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', r.user_id, 'username', r.username, 'xp', r.xp, 'level', r.level, 'streak', r.streak,
        'avatar_url', r.avatar_url, 'status_tier', r.status_tier, 'season_points', r.season_points
      ) ORDER BY r.rn)
      FROM ranked r WHERE r.rn <= LEAST(GREATEST(p_limit, 1), 200)
    ), '[]'::jsonb),
    'my_rank', (SELECT r.rn FROM ranked r WHERE r.user_id = auth.uid()),
    'total', (SELECT count(*) FROM ranked)
  );
$$;
REVOKE ALL ON FUNCTION public.season_board(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.season_board(uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
