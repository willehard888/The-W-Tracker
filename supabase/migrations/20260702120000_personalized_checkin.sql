-- ============================================================
-- Billion-dollar Check-in: personalized habits + HealthKit verification
-- ============================================================
-- What this adds:
--   1. profiles.checkin_habits text[]  — the user's chosen habit keys
--      (NULL/empty => classic default set, resolved client-side).
--      + set_checkin_habits(text[]) SECURITY DEFINER RPC.
--   2. daily_checkins.habits jsonb     — completions for habits that don't
--      map to a legacy boolean column (new evidence-based habits).
--   3. record_checkin v2 — same streak/day logic, PLUS p_habits jsonb.
--   4. health_sync_snapshots.mindful_minutes int + upsert_health_snapshot gains it.
--   5. verify_checkin v2 — also verifies meditation (mindful_minutes>0) and
--      awards a small, idempotent "verified" bonus XP (10 XP per verified signal).
-- Backward compatible: old clients (no p_habits / no mindful) still work.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles.checkin_habits + set_checkin_habits
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkin_habits text[];

CREATE OR REPLACE FUNCTION public.set_checkin_habits(p_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  UPDATE public.profiles
     SET checkin_habits = p_keys,   -- NULL clears back to the default set
         updated_at = now()
   WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'checkin_habits', p_keys);
END;
$$;

