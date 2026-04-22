-- 1. Add new profile columns for Apex credits & Legend pin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apex_credits_until timestamptz,
  ADD COLUMN IF NOT EXISTS legend_pinned boolean NOT NULL DEFAULT false;

-- 2. Insert Founders Circle badge (50 paid referrals) if missing
INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
SELECT 'Founders Circle', 'Recruit 50 paid friends — Legend status pinned for life', '🔱', 'legendary', 'referral', 'paid_referrals', 50
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges
  WHERE requirement_type = 'paid_referrals' AND requirement_value = 50
);

-- Ensure 10-referral badge exists (Inner Circle Founder)
INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
SELECT 'Inner Circle Founder', 'Recruit 10 paid friends — earn 30 days of Apex Instant', '⚡', 'epic', 'referral', 'paid_referrals', 10
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges
  WHERE requirement_type = 'paid_referrals' AND requirement_value = 10
);

-- 3. Update has_active_access to honor apex_credits_until
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_elite = true
        OR is_apex_subscriber = true
        OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
        OR (membership_credits_until IS NOT NULL AND membership_credits_until > now())
        OR (referred_by IS NULL AND trial_started_at > now() - interval '7 days')
        OR (referred_by IS NOT NULL AND trial_started_at > now() - interval '14 days')
      )
  );
$function$;

-- 4. Update update_status_tier to honor legend_pinned
CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
  is_apex_sub boolean;
  is_legend_pin boolean;
  has_apex_credits boolean;
BEGIN
  PERFORM calculate_rank_score(target_user_id);

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  SELECT count(*) INTO user_rank FROM profiles
  WHERE rank_score > (SELECT rank_score FROM profiles WHERE user_id = target_user_id);

  IF total_users <= 1 THEN percentile := 100;
  ELSE percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;
  END IF;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';

  SELECT
    COALESCE(streak, 0),
    COALESCE(is_apex_subscriber, false),
    COALESCE(legend_pinned, false),
    (apex_credits_until IS NOT NULL AND apex_credits_until > now())
    INTO user_streak, is_apex_sub, is_legend_pin, has_apex_credits
  FROM profiles WHERE user_id = target_user_id;

  IF percentile >= 99.9 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'legend';
  ELSIF percentile >= 99 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'apex';
  ELSIF percentile >= 95 AND activity_days >= 14 AND user_streak >= 30 THEN new_tier := 'elite';
  ELSIF percentile >= 90 AND activity_days >= 14 AND user_streak >= 14 THEN new_tier := 'high_performer';
  ELSIF percentile >= 75 AND activity_days >= 7 THEN new_tier := 'performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'operator';
  ELSE new_tier := 'recruit';
  END IF;

  -- Legend pin (50 referrals) overrides everything
  IF is_legend_pin THEN
    new_tier := 'legend';
  -- Apex subscribers / Apex credits cannot drop below Apex
  ELSIF (is_apex_sub OR has_apex_credits) AND new_tier NOT IN ('apex', 'legend') THEN
    new_tier := 'apex';
  END IF;

  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$function$;

-- 5. Update reward_referral_conversion to add 10 (Apex Instant) and 50 (Founders Circle) milestones
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
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_pending_referral');
  END IF;

  UPDATE referrals
  SET converted = true, converted_at = now(), rewarded = true
  WHERE referred_id = p_user;

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

  -- 10 referrals → 1 Month Apex Instant (cumulative 30 days)
  IF v_paid_count >= 10 AND NOT (v_milestones ? '10') THEN
    UPDATE profiles
    SET apex_credits_until = GREATEST(COALESCE(apex_credits_until, now()), now()) + interval '30 days',
        is_apex_subscriber = true,
        referral_milestones_hit = referral_milestones_hit || '["10"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 10 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    PERFORM public.update_status_tier(v_referrer_id);
    v_rewards := v_rewards || '["1_month_apex"]'::jsonb;
  END IF;

  IF v_paid_count >= 25 AND NOT (v_milestones ? '25') THEN
    UPDATE profiles
    SET membership_credits_until = now() + interval '100 years',
        referral_milestones_hit = referral_milestones_hit || '["25"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 25 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["lifetime"]'::jsonb;
  END IF;

  -- 50 referrals → Founders Circle / permanent Legend pin
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