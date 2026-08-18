-- ============================================================
-- Sport persistence — the chosen workout sport finally survives submit
-- ============================================================
-- The check-in sport picker existed since day one, but the selection was
-- discarded on submit (client-only: XP collapsed into xp_earned, label into
-- feed-post prose). The AI coach therefore could not see sport history AT
-- ALL — "4 workouts" was a boolean count. This migration:
--   1. daily_checkins.sport            (nullable text — sport id from
--                                       src/lib/sports.ts; old rows stay null)
--   2. coach_athlete_profile.sports[]  ("what do you train" — the coach's
--                                       standing sport context; NOT hobbies,
--                                       which the persona uses for recovery
--                                       framing)
--   3. record_checkin v6: + p_sport DEFAULT NULL. The 17-param v5 signature
--      is DROPPED first — CREATE OR REPLACE with a new arg list would create
--      an OVERLOAD and make 17-arg calls (old clients, offline queues)
--      ambiguous. With DEFAULT NULL the old call shape keeps working.
-- ============================================================

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS sport text;

ALTER TABLE public.coach_athlete_profile
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}';

DROP FUNCTION IF EXISTS public.record_checkin(
  numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, boolean, boolean, boolean, integer, text, text, integer, jsonb
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
  p_habits jsonb DEFAULT '{}'::jsonb,
  p_sport text DEFAULT NULL
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
  v_shields integer;
  v_missed integer;
  v_shield_used integer := 0;
  v_shield_earned boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- CONCURRENCY GUARD: lock this user's profile row up front so two simultaneous
  -- check-ins (double-tap, retry, multi-device) serialize.
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = uid FOR UPDATE;

  v_offset := make_interval(mins => COALESCE(p_tz_offset_minutes, 0));
  v_local_today := (now() - v_offset)::date;

  SELECT max(checked_in_at) INTO v_prev
  FROM public.daily_checkins
  WHERE user_id = uid;

  IF v_prev IS NOT NULL
     AND (v_prev - v_offset)::date = v_local_today THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY';
  END IF;

  v_shields := COALESCE(v_profile.streak_shields, 0);

  -- Anti-cheat XP ceiling (membership-neutral; identical for everyone).
  v_base := 0;
  IF p_sleep_hours IS NOT NULL AND p_sleep_hours >= 7 AND p_sleep_hours <= 12 THEN v_base := v_base + 25; END IF;
  IF p_workout THEN v_base := v_base + 35; END IF;
  IF COALESCE(p_hydration_liters, 0) >= 3 THEN v_base := v_base + 20; END IF;
  IF p_meditation_morning = true OR p_meditation_evening = true THEN v_base := v_base + 15; END IF;
  v_base := v_base + 40;
  IF p_proof_photo_url IS NOT NULL THEN v_base := v_base + 30; END IF;
  v_xp_ceiling := v_base + 60 + 10;

  v_xp_to_add := GREATEST(0, LEAST(COALESCE(p_xp_earned, 0), v_xp_ceiling));

  INSERT INTO public.daily_checkins (
    user_id, checked_in_at, sleep_hours, workout, extra_workout, cold_shower,
    healthy_food, protein_intake, meditation_morning, meditation_evening,
    hydration_liters, no_phone_morning, no_phone_evening, reading,
    xp_earned, proof_photo_url, journal_entry, habits, sport
  ) VALUES (
    uid, now(), p_sleep_hours, p_workout, p_extra_workout, p_cold_shower,
    p_healthy_food, p_protein_intake, p_meditation_morning, p_meditation_evening,
    p_hydration_liters, p_no_phone_morning, p_no_phone_evening, p_reading,
    v_xp_to_add, p_proof_photo_url, p_journal_entry, COALESCE(p_habits, '{}'::jsonb),
    NULLIF(left(COALESCE(p_sport, ''), 32), '')
  )
  RETURNING id INTO v_checkin_id;

  -- ── Streak with shields ──────────────────────────────────────────────────
  IF v_prev IS NULL THEN
    v_new_streak := 1;
  ELSE
    v_prev_local := (v_prev - v_offset)::date;
    IF v_prev_local = v_local_today - 1 THEN
      v_new_streak := COALESCE(v_profile.streak, 0) + 1;             -- consecutive
    ELSIF v_prev_local >= v_local_today THEN
      v_new_streak := GREATEST(COALESCE(v_profile.streak, 0), 1);    -- guard
    ELSE
      v_missed := (v_local_today - v_prev_local) - 1;                -- days skipped
      IF v_missed >= 1 AND v_shields >= v_missed THEN
        v_shield_used := v_missed;                                   -- shields save it
        v_shields := v_shields - v_missed;
        v_new_streak := COALESCE(v_profile.streak, 0) + 1;
      ELSE
        v_streak_broken := true;                                    -- streak breaks
        v_new_streak := 1;
      END IF;
    END IF;
  END IF;

  -- Earn a shield at each 7-day milestone (cap 3).
  IF v_new_streak > 0 AND v_new_streak % 7 = 0 AND v_shields < 3 THEN
    v_shields := v_shields + 1;
    v_shield_earned := true;
  END IF;

  v_new_xp := COALESCE(v_profile.xp, 0) + v_xp_to_add;
  v_new_level := floor(v_new_xp / 500) + 1;
  v_longest := GREATEST(COALESCE(v_profile.longest_streak, 0), v_new_streak);

  UPDATE public.profiles
     SET xp = v_new_xp,
         level = v_new_level,
         streak = v_new_streak,
         longest_streak = v_longest,
         streak_shields = v_shields,
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
    'streak_broken', v_streak_broken,
    'shield_used', v_shield_used,
    'shield_earned', v_shield_earned,
    'shields_remaining', v_shields
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_checkin(
  numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, boolean, boolean, boolean, integer, text, text, integer, jsonb, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
