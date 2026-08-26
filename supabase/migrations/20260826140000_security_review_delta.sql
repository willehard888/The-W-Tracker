-- Security fixes from the 2026-08-26 post-hardening review.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) record_checkin: close the tz-offset check-in-frequency bypass.
--
-- The one-per-local-day guard compared (v_prev - offset)::date to
-- (now() - offset)::date using the CALLER'S offset. Because the legal clamp
-- range (1561 min) exceeds a day (1440 min), an attacker could replay the
-- same check-in a minute later with a different offset that drops midnight
-- into the gap — farming unlimited streak days + XP (leaderboard integrity).
--
-- A wall-clock floor can't fix it: a legitimate 23:59 → 00:01 pair is two
-- valid check-ins minutes apart. The distinguishing signal is that the legit
-- pair uses the SAME offset while the attack swings it ~570 min. So we now
-- persist the offset per row and clamp the current offset to within 120 min
-- of the previous check-in's offset (generous for DST + real travel), which
-- makes the day comparison stable against retroactive shifting.
-- Also clamps an oversized p_habits jsonb (self-scoped row bloat).
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS tz_offset_minutes integer;

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
  v_prev_tz integer;
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
  v_tz integer;
  v_habits jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Clamp the tz offset to the real-world range (UTC-14h .. UTC+12h).
  v_tz := COALESCE(p_tz_offset_minutes, 0);
  IF v_tz < -840 OR v_tz > 720 THEN
    v_tz := 0;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = uid FOR UPDATE;

  -- Previous check-in + the offset it was recorded with. Locking the profile
  -- above serializes concurrent check-ins for this user, so this read is stable.
  SELECT checked_in_at, tz_offset_minutes INTO v_prev, v_prev_tz
  FROM public.daily_checkins
  WHERE user_id = uid
  ORDER BY checked_in_at DESC
  LIMIT 1;

  -- Anti-spoof: a new offset that swings more than 120 min from the previous
  -- check-in's offset is not a real timezone move — clamp it to the previous,
  -- which keeps the day boundary stable and defeats the midnight-shift farm.
  IF v_prev_tz IS NOT NULL AND abs(v_tz - v_prev_tz) > 120 THEN
    v_tz := v_prev_tz;
  END IF;

  v_offset := make_interval(mins => v_tz);
  v_local_today := (now() - v_offset)::date;

  IF v_prev IS NOT NULL
     AND (v_prev - v_offset)::date = v_local_today THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY';
  END IF;

  v_shields := COALESCE(v_profile.streak_shields, 0);

  v_base := 0;
  IF p_sleep_hours IS NOT NULL AND p_sleep_hours >= 7 AND p_sleep_hours <= 12 THEN v_base := v_base + 25; END IF;
  IF p_workout THEN v_base := v_base + 35; END IF;
  IF COALESCE(p_hydration_liters, 0) >= 3 THEN v_base := v_base + 20; END IF;
  IF p_meditation_morning = true OR p_meditation_evening = true THEN v_base := v_base + 15; END IF;
  v_base := v_base + 40;
  IF p_proof_photo_url IS NOT NULL THEN v_base := v_base + 30; END IF;
  v_xp_ceiling := v_base + 60 + 10;

  v_xp_to_add := GREATEST(0, LEAST(COALESCE(p_xp_earned, 0), v_xp_ceiling));

  -- Self-scoped, but cap runaway jsonb so a crafted client can't bloat the row.
  v_habits := COALESCE(p_habits, '{}'::jsonb);
  IF length(v_habits::text) > 4096 THEN
    v_habits := '{}'::jsonb;
  END IF;

  INSERT INTO public.daily_checkins (
    user_id, checked_in_at, sleep_hours, workout, extra_workout, cold_shower,
    healthy_food, protein_intake, meditation_morning, meditation_evening,
    hydration_liters, no_phone_morning, no_phone_evening, reading,
    xp_earned, proof_photo_url, journal_entry, habits, sport, tz_offset_minutes
  ) VALUES (
    uid, now(), p_sleep_hours, p_workout, p_extra_workout, p_cold_shower,
    p_healthy_food, p_protein_intake, p_meditation_morning, p_meditation_evening,
    p_hydration_liters, p_no_phone_morning, p_no_phone_evening, p_reading,
    v_xp_to_add, p_proof_photo_url, p_journal_entry, v_habits,
    NULLIF(left(COALESCE(p_sport, ''), 32), ''), v_tz
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
      v_missed := (v_local_today - v_prev_local) - 1;
      IF v_missed >= 1 AND v_shields >= v_missed THEN
        v_shield_used := v_missed;
        v_shields := v_shields - v_missed;
        v_new_streak := COALESCE(v_profile.streak, 0) + 1;
      ELSE
        v_streak_broken := true;
        v_new_streak := 1;
      END IF;
    END IF;
  END IF;

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

-- ─────────────────────────────────────────────────────────────────────────
-- 2) protect_profile_columns: created_at was client-writable, which let a
--    user reset it to now() and defeat the 7-day referral claim window (and
--    any other consumer of created_at). onboarded_at joins it.
-- ─────────────────────────────────────────────────────────────────────────
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
    OR NEW.streak_shields IS DISTINCT FROM OLD.streak_shields
    OR NEW.status_tier    IS DISTINCT FROM OLD.status_tier
    OR NEW.tier_division  IS DISTINCT FROM OLD.tier_division
    OR NEW.is_elite       IS DISTINCT FROM OLD.is_elite
    OR NEW.is_premium     IS DISTINCT FROM OLD.is_premium
    OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
    OR NEW.referral_count IS DISTINCT FROM OLD.referral_count
    OR NEW.referral_code  IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by    IS DISTINCT FROM OLD.referred_by
    -- membership / rank columns — server functions only (S1)
    OR NEW.is_apex_subscriber       IS DISTINCT FROM OLD.is_apex_subscriber
    OR NEW.apex_credits_until       IS DISTINCT FROM OLD.apex_credits_until
    OR NEW.membership_credits_until IS DISTINCT FROM OLD.membership_credits_until
    OR NEW.legend_pinned            IS DISTINCT FROM OLD.legend_pinned
    OR NEW.rank_score               IS DISTINCT FROM OLD.rank_score
    OR NEW.trust_multiplier         IS DISTINCT FROM OLD.trust_multiplier
    -- timezone — only via touch_activity's validated write (S6): a raw string
    -- here aborts every set-based AT TIME ZONE query (global push outage)
    OR NEW.timezone                 IS DISTINCT FROM OLD.timezone
    -- 2026-08-26: account age drives the referral claim window; onboarded_at
    -- gates the onboarding replay. Both were client-writable.
    OR NEW.created_at               IS DISTINCT FROM OLD.created_at
    OR NEW.onboarded_at             IS DISTINCT FROM OLD.onboarded_at
    THEN
      RAISE EXCEPTION
        'Protected profile columns can only be changed via server functions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) get_rank_score_breakdown: the own-data guard used current_user, which
