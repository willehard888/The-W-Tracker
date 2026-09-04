-- ============================================================
-- verify_checkin: corroborate the protein claim with the food diary
-- ============================================================
-- Body copied verbatim from 20260711120000_verify_checkin_local_date.sql with
-- ONE new block (protein diary) inserted after the steps signal and before the
-- bonus-delta computation. Nothing else changes: same signature, same
-- ±1-day snapshot window, same delta guard, same grants.
--
-- Protein signal: when the check-in claims protein_intake, read the
-- nutrition_targets row in force on the target date and the day's meal_logs
-- (trigger-derived protein_g — never re-derived from foods). Match when a
-- target exists AND ≥ 2 meals were logged AND logged protein ≥ 90 % of the
-- target (diary rows are self-logged estimates, so the bar sits under 100 %).
-- A match is worth the same +10 as every other verified signal.
--
-- Placement = v1 limitation: the block sits AFTER the "no HealthKit snapshot"
-- early return, so the diary only corroborates protein for HealthKit-connected
-- users. Non-HK users keep plain self-report until verify_checkin grows a
-- diary-only path.
--
-- Like the mindfulness and steps signals, a diary match only ever ADDS a
-- match (it never increments v_total_claims): counting it as a claim would
-- have un-verified every non-diary user whose single matched claim was sleep
-- or workout, via the `v_total_claims = 1` clause.
-- ============================================================

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
  v_protein_target numeric;
  v_protein_logged numeric;
  v_meals int;
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

  -- Protein claim corroborated by the food diary (see header).
  IF v_checkin.protein_intake = true THEN
    SELECT t.protein_g INTO v_protein_target
      FROM public.nutrition_targets t
     WHERE t.user_id = v_user AND t.effective_from <= v_target_date
     ORDER BY t.effective_from DESC
     LIMIT 1;

    SELECT COALESCE(SUM(m.protein_g), 0), COUNT(*) INTO v_protein_logged, v_meals
      FROM public.meal_logs m
     WHERE m.user_id = v_user AND m.log_date = v_target_date;

    IF v_protein_target IS NOT NULL AND v_meals >= 2 AND v_protein_logged >= 0.9 * v_protein_target THEN
      v_match_count := v_match_count + 1;
      v_bonus_target := v_bonus_target + 10;
      v_signals := v_signals || jsonb_build_object('nutrition', jsonb_build_object(
        'matched', true,
        'protein_g', round(v_protein_logged),
        'target_g', v_protein_target,
        'meals', v_meals
      ));
    ELSE
      v_signals := v_signals || jsonb_build_object('nutrition', jsonb_build_object('matched', false));
    END IF;
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