REVOKE ALL ON FUNCTION public.set_checkin_habits(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_checkin_habits(text[]) TO authenticated;

-- ------------------------------------------------------------
-- 2. daily_checkins.habits jsonb
-- ------------------------------------------------------------
ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS habits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_bonus_xp int NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 3. record_checkin v2  (drop old 16-arg, create 17-arg with p_habits)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_checkin(
  numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, boolean, boolean, boolean, integer, text, text, integer
);

CREATE OR REPLACE FUNCTION public.record_checkin(
  p_sleep_hours numeric,
  p_workout boolean,
  p_extra_workout boolean,
  p_cold_shower boolean,
  p_healthy_food boolean,
  p_protein_intake boolean,
  p_meditation_morning boolean,
  p_meditation_evening boolean,
  p_hydration_liters numeric,
  p_no_phone_morning boolean,
  p_no_phone_evening boolean,
  p_reading boolean,
  p_xp_earned integer,
  p_proof_photo_url text DEFAULT NULL,
  p_journal_entry text DEFAULT NULL,
  p_tz_offset_minutes integer DEFAULT 0,
  p_habits jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_offset interval;
  v_local_today date;
  v_prev timestamptz;
  v_prev_local date;
  v_profile public.profiles;
  v_checkin_id uuid;
  v_xp_to_add integer;
  v_xp_ceiling integer;
  v_base integer;
  v_new_xp integer;
  v_new_level integer;
  v_new_streak integer;
  v_longest integer;
  v_streak_broken boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_offset := make_interval(mins => COALESCE(p_tz_offset_minutes, 0));
  v_local_today := (now() - v_offset)::date;

  SELECT max(checked_in_at) INTO v_prev
  FROM public.daily_checkins
  WHERE user_id = uid;

  IF v_prev IS NOT NULL
     AND (v_prev - v_offset)::date = v_local_today THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = uid;

  -- ── Anti-cheat XP ceiling ────────────────────────────────────────────────
  -- The client computes XP, but the server clamps it to what the SUBMITTED
  -- habits could legitimately earn — not a flat 2000. This bounds daily XP so
  -- personalized/self-chosen habits can never inflate or break the scoring.
  -- XP does NOT depend on membership (all app users are paid); "elite" is an
  -- EARNED status tier, not a paid tier — so the ceiling is identical for everyone.
  --   Core habits: sleep 25, workout 35 (max sport), water 20, meditation 15.
  --   Optional habits: capped at 40 total (matches client OPTIONAL_XP_CAP).
  --   Proof photo 30 + daily-quest allowance 60 + a small margin.
  v_base := 0;
  IF p_sleep_hours IS NOT NULL AND p_sleep_hours >= 7 AND p_sleep_hours <= 12 THEN
    v_base := v_base + 25;
  END IF;
  IF p_workout THEN v_base := v_base + 35; END IF;
  IF COALESCE(p_hydration_liters, 0) >= 3 THEN v_base := v_base + 20; END IF;
  IF p_meditation_morning = true OR p_meditation_evening = true THEN v_base := v_base + 15; END IF;
  v_base := v_base + 40;  -- optional-habit allowance (client-capped)
  IF p_proof_photo_url IS NOT NULL THEN v_base := v_base + 30; END IF;  -- proof-photo bonus

  v_xp_ceiling := v_base + 60   -- daily-quest bonus allowance
                        + 10;   -- small safety margin

  v_xp_to_add := GREATEST(0, LEAST(COALESCE(p_xp_earned, 0), v_xp_ceiling));

  INSERT INTO public.daily_checkins (
    user_id, checked_in_at, sleep_hours, workout, extra_workout, cold_shower,
    healthy_food, protein_intake, meditation_morning, meditation_evening,
    hydration_liters, no_phone_morning, no_phone_evening, reading,
    xp_earned, proof_photo_url, journal_entry, habits
  ) VALUES (
    uid, now(), p_sleep_hours, p_workout, p_extra_workout, p_cold_shower,
    p_healthy_food, p_protein_intake, p_meditation_morning, p_meditation_evening,
    p_hydration_liters, p_no_phone_morning, p_no_phone_evening, p_reading,
    v_xp_to_add, p_proof_photo_url, p_journal_entry, COALESCE(p_habits, '{}'::jsonb)
  )
  RETURNING id INTO v_checkin_id;

  IF v_prev IS NULL THEN
    v_new_streak := 1;
  ELSE
    v_prev_local := (v_prev - v_offset)::date;
    IF v_prev_local = v_local_today - 1 THEN
      v_new_streak := COALESCE(v_profile.streak, 0) + 1;
    ELSIF v_prev_local >= v_local_today THEN
      v_new_streak := GREATEST(COALESCE(v_profile.streak, 0), 1);
    ELSE
      v_streak_broken := true;
      v_new_streak := 1;
    END IF;
  END IF;

  v_new_xp := COALESCE(v_profile.xp, 0) + v_xp_to_add;
  v_new_level := floor(v_new_xp / 500) + 1;
  v_longest := GREATEST(COALESCE(v_profile.longest_streak, 0), v_new_streak);

  UPDATE public.profiles
     SET xp = v_new_xp,
         level = v_new_level,
         streak = v_new_streak,
         longest_streak = v_longest,
         updated_at = now()
   WHERE user_id = uid;

  RETURN json_build_object(
    'checkin_id', v_checkin_id,
    'xp_earned', v_xp_to_add,
    'new_xp', v_new_xp,
    'old_level', COALESCE(v_profile.level, 1),
    'new_level', v_new_level,
    'old_streak', COALESCE(v_profile.streak, 0),
    'new_streak', v_new_streak,
    'streak_broken', v_streak_broken
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_checkin(
  numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, boolean, boolean, boolean, integer, text, text, integer, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_checkin(
  numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, boolean, boolean, boolean, integer, text, text, integer, jsonb
) TO authenticated;

-- ------------------------------------------------------------
-- 4. health_sync_snapshots.mindful_minutes + upsert_health_snapshot v2
-- ------------------------------------------------------------
ALTER TABLE public.health_sync_snapshots
  ADD COLUMN IF NOT EXISTS mindful_minutes int;

CREATE OR REPLACE FUNCTION public.upsert_health_snapshot(
  _date date,
  _steps int DEFAULT NULL,
  _workout_minutes int DEFAULT NULL,
  _workout_count int DEFAULT NULL,
  _sleep_hours numeric DEFAULT NULL,
  _active_kcal int DEFAULT NULL,
  _source text DEFAULT 'healthkit',
  _mindful_minutes int DEFAULT NULL
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
     active_kcal, source, mindful_minutes, last_synced_at)
  VALUES
    (v_user, _date, _steps, _workout_minutes, _workout_count, _sleep_hours,
     _active_kcal, _source, _mindful_minutes, now())
  ON CONFLICT (user_id, snapshot_date) DO UPDATE
  SET steps           = COALESCE(EXCLUDED.steps, health_sync_snapshots.steps),
      workout_minutes = COALESCE(EXCLUDED.workout_minutes, health_sync_snapshots.workout_minutes),
      workout_count   = COALESCE(EXCLUDED.workout_count, health_sync_snapshots.workout_count),
      sleep_hours     = COALESCE(EXCLUDED.sleep_hours, health_sync_snapshots.sleep_hours),
      active_kcal     = COALESCE(EXCLUDED.active_kcal, health_sync_snapshots.active_kcal),
      mindful_minutes = COALESCE(EXCLUDED.mindful_minutes, health_sync_snapshots.mindful_minutes),
      source          = EXCLUDED.source,
      last_synced_at  = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'snapshot_id', v_row.id);
END;
$$;

-- Old 7-arg signature keeps working for old clients; grant the new 8-arg one.
REVOKE ALL ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_health_snapshot(date, int, int, int, numeric, int, text, int) TO authenticated;

-- ------------------------------------------------------------
-- 5. verify_checkin v2  (adds meditation verification + idempotent bonus XP)
-- ------------------------------------------------------------
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
  v_bonus_target int := 0;   -- 10 XP per verified signal type
  v_bonus_delta  int := 0;
  v_profile public.profiles;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_checkin FROM public.daily_checkins
   WHERE id = _checkin_id AND user_id = v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'checkin_not_found'); END IF;

  SELECT * INTO v_snapshot FROM public.health_sync_snapshots
   WHERE user_id = v_user
     AND snapshot_date = (v_checkin.checked_in_at AT TIME ZONE 'UTC')::date;

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

  -- Idempotent bonus XP: only award the delta above what this check-in already gave.
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

REVOKE ALL ON FUNCTION public.verify_checkin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_checkin(uuid) TO authenticated;