--    inside a SECURITY DEFINER function is the owner, so the early return was
--    dead code and any user could read another's private anti-cheat numbers.
--    Only the guard line changes; signature and math are the original.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_rank_score_breakdown(p_user_id uuid)
RETURNS TABLE(
  active_days integer,
  active_days_score numeric,
  xp_score numeric,
  streak_score numeric,
  trust numeric,
  total numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_streak integer;
  v_trust numeric;
  v_avg7 numeric;
  v_max7 numeric;
  v_days integer;
  v_xp numeric;
  v_streak_s numeric;
  v_cons numeric;
BEGIN
  -- Own data only (or service role): the numbers are private.
  -- current_setting('role') survives SECURITY DEFINER entry; current_user
  -- becomes the function owner and made this guard dead code.
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND current_setting('role', true) IN ('authenticated', 'anon') THEN
    RETURN;
  END IF;
  SELECT streak, COALESCE(trust_multiplier, 1.0) INTO v_streak, v_trust FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(AVG(xp_earned), 0) INTO v_avg7
  FROM daily_checkins WHERE user_id = p_user_id AND checked_in_at >= now() - interval '7 days';
  SELECT COALESCE(MAX(sub.avg_xp), 1) INTO v_max7
  FROM (SELECT AVG(xp_earned) AS avg_xp FROM daily_checkins
        WHERE checked_in_at >= now() - interval '7 days' GROUP BY user_id) sub;
  v_xp := LEAST(100, (v_avg7 / GREATEST(v_max7, 1)) * 100);
  v_streak_s := LEAST(100, 25 * ln(COALESCE(v_streak, 0) + 1));
  SELECT count(DISTINCT date(checked_in_at)) INTO v_days
  FROM daily_checkins WHERE user_id = p_user_id AND checked_in_at >= now() - interval '30 days';
  v_cons := (v_days::numeric / 30.0) * 100;

  active_days := v_days;
  active_days_score := ROUND(v_cons, 1);
  xp_score := ROUND(v_xp, 1);
  streak_score := ROUND(v_streak_s, 1);
  trust := v_trust;
  total := ROUND((0.25 * v_xp + 0.20 * v_streak_s + 0.55 * v_cons) * v_trust, 2);
  RETURN NEXT;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) claim_referral: lock the caller row + conditional write so two
