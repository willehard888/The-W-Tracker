-- The day snapshot grows to what a wearable actually brings.
--
-- Garmin Connect, Polar Flow, Oura and Strava all write to Apple Health, and
-- the app's HealthKit read is the channel through which their data arrives —
-- once that read works again (it had been dead since a58bd296; see
-- ios/App/App/HealthNight.swift). This adds what the rebuilt read carries and
-- the table lacked: distance, flights, the newest body-mass / body-fat /
-- VO2 max readings, and `sources` — the apps that wrote anything that day,
-- which is the founder-visible proof that "the Garmin data came through".
--
-- Same shape as v2 (20260702120000): COALESCE-merge so a partial sync never
-- nulls a value already known; `sources` merges as a set.

ALTER TABLE public.health_sync_snapshots
  ADD COLUMN IF NOT EXISTS distance_m    int,
  ADD COLUMN IF NOT EXISTS flights       int,
  ADD COLUMN IF NOT EXISTS body_mass_kg  numeric(5,2),
  ADD COLUMN IF NOT EXISTS body_fat_pct  numeric(4,1),
  ADD COLUMN IF NOT EXISTS vo2max        numeric(4,1),
  ADD COLUMN IF NOT EXISTS sources       text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.health_sync_snapshots.sources IS
  'Distinct HealthKit source-app names that contributed to this day (e.g. Garmin Connect, Oura, Apple Watch). Set-merged on upsert.';
COMMENT ON COLUMN public.health_sync_snapshots.source IS
  'Which integration wrote this row: healthkit today; polar / oura / strava / garmin when their direct webhooks exist.';

-- The two stale "reserved; not populated yet" notes on the night table:
-- HealthNight.swift has queried HRV (overnight SDNN average, ms) since Whealth OS.
COMMENT ON COLUMN public.health_night_metrics.hrv_sdnn IS
  'Overnight average HRV (SDNN, ms) from HealthKit. Populated by HealthNight.queryNight.';

-- ── upsert_health_snapshot v3 ────────────────────────────────────────────────
-- The earlier overloads are dropped, not kept: with every arg defaulted, two
-- overloads make a named-arg call that omits a later arg ambiguous ("function
-- is not unique"). No shipped client could reach the old ones anyway — the
-- read path that calls this was dead on every device.
DROP FUNCTION IF EXISTS public.upsert_health_snapshot(date, int, int, int, numeric, int, text);
DROP FUNCTION IF EXISTS public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int);

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
  _sources text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row health_sync_snapshots;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF _date IS NULL THEN RETURN jsonb_build_object('error', 'invalid_date'); END IF;

  INSERT INTO public.health_sync_snapshots
    (user_id, snapshot_date, steps, workout_minutes, workout_count, sleep_hours,
     active_kcal, source, mindful_minutes, distance_m, flights,
     body_mass_kg, body_fat_pct, vo2max, sources, last_synced_at)
  VALUES
    (v_user, _date, _steps, _workout_minutes, _workout_count, _sleep_hours,
     _active_kcal, _source, _mindful_minutes, _distance_m, _flights,
     _body_mass_kg, _body_fat_pct, _vo2max, COALESCE(_sources, '{}'), now())
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
      source          = EXCLUDED.source,
      last_synced_at  = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'snapshot_id', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int, int, int, numeric, numeric, numeric, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int, int, int, numeric, numeric, numeric, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
