-- 1. Schema changes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_credits_until timestamptz,
  ADD COLUMN IF NOT EXISTS referral_milestones_hit jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS converted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_id_unique ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_converted_idx ON public.referrals(referrer_id, converted);
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles(referral_code);

-- 2. Seed referral badges (unique names to avoid collision)
INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
SELECT 'First Recruit', 'Invited your first paying member', '🎯', 'rare', 'social', 'paid_referrals', 1
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 1);

INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
SELECT 'Brand Ambassador', '5 paying members invited', '🌟', 'epic', 'social', 'paid_referrals', 5
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 5);

INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
SELECT 'Inner Circle Founder', '10 paying members invited', '👑', 'legendary', 'social', 'paid_referrals', 10
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 10);

INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
SELECT 'Kingmaker', '25 paying members invited — lifetime membership', '🏆', 'legendary', 'social', 'paid_referrals', 25
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 25);

-- 3. Update has_active_access
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_elite = true
        OR (membership_credits_until IS NOT NULL AND membership_credits_until > now())
        OR (referred_by IS NULL AND trial_started_at > now() - interval '7 days')
        OR (referred_by IS NOT NULL AND trial_started_at > now() - interval '14 days')
      )
  );
$$;

-- 4. claim_referral RPC
CREATE OR REPLACE FUNCTION public.claim_referral(p_referrer_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_existing_ref uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_referrer_code IS NULL OR length(trim(p_referrer_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
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

  SELECT referred_by INTO v_existing_ref FROM profiles WHERE user_id = v_user_id;
  IF v_existing_ref IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  UPDATE profiles SET referred_by = v_referrer_id, updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO referrals (referrer_id, referred_id, converted)
  VALUES (v_referrer_id, v_user_id, false)
  ON CONFLICT (referred_id) DO NOTHING;

  UPDATE profiles SET xp = xp + 50, updated_at = now()
  WHERE user_id = v_referrer_id;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
END;
$$;

-- 5. reward_referral_conversion RPC
CREATE OR REPLACE FUNCTION public.reward_referral_conversion(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF v_paid_count >= 10 AND NOT (v_milestones ? '10') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '180 days',
        referral_milestones_hit = referral_milestones_hit || '["10"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 10 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["6_months_free"]'::jsonb;
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

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'paid_count', v_paid_count, 'rewards', v_rewards);
END;
$$;

-- 6. get_top_inviters
CREATE OR REPLACE FUNCTION public.get_top_inviters(p_limit integer DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  status_tier status_tier,
  converted_count bigint,
  signup_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.user_id,
    p.username,
    p.avatar_url,
    p.status_tier,
    COUNT(r.id) FILTER (WHERE r.converted = true AND r.converted_at >= date_trunc('month', now()))::bigint AS converted_count,
    COUNT(r.id) FILTER (WHERE r.created_at >= date_trunc('month', now()))::bigint AS signup_count
  FROM profiles p
  LEFT JOIN referrals r ON r.referrer_id = p.user_id
  GROUP BY p.user_id, p.username, p.avatar_url, p.status_tier
  HAVING COUNT(r.id) FILTER (WHERE r.created_at >= date_trunc('month', now())) > 0
  ORDER BY converted_count DESC, signup_count DESC
  LIMIT p_limit;
$$;