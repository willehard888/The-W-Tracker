-- ============================================================
-- Fix: verify_checkin timezone mismatch (flagship "Verified ✓" was broken)
-- ============================================================
-- The HealthKit snapshot is stored under the user's LOCAL calendar date
-- (upsert_health_snapshot _date = local YYYY-MM-DD). But verify_checkin looked
-- it up by the UTC date of checked_in_at, so for anyone whose local date != UTC
-- date at submit time (e.g. US evening, Asia early morning) the lookup returned
-- NOT FOUND → no verification, no bonus XP, no badge.
--
-- Fix: accept the client's local snapshot date (_snapshot_date) and match on it;
-- fall back to a ±1-day window around the target so it's robust either way.
-- ============================================================

DROP FUNCTION IF EXISTS public.verify_checkin(uuid);

CREATE OR REPLACE FUNCTION public.verify_checkin(
  _checkin_id uuid,
  _snapshot_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_checkin   daily_checkins;
  v_snapshot  health_sync_snapshots;
  v_target_date date;
  v_signals   jsonb := '{}'::jsonb;
  v_match_count int := 0;
  v_total_claims int := 0;
  v_verified bool := false;
  v_bonus_target int := 0;   -- 10 XP per verified signal type
  v_bonus_delta  int := 0;
  v_profile public.profiles;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_checkin FROM public.daily_checkins
   WHERE id = _checkin_id AND user_id = v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'checkin_not_found'); END IF;

  -- Prefer the client's local date; fall back to the UTC date of the check-in.
  v_target_date := COALESCE(_snapshot_date, (v_checkin.checked_in_at AT TIME ZONE 'UTC')::date);

  -- Match the snapshot on the target local date, tolerating a ±1-day tz skew.
  SELECT * INTO v_snapshot FROM public.health_sync_snapshots
   WHERE user_id = v_user
     AND snapshot_date BETWEEN v_target_date - 1 AND v_target_date + 1
   ORDER BY (snapshot_date = v_target_date) DESC, snapshot_date DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_healthkit_snapshot');
  END IF;

  -- Workout claim
  IF v_checkin.workout = true THEN
    v_total_claims := v_total_claims + 1;
    IF COALESCE(v_snapshot.workout_count,0) >= 1 OR COALESCE(v_snapshot.workout_minutes,0) >= 15 THEN
      v_match_count := v_match_count + 1;
      v_bonus_target := v_bonus_target + 10;
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
      v_bonus_target := v_bonus_target + 10;
      v_signals := v_signals || jsonb_build_object('sleep', jsonb_build_object(
        'matched', true, 'claimed_h', v_checkin.sleep_hours, 'healthkit_h', v_snapshot.sleep_hours
      ));
    ELSE
      v_signals := v_signals || jsonb_build_object('sleep', jsonb_build_object(
        'matched', false, 'claimed_h', v_checkin.sleep_hours, 'healthkit_h', v_snapshot.sleep_hours
      ));
    END IF;
  END IF;

  -- Meditation claim (morning or evening) verified by mindful minutes.
  IF (v_checkin.meditation_morning = true OR v_checkin.meditation_evening = true)
     AND COALESCE(v_snapshot.mindful_minutes,0) > 0 THEN
    v_match_count := v_match_count + 1;
    v_bonus_target := v_bonus_target + 10;
    v_signals := v_signals || jsonb_build_object('mindfulness', jsonb_build_object(
      'matched', true, 'minutes', v_snapshot.mindful_minutes
    ));
  END IF;

  -- Steps bonus signal
  IF v_snapshot.steps IS NOT NULL AND v_snapshot.steps >= 8000 THEN
    v_match_count := v_match_count + 1;
    v_bonus_target := v_bonus_target + 10;
    v_signals := v_signals || jsonb_build_object('steps', jsonb_build_object(
      'matched', true, 'count', v_snapshot.steps
    ));
  END IF;

  v_verified := v_match_count >= 2 OR (v_total_claims = 1 AND v_match_count >= 1);

  IF v_verified THEN
    v_bonus_delta := GREATEST(0, v_bonus_target - COALESCE(v_checkin.verified_bonus_xp, 0));
  ELSE
    v_bonus_delta := 0;
  END IF;

  UPDATE public.daily_checkins
     SET verified_at = CASE WHEN v_verified THEN now() ELSE NULL END,
         verified_signals = v_signals,
         verified_bonus_xp = CASE WHEN v_verified THEN v_bonus_target ELSE COALESCE(verified_bonus_xp,0) END
   WHERE id = _checkin_id;

  IF v_bonus_delta > 0 THEN
    SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user;
    UPDATE public.profiles
       SET xp = COALESCE(v_profile.xp,0) + v_bonus_delta,
           level = floor((COALESCE(v_profile.xp,0) + v_bonus_delta) / 500) + 1,
           updated_at = now()
     WHERE user_id = v_user;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'verified', v_verified,
    'matches', v_match_count,
    'claims', v_total_claims,
    'bonus_xp', v_bonus_target,
    'bonus_awarded', v_bonus_delta,
    'signals', v_signals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_checkin(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_checkin(uuid, date) TO authenticated;
