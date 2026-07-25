-- ============================================================
-- Bug-hunt Batch 3: serialize the two concurrency-sensitive RPCs
--   B2  record_checkin              — double check-in race
--   B4  reward_referral_conversion  — double referral reward
--
-- Both bugs are the same shape: a read that decides "proceed" takes no row
-- lock, so two concurrent callers both pass the guard and each apply the
-- side effects. Fix: acquire a FOR UPDATE lock on the row the guard reads,
-- before the guard. Normal single-call behavior is unchanged; only genuinely
-- concurrent calls (double-tap / retry / multi-device / duplicate webhook)
-- are serialized.
-- ============================================================

-- ── B2: record_checkin — lock the profile row before the duplicate check ──
-- The duplicate check (SELECT max(checked_in_at)) took no lock, so two
-- simultaneous submits both passed it, both inserted a check-in row, and each
-- awarded XP + a streak increment. Locking the caller's profile row up front
-- makes the second caller block until the first commits; its duplicate check
-- then sees the fresh row and raises ALREADY_CHECKED_IN_TODAY.
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
  v_shields integer;
  v_missed integer;
  v_shield_used integer := 0;
  v_shield_earned boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- CONCURRENCY GUARD: lock this user's profile row up front so two simultaneous
  -- check-ins (double-tap, retry, multi-device) serialize. The second caller
  -- blocks here until the first commits, then its duplicate check below sees the
  -- freshly-inserted row and raises ALREADY_CHECKED_IN_TODAY — instead of both
  -- inserting a row and each awarding XP + a streak increment.
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
    xp_earned, proof_photo_url, journal_entry, habits
  ) VALUES (
    uid, now(), p_sleep_hours, p_workout, p_extra_workout, p_cold_shower,
    p_healthy_food, p_protein_intake, p_meditation_morning, p_meditation_evening,
    p_hydration_liters, p_no_phone_morning, p_no_phone_evening, p_reading,
    v_xp_to_add, p_proof_photo_url, p_journal_entry, COALESCE(p_habits, '{}'::jsonb)
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

-- ── B4: reward_referral_conversion — lock the referral row, gate the flip ──
-- The SELECT ... WHERE converted=false took no lock, so two concurrent
-- conversion webhooks both saw converted=false and each awarded +500 XP,
-- +1 referral_count, and milestone rewards. FOR UPDATE serializes them; the
-- second caller re-evaluates WHERE converted=false after the first commits,
-- finds nothing, and returns no_pending_referral. The AND converted=false on
-- the flip UPDATE is belt-and-suspenders so only the winning call flips it.
CREATE OR REPLACE FUNCTION public.reward_referral_conversion(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_id uuid;
  v_paid_count integer;
  v_milestones jsonb;
  v_badge_id uuid;
  v_rewards jsonb := '[]'::jsonb;
BEGIN
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referred_id = p_user AND converted = false
  LIMIT 1
  FOR UPDATE;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_pending_referral');
  END IF;

  UPDATE referrals
  SET converted = true, converted_at = now(), rewarded = true
  WHERE referred_id = p_user AND converted = false;

  UPDATE profiles
  SET xp = xp + 500,
      referral_count = referral_count + 1,
      updated_at = now()
  WHERE user_id = v_referrer_id;

  SELECT count(*) INTO v_paid_count
  FROM referrals
  WHERE referrer_id = v_referrer_id AND converted = true;

  SELECT COALESCE(referral_milestones_hit, '[]'::jsonb) INTO v_milestones
  FROM profiles WHERE user_id = v_referrer_id;

  IF v_paid_count >= 1 AND NOT (v_milestones ? '1') THEN
    UPDATE profiles SET xp = xp + 250,
      referral_milestones_hit = referral_milestones_hit || '["1"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 1 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["first_recruit"]'::jsonb;
  END IF;

  IF v_paid_count >= 3 AND NOT (v_milestones ? '3') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '30 days',
        referral_milestones_hit = referral_milestones_hit || '["3"]'::jsonb
    WHERE user_id = v_referrer_id;
    v_rewards := v_rewards || '["1_month_free"]'::jsonb;
  END IF;

  IF v_paid_count >= 5 AND NOT (v_milestones ? '5') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '60 days',
        referral_milestones_hit = referral_milestones_hit || '["5"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 5 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["2_months_free"]'::jsonb;
  END IF;

  -- 10 paid → 30 days Apex, TIME-LIMITED (no permanent is_apex_subscriber flag).
  IF v_paid_count >= 10 AND NOT (v_milestones ? '10') THEN
    UPDATE profiles
    SET apex_credits_until = GREATEST(COALESCE(apex_credits_until, now()), now()) + interval '30 days',
        referral_milestones_hit = referral_milestones_hit || '["10"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 10 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    PERFORM public.update_status_tier(v_referrer_id);
    v_rewards := v_rewards || '["1_month_apex"]'::jsonb;
  END IF;

  -- 25 paid → 1 year of membership credits (finite; was an unbounded 100 years).
  IF v_paid_count >= 25 AND NOT (v_milestones ? '25') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '365 days',
        referral_milestones_hit = referral_milestones_hit || '["25"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 25 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["one_year"]'::jsonb;
  END IF;

  -- 50 paid → Founders Circle: permanent Legend pin + Apex (deliberate top tier).
  IF v_paid_count >= 50 AND NOT (v_milestones ? '50') THEN
    UPDATE profiles
    SET legend_pinned = true,
        is_apex_subscriber = true,
        apex_subscription_started_at = COALESCE(apex_subscription_started_at, now()),
        referral_milestones_hit = referral_milestones_hit || '["50"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 50 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    PERFORM public.update_status_tier(v_referrer_id);
    v_rewards := v_rewards || '["founders_circle"]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'paid_count', v_paid_count, 'rewards', v_rewards);
END;
$function$;
