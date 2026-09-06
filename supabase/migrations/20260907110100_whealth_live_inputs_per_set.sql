-- whealth_live_inputs: lifts are per-SET rows since 20260905140000
-- (workout_set_logs.set_index). The subquery read raw rows LIMIT 120, which a
-- 3-set prescription turned into ~40 exercise-days instead of 120, silently
-- shrinking the movement pillar's progression window. Now the heaviest set
-- per exercise per day, exactly what recent_workout_logs returns.
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
        -- Heaviest set per exercise per day (the same row recent_workout_logs
        -- returns): sets are per-row since 20260905140000, and the PR/stall
        -- logic reads one row as "what this exercise did that day".
        SELECT exercise_slug, exercise_name, weight, reps, logged_on, updated_at
        FROM (
          SELECT DISTINCT ON (exercise_slug, logged_on)
                 exercise_slug, exercise_name, weight, reps, logged_on, updated_at
          FROM workout_set_logs WHERE user_id = auth.uid()
          ORDER BY exercise_slug, logged_on DESC, weight DESC NULLS LAST, reps DESC NULLS LAST
        ) best
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

NOTIFY pgrst, 'reload schema';
