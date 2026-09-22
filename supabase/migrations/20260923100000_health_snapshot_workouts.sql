-- The day's workouts keep their sport.
--
-- HealthNight reads every workout Apple Health holds for the day — a Polar
-- tennis match arrives with its sport, minutes, calories and source name — and
-- the client kept only a count and a total of minutes. The sport reached the
-- server nowhere: `health_sync_snapshots` had no column for it, so the coach,
-- the brief and the verified badge knew "62 minutes" and not "tennis".
--
-- `workouts` is the client's list for the day (replaced whole on every sync —
-- Health's list is complete, a merge would resurrect a deleted session);
-- `primary_sport` is the longest session's sport id (src/lib/sports.ts).
-- The client writes the jsonb, so it is re-shaped here: known keys only,
-- numbers clamped, at most 20 rows.

ALTER TABLE public.health_sync_snapshots
  ADD COLUMN IF NOT EXISTS primary_sport text,
  ADD COLUMN IF NOT EXISTS workouts jsonb NOT NULL DEFAULT '[]'::jsonb;

-- One function, two new defaulted args: a client on the previous build calls
-- it by the old names and gets NULLs. The old signature is dropped first — a
-- CREATE with a different arg list would leave an overload, and a named-arg
-- call that omits a later arg is then "not unique" (the v3 lesson).
DROP FUNCTION IF EXISTS public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int, int, int, numeric, numeric, numeric, text[]);

CREATE OR REPLACE FUNCTION public.upsert_health_snapshot(
  _date date,
  _steps int DEFAULT NULL,
  _workout_minutes int DEFAULT NULL,
  _workout_count int DEFAULT NULL,
  _sleep_hours numeric DEFAULT NULL,
  _active_kcal int DEFAULT NULL,
  _source text DEFAULT 'healthkit',
  _mindful_minutes int DEFAULT NULL,
  _distance_m int DEFAULT NULL,
  _flights int DEFAULT NULL,
  _body_mass_kg numeric DEFAULT NULL,
  _body_fat_pct numeric DEFAULT NULL,
  _vo2max numeric DEFAULT NULL,
  _sources text[] DEFAULT NULL,
  _primary_sport text DEFAULT NULL,
  _workouts jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row health_sync_snapshots;
  v_workouts jsonb;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF _date IS NULL THEN RETURN jsonb_build_object('error', 'invalid_date'); END IF;

  -- Re-shape the client's list: known keys, bounded numbers, short strings.
  IF _workouts IS NOT NULL AND jsonb_typeof(_workouts) = 'array' THEN
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'sport',        left(w->>'sport', 32),
      'hk_type',      left(w->>'hk_type', 48),
      'duration_min', LEAST(1440, GREATEST(1, COALESCE((w->>'duration_min')::int, 1))),
      'kcal',         CASE WHEN (w->>'kcal') ~ '^\d+$' THEN LEAST(10000, (w->>'kcal')::int) END,
      'distance_m',   CASE WHEN (w->>'distance_m') ~ '^\d+$' THEN LEAST(500000, (w->>'distance_m')::int) END,
      'avg_hr',       CASE WHEN (w->>'avg_hr') ~ '^\d+$' THEN LEAST(250, (w->>'avg_hr')::int) END,
      'source',       left(w->>'source', 64),
      'start',        left(w->>'start', 40)
    ))), '[]'::jsonb)
    INTO v_workouts
    FROM (SELECT w FROM jsonb_array_elements(_workouts) AS w WHERE w ? 'sport' LIMIT 20) AS t;
  END IF;

  INSERT INTO public.health_sync_snapshots
    (user_id, snapshot_date, steps, workout_minutes, workout_count, sleep_hours,
     active_kcal, source, mindful_minutes, distance_m, flights,
     body_mass_kg, body_fat_pct, vo2max, sources, primary_sport, workouts, last_synced_at)
  VALUES
    (v_user, _date, _steps, _workout_minutes, _workout_count, _sleep_hours,
     _active_kcal, _source, _mindful_minutes, _distance_m, _flights,
     _body_mass_kg, _body_fat_pct, _vo2max, COALESCE(_sources, '{}'),
     left(_primary_sport, 32), COALESCE(v_workouts, '[]'::jsonb), now())
  ON CONFLICT (user_id, snapshot_date) DO UPDATE
  SET steps           = COALESCE(EXCLUDED.steps, health_sync_snapshots.steps),
      workout_minutes = COALESCE(EXCLUDED.workout_minutes, health_sync_snapshots.workout_minutes),
      workout_count   = COALESCE(EXCLUDED.workout_count, health_sync_snapshots.workout_count),
      sleep_hours     = COALESCE(EXCLUDED.sleep_hours, health_sync_snapshots.sleep_hours),
      active_kcal     = COALESCE(EXCLUDED.active_kcal, health_sync_snapshots.active_kcal),
      mindful_minutes = COALESCE(EXCLUDED.mindful_minutes, health_sync_snapshots.mindful_minutes),
      distance_m      = COALESCE(EXCLUDED.distance_m, health_sync_snapshots.distance_m),
      flights         = COALESCE(EXCLUDED.flights, health_sync_snapshots.flights),
      body_mass_kg    = COALESCE(EXCLUDED.body_mass_kg, health_sync_snapshots.body_mass_kg),
      body_fat_pct    = COALESCE(EXCLUDED.body_fat_pct, health_sync_snapshots.body_fat_pct),
      vo2max          = COALESCE(EXCLUDED.vo2max, health_sync_snapshots.vo2max),
      sources         = ARRAY(SELECT DISTINCT unnest(health_sync_snapshots.sources || EXCLUDED.sources) ORDER BY 1),
      primary_sport   = COALESCE(EXCLUDED.primary_sport, health_sync_snapshots.primary_sport),
      -- The list is the day as Health holds it now; NULL (an old build, or a
      -- day with no sessions yet) leaves what is there.
      workouts        = CASE WHEN v_workouts IS NULL THEN health_sync_snapshots.workouts ELSE EXCLUDED.workouts END,
      source          = EXCLUDED.source,
      last_synced_at  = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'snapshot_id', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int, int, int, numeric, numeric, numeric, text[], text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int, int, int, numeric, numeric, numeric, text[], text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
