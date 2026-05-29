-- ============================================================
-- R1 + T1 + T2: Server-owned check-in / streak + profile column lock
-- ============================================================
-- Problem this fixes:
--   * The profiles UPDATE policy ("via RPC only") still allowed any client
--     to write ANY column of their own row directly — including is_elite,
--     is_premium, xp, streak, status_tier — because Postgres row policies
--     cannot restrict columns. A user could self-grant Premium / inflate XP
--     from the JS console.
--   * The streak was computed and written client-side from Date.now(),
--     trivially spoofable, with a 48h rolling break that drifts.
--
-- Fix:
--   1. record_checkin(...) SECURITY DEFINER RPC inserts the daily_checkins
--      row, enforces ONE check-in per local calendar day, computes the
--      streak server-side, and owns the xp/level/streak writes.
--   2. A BEFORE UPDATE trigger on profiles blocks the protected columns
--      from being changed by the client roles (authenticated / anon).
--      SECURITY DEFINER functions (owned by postgres) and service_role
--      bypass it automatically because current_user differs there.
-- ============================================================

-- ------------------------------------------------------------
-- 1. record_checkin RPC
-- ------------------------------------------------------------
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
  p_tz_offset_minutes integer DEFAULT 0
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
  v_new_xp integer;
  v_new_level integer;
  v_new_streak integer;
  v_longest integer;
  v_streak_broken boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- JS getTimezoneOffset(): minutes the local zone is BEHIND UTC.
  -- local = UTC - offset  →  local_now = now() - (offset minutes)
  v_offset := make_interval(mins => COALESCE(p_tz_offset_minutes, 0));
  v_local_today := (now() - v_offset)::date;

  -- Most recent prior check-in (source of truth for streak + day guard)
  SELECT max(checked_in_at) INTO v_prev
  FROM public.daily_checkins
  WHERE user_id = uid;

  -- T2: one check-in per LOCAL calendar day
  IF v_prev IS NOT NULL
     AND (v_prev - v_offset)::date = v_local_today THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY';
  END IF;

  -- Defensive clamp — XP is computed client-side; cap to a sane ceiling
  v_xp_to_add := GREATEST(0, LEAST(COALESCE(p_xp_earned, 0), 2000));

  INSERT INTO public.daily_checkins (
    user_id, checked_in_at, sleep_hours, workout, extra_workout, cold_shower,
    healthy_food, protein_intake, meditation_morning, meditation_evening,
    hydration_liters, no_phone_morning, no_phone_evening, reading,
    xp_earned, proof_photo_url, journal_entry
  ) VALUES (
    uid, now(), p_sleep_hours, p_workout, p_extra_workout, p_cold_shower,
    p_healthy_food, p_protein_intake, p_meditation_morning, p_meditation_evening,
    p_hydration_liters, p_no_phone_morning, p_no_phone_evening, p_reading,
    v_xp_to_add, p_proof_photo_url, p_journal_entry
  )
  RETURNING id INTO v_checkin_id;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = uid;

  -- Streak: consecutive local days
  IF v_prev IS NULL THEN
    v_new_streak := 1;
  ELSE
    v_prev_local := (v_prev - v_offset)::date;
    IF v_prev_local = v_local_today - 1 THEN
      v_new_streak := COALESCE(v_profile.streak, 0) + 1;   -- consecutive day
    ELSIF v_prev_local >= v_local_today THEN
      v_new_streak := GREATEST(COALESCE(v_profile.streak, 0), 1); -- guard-safety
    ELSE
      v_streak_broken := true;                              -- missed a day
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
  numeric, boolean, boolean, boolean, integer, text, text, integer
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.record_checkin(
  numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, boolean, boolean, boolean, integer, text, text, integer
) TO authenticated;

-- ------------------------------------------------------------
-- 2. Lock protected profile columns against direct client writes
-- ------------------------------------------------------------
-- SECURITY INVOKER (default): the trigger runs as whatever role is current
-- at the time of the UPDATE. Direct client UPDATE -> current_user is
-- 'authenticated' (or 'anon'); SECURITY DEFINER functions owned by postgres
-- and service_role connections run as a different role and pass through.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.xp             IS DISTINCT FROM OLD.xp
    OR NEW.level          IS DISTINCT FROM OLD.level
    OR NEW.streak         IS DISTINCT FROM OLD.streak
    OR NEW.longest_streak IS DISTINCT FROM OLD.longest_streak
    OR NEW.status_tier    IS DISTINCT FROM OLD.status_tier
    OR NEW.is_elite       IS DISTINCT FROM OLD.is_elite
    OR NEW.is_premium     IS DISTINCT FROM OLD.is_premium
    OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
    OR NEW.referral_count IS DISTINCT FROM OLD.referral_count
    OR NEW.referral_code  IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by    IS DISTINCT FROM OLD.referred_by
    THEN
      RAISE EXCEPTION
        'Protected profile columns (xp/level/streak/status_tier/is_elite/is_premium/trial/referral) can only be changed via server functions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_columns_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
