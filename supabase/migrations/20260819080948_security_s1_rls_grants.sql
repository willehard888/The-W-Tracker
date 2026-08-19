-- ============================================================
-- Security hardening S1 — money leaks + data exposure.
-- From the full-app security audit. Closes actively-exploitable holes:
--   P0  reward_referral_conversion / set_elite_status callable by clients
--       → free paid tiers + XP/membership minting
--   P1  kudos self-award XP minting; whole feed anon-readable;
--       record_checkin trusts client tz offset (multi-checkin/streak farm)
--   P2  direct_messages forgeable; ensure_tribe_challenge unguarded;
--       coach realtime DELETE-payload leak
-- Targeted revokes on the specific dangerous functions the audit named.
-- (A blanket sweep is unsafe: revoking FROM anon does NOT remove a grant held
-- via PUBLIC, and blindly re-granting authenticated would regress the
-- functions already correctly locked to service_role.)
-- ============================================================

-- ── P0: entitlement + referral RPCs → service-role only ──────
-- reward_referral_conversion is called only by the Stripe/RevenueCat
-- webhooks (after a real payment). set_elite_status is now written only by
-- those webhooks too — the client mirror in RevenueCatContext was removed.
-- REVOKE FROM PUBLIC removes the implicit CREATE-time grant (anon+authenticated
-- both inherit via PUBLIC); the explicit anon/authenticated revokes clear any
-- direct grants (set_elite_status had an explicit GRANT authenticated).
REVOKE ALL ON FUNCTION public.reward_referral_conversion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_referral_conversion(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.set_elite_status(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_elite_status(uuid, boolean) TO service_role;

-- Full-table recompute: internal (sync-streaks cron) only.
REVOKE ALL ON FUNCTION public.update_all_status_tiers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_all_status_tiers() TO service_role;

-- ── P2: worst directory leak — unbounded inviter list to anyone ─
-- Clamp the limit and take it off PUBLIC (authenticated-only).
REVOKE ALL ON FUNCTION public.get_top_inviters(integer) FROM PUBLIC, anon;
CREATE OR REPLACE FUNCTION public.get_top_inviters(p_limit integer DEFAULT 10)
RETURNS TABLE (user_id uuid, username text, avatar_url text, status_tier status_tier,
               converted_count bigint, signup_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.username, p.avatar_url, p.status_tier,
         count(r.id) FILTER (WHERE r.converted) AS converted_count,
         count(r.id) AS signup_count
  FROM profiles p
  LEFT JOIN referrals r ON r.referrer_id = p.user_id
  GROUP BY p.user_id, p.username, p.avatar_url, p.status_tier
  HAVING count(r.id) > 0
  ORDER BY converted_count DESC, signup_count DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;
GRANT EXECUTE ON FUNCTION public.get_top_inviters(integer) TO authenticated;

-- ── P1: kudos INSERT must target the post's own author ───────
-- (mirrors the correct tribe_post_kudos policy from 20260819064628)
DROP POLICY IF EXISTS "Users can give kudos" ON public.kudos;
CREATE POLICY "Users can give kudos" ON public.kudos FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = giver_id
  AND giver_id <> receiver_id
  AND EXISTS (
    SELECT 1 FROM public.feed_posts p
    WHERE p.id = kudos.post_id AND p.user_id = kudos.receiver_id
  )
);

-- ── P1: feed + kudos + leaderboard reads → authenticated only ─
-- (they were TO PUBLIC → anon dumped the whole social graph with the anon key)
DROP POLICY IF EXISTS "Feed viewable by everyone" ON public.feed_posts;
CREATE POLICY "Feed viewable by members" ON public.feed_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Comments viewable by everyone" ON public.feed_comments;
CREATE POLICY "Comments viewable by members" ON public.feed_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Reactions viewable by everyone" ON public.feed_reactions;
CREATE POLICY "Reactions viewable by members" ON public.feed_reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Kudos viewable by everyone" ON public.kudos;
CREATE POLICY "Kudos viewable by members" ON public.kudos
  FOR SELECT TO authenticated USING (true);

-- Leaderboard season tables (best-effort — names may vary; guarded).
DO $$ BEGIN
  DROP POLICY IF EXISTS "Seasons viewable by everyone" ON public.leaderboard_seasons;
  CREATE POLICY "Seasons viewable by members" ON public.leaderboard_seasons
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Champions viewable by everyone" ON public.leaderboard_champions;
  CREATE POLICY "Champions viewable by members" ON public.leaderboard_champions
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- ── P2: direct_messages — only the `read` flag may be updated ─
DROP POLICY IF EXISTS "Users can mark own received messages read" ON public.direct_messages;
CREATE POLICY "Receiver can mark read" ON public.direct_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

CREATE OR REPLACE FUNCTION public.tg_dm_read_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Content and routing are immutable after send; only `read` may flip.
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'only the read flag may be updated';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS direct_messages_read_only ON public.direct_messages;
CREATE TRIGGER direct_messages_read_only
  BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_dm_read_only();

-- ── P2: ensure_tribe_challenge requires membership ───────────
CREATE OR REPLACE FUNCTION public.ensure_tribe_challenge(p_tribe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week date := date_trunc('week', now())::date;
  v_members int;
BEGIN
  IF NOT public.is_tribe_member(p_tribe_id, auth.uid()) THEN
    RETURN; -- silently no-op for non-members (called defensively on load)
  END IF;
  IF EXISTS (SELECT 1 FROM tribe_challenges WHERE tribe_id = p_tribe_id AND week_start = v_week) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO v_members FROM tribe_members
  WHERE tribe_id = p_tribe_id AND status = 'active';
  INSERT INTO tribe_challenges (tribe_id, week_start, target)
  VALUES (p_tribe_id, v_week, GREATEST(5, v_members * 5))
  ON CONFLICT (tribe_id, week_start) DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_tribe_challenge(uuid) TO authenticated;
-- Note: the founded trigger calls this as the owner (a member), so new tribes
-- still get their first challenge.

-- ── P2: stop broadcasting full deleted coach rows over realtime ─
DO $$ BEGIN ALTER TABLE public.coach_daily_plans REPLICA IDENTITY DEFAULT;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.coach_mission_logs REPLICA IDENTITY DEFAULT;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ── P1: record_checkin — clamp the client-supplied tz offset ──
-- Verbatim recreation of the current function (20260818082050) with a single
-- validation guard added: an out-of-range offset let a user roll the "local
-- day" forward and bank multiple check-ins + streak days per real day.
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
  v_tz integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Clamp the tz offset to the real-world range (UTC-14h .. UTC+12h). Anything
  -- outside is a spoof attempt to shift "today" and farm extra check-ins.
  v_tz := COALESCE(p_tz_offset_minutes, 0);
  IF v_tz < -840 OR v_tz > 720 THEN
    v_tz := 0;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = uid FOR UPDATE;

  v_offset := make_interval(mins => v_tz);
  v_local_today := (now() - v_offset)::date;

  SELECT max(checked_in_at) INTO v_prev
  FROM public.daily_checkins
  WHERE user_id = uid;

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

NOTIFY pgrst, 'reload schema';