--    concurrent claims can't both pay +50 XP, and REVOKE the default
--    PUBLIC/anon EXECUTE the engine-v2 GRANT left behind.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_referral(p_referrer_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_me public.profiles;
  v_inserted boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_referrer_code IS NULL OR length(trim(p_referrer_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
  END IF;

  -- Lock my own row first: serializes concurrent claims so the checks below
  -- and the +50 XP payout can't both run twice.
  SELECT * INTO v_me FROM profiles WHERE user_id = v_user_id FOR UPDATE;

  -- Referral rewards are for bringing in NEW users (created_at is now
  -- protected from client writes, so this window can't be reset).
  IF v_me.created_at IS NOT NULL AND v_me.created_at < now() - interval '7 days' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'account_too_old');
  END IF;

  IF v_me.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  SELECT user_id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = trim(p_referrer_code)
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  UPDATE profiles SET referred_by = v_referrer_id, updated_at = now()
  WHERE user_id = v_user_id AND referred_by IS NULL;

  INSERT INTO referrals (referrer_id, referred_id, converted)
  VALUES (v_referrer_id, v_user_id, false)
  ON CONFLICT (referred_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Only pay the referrer when we actually created the link.
  IF v_inserted THEN
    UPDATE profiles SET xp = xp + 50, updated_at = now()
    WHERE user_id = v_referrer_id;
    RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
  END IF;

  RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5) tg_friendship_notify → push cooldown: DELETE + re-INSERT cycling defeated
--    the UNIQUE constraint and let anyone spam APNs + inbox rows at a stranger.
--    Skip both the ledger write and the push when a friend_request from this
--    actor to this user already exists within the last hour. Original body
--    otherwise unchanged.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_friendship_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_recent boolean;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      SELECT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = NEW.addressee_id
          AND actor_id = NEW.requester_id
          AND kind = 'friend_request'
          AND created_at > now() - interval '1 hour'
      ) INTO v_recent;
      IF v_recent THEN
        RETURN NEW; -- already pinged this pairing recently; no spam channel
      END IF;
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.requester_id;
      PERFORM notify_user(NEW.addressee_id, 'friend_request',
        '@' || COALESCE(v_name, 'someone') || ' wants to be friends',
        'Accept from your notifications.', '/notifications', NEW.requester_id, NEW.id);
      PERFORM dispatch_social_push('friend_request', NEW.addressee_id, NEW.requester_id, NEW.id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.addressee_id;
      PERFORM notify_user(NEW.requester_id, 'friend_accepted',
        '@' || COALESCE(v_name, 'someone') || ' accepted your friend request',
        'You can battle and message each other now.', '/friends', NEW.addressee_id, NEW.id);
      PERFORM dispatch_social_push('friend_accepted', NEW.requester_id, NEW.addressee_id, NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) notifications read-only guard: also pin id (an owner could re-key a row).
-- 7) webhook_events: key on (source, event_id) so a cross-provider id
--    collision can't swallow a real event; Stripe rows now carry app_user_id.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_notifications_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IN ('authenticated', 'anon') THEN
    IF NEW.id         IS DISTINCT FROM OLD.id
    OR NEW.user_id    IS DISTINCT FROM OLD.user_id
    OR NEW.kind       IS DISTINCT FROM OLD.kind
    OR NEW.title      IS DISTINCT FROM OLD.title
    OR NEW.body       IS DISTINCT FROM OLD.body
    OR NEW.route      IS DISTINCT FROM OLD.route
    OR NEW.actor_id   IS DISTINCT FROM OLD.actor_id
    OR NEW.ref_id     IS DISTINCT FROM OLD.ref_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only read_at may be updated on notifications';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_pkey;
ALTER TABLE public.webhook_events ADD PRIMARY KEY (source, event_id);

NOTIFY pgrst, 'reload schema';
