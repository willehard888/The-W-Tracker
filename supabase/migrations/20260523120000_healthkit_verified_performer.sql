-- Apple HealthKit verification layer
--
-- Goal: prove the user actually did what they checked in for. Cuts
-- self-reporting noise + creates a "Verified Performer" badge.
--
-- Data flow:
--   1. iOS app reads HealthKit (HKWorkout / HKQuantityTypeIdentifierStepCount
--      / HKCategoryTypeIdentifierSleepAnalysis) via @perfood/capacitor-healthkit
--   2. Client upserts a daily snapshot into health_sync_snapshots — one row
--      per user per local date
--   3. When user submits daily_checkin, edge logic compares claim vs
--      snapshot and stamps daily_checkins.verified_at + verified_signals
--
-- Privacy: snapshots are aggregate (no raw heart-rate streams, no GPS).
-- User can revoke HealthKit auth in iOS Settings; sync just stops.
-- RLS enforces user-only access.

CREATE TABLE IF NOT EXISTS public.health_sync_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  -- The date this snapshot describes (user's local date — captured client-side).
  snapshot_date   date NOT NULL,
  -- Aggregate signals — all optional because permissions are per-type.
  steps           int,
  workout_minutes int,    -- sum of HKWorkout durations for the day
  workout_count   int,
  sleep_hours     numeric(4,2),
  active_kcal     int,
  -- Diagnostic — when iOS last pushed, for staleness checks.
  last_synced_at  timestamptz NOT NULL DEFAULT now(),
  -- Source: "healthkit" today; could be "googlefit" later.
  source          text NOT NULL DEFAULT 'healthkit',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One snapshot per user per date — UPSERT on (user_id, snapshot_date)
CREATE UNIQUE INDEX IF NOT EXISTS health_sync_snapshots_user_date_unique
  ON public.health_sync_snapshots (user_id, snapshot_date);

CREATE INDEX IF NOT EXISTS health_sync_snapshots_user_recent_idx
  ON public.health_sync_snapshots (user_id, snapshot_date DESC);

ALTER TABLE public.health_sync_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health snapshots"
  ON public.health_sync_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health snapshots"
  ON public.health_sync_snapshots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health snapshots"
  ON public.health_sync_snapshots FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER health_sync_snapshots_updated_at
  BEFORE UPDATE ON public.health_sync_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Verified-check-in columns on daily_checkins ─────────────────────────
-- Single row per check-in; we don't need a separate table.
--   verified_at = timestamp when verification was stamped (NULL = unverified)
--   verified_signals = jsonb summary of which claims passed HealthKit check
ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_signals jsonb;

-- ── RPC: upsert_health_snapshot ─────────────────────────────────────────
-- Called by the iOS client when HealthKit data is fetched. Idempotent.
CREATE OR REPLACE FUNCTION public.upsert_health_snapshot(
  _date date,
  _steps int DEFAULT NULL,
  _workout_minutes int DEFAULT NULL,
  _workout_count int DEFAULT NULL,
  _sleep_hours numeric DEFAULT NULL,
  _active_kcal int DEFAULT NULL,
  _source text DEFAULT 'healthkit'
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
    (user_id, snapshot_date, steps, workout_minutes, workout_count, sleep_hours, active_kcal, source, last_synced_at)
  VALUES
    (v_user, _date, _steps, _workout_minutes, _workout_count, _sleep_hours, _active_kcal, _source, now())
  ON CONFLICT (user_id, snapshot_date) DO UPDATE
  SET steps           = COALESCE(EXCLUDED.steps, health_sync_snapshots.steps),
      workout_minutes = COALESCE(EXCLUDED.workout_minutes, health_sync_snapshots.workout_minutes),
      workout_count   = COALESCE(EXCLUDED.workout_count, health_sync_snapshots.workout_count),
      sleep_hours     = COALESCE(EXCLUDED.sleep_hours, health_sync_snapshots.sleep_hours),
      active_kcal     = COALESCE(EXCLUDED.active_kcal, health_sync_snapshots.active_kcal),
      source          = EXCLUDED.source,
      last_synced_at  = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'snapshot_id', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text) TO authenticated;

-- ── RPC: verify_checkin ─────────────────────────────────────────────────
-- Called server-side (or by the client after submit). Compares the
-- check-in's self-reported claims against the matching HealthKit snapshot.
--
-- Verification rules (intentionally lenient on first iteration):
--   - workout=true verified if (workout_count >= 1 OR workout_minutes >= 15)
--   - sleep_hours ±1h tolerance vs HealthKit sleep_hours
--   - At least 2 signals must match for the check-in to count as "verified"
--   - Returns the jsonb that's persisted to verified_signals + verified_at
CREATE OR REPLACE FUNCTION public.verify_checkin(_checkin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_checkin   daily_checkins;
  v_snapshot  health_sync_snapshots;
  v_signals   jsonb := '{}'::jsonb;
  v_match_count int := 0;
  v_total_claims int := 0;
  v_verified bool := false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_checkin FROM public.daily_checkins
   WHERE id = _checkin_id AND user_id = v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'checkin_not_found'); END IF;

  -- Pull the snapshot for this check-in's local date.
  SELECT * INTO v_snapshot FROM public.health_sync_snapshots
   WHERE user_id = v_user
     AND snapshot_date = (v_checkin.checked_in_at AT TIME ZONE 'UTC')::date;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_healthkit_snapshot');
  END IF;

  -- Workout claim
  IF v_checkin.workout = true THEN
    v_total_claims := v_total_claims + 1;
    IF v_snapshot.workout_count >= 1 OR v_snapshot.workout_minutes >= 15 THEN
      v_match_count := v_match_count + 1;
      v_signals := v_signals || jsonb_build_object('workout', jsonb_build_object(
        'matched', true,
        'workout_count', v_snapshot.workout_count,
        'workout_minutes', v_snapshot.workout_minutes
      ));
    ELSE
      v_signals := v_signals || jsonb_build_object('workout', jsonb_build_object('matched', false));
    END IF;
  END IF;

  -- Sleep claim (±1h tolerance)
  IF v_checkin.sleep_hours IS NOT NULL AND v_snapshot.sleep_hours IS NOT NULL THEN
    v_total_claims := v_total_claims + 1;
    IF abs(v_checkin.sleep_hours - v_snapshot.sleep_hours) <= 1.0 THEN
      v_match_count := v_match_count + 1;
      v_signals := v_signals || jsonb_build_object('sleep', jsonb_build_object(
        'matched', true,
        'claimed_h', v_checkin.sleep_hours,
        'healthkit_h', v_snapshot.sleep_hours
      ));
    ELSE
      v_signals := v_signals || jsonb_build_object('sleep', jsonb_build_object(
        'matched', false,
        'claimed_h', v_checkin.sleep_hours,
        'healthkit_h', v_snapshot.sleep_hours
      ));
    END IF;
  END IF;

  -- Steps bonus signal — if user has >=8k steps logged, that's always a
  -- "verified active day" regardless of explicit claim.
  IF v_snapshot.steps IS NOT NULL AND v_snapshot.steps >= 8000 THEN
    v_match_count := v_match_count + 1;
    v_signals := v_signals || jsonb_build_object('steps', jsonb_build_object(
      'matched', true,
      'count', v_snapshot.steps
    ));
  END IF;

  -- Verified threshold: at least 2 matching signals OR 1 match if only 1 claim.
  v_verified := v_match_count >= 2 OR (v_total_claims = 1 AND v_match_count >= 1);

  -- Persist
  UPDATE public.daily_checkins
     SET verified_at = CASE WHEN v_verified THEN now() ELSE NULL END,
         verified_signals = v_signals
   WHERE id = _checkin_id;

  RETURN jsonb_build_object(
    'ok', true,
    'verified', v_verified,
    'matches', v_match_count,
    'claims', v_total_claims,
    'signals', v_signals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_checkin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_checkin(uuid) TO authenticated;

-- ── Profile-level "Verified Performer" computation ──────────────────────
-- Lightweight rolling stat: % of last 14 check-ins that are HealthKit-verified.
-- Used by UI to award the "Verified Performer" badge (≥70% over last 14 days).
CREATE OR REPLACE FUNCTION public.user_verified_performer_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'window_days',   14,
    'total_checkins', count(*),
    'verified_count', count(*) FILTER (WHERE verified_at IS NOT NULL),
    'verified_pct',
      CASE WHEN count(*) = 0 THEN 0
           ELSE round((count(*) FILTER (WHERE verified_at IS NOT NULL))::numeric * 100 / count(*))
      END,
    'is_verified_performer',
      count(*) >= 7 AND
      (count(*) FILTER (WHERE verified_at IS NOT NULL))::numeric / GREATEST(count(*), 1) >= 0.70
  )
  FROM public.daily_checkins
  WHERE user_id = _user_id
    AND checked_in_at >= now() - INTERVAL '14 days';
$$;

REVOKE ALL ON FUNCTION public.user_verified_performer_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_verified_performer_stats(uuid) TO authenticated, service_role;
