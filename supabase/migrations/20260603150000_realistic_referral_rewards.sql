-- ============================================================
-- Realistic referral rewards
-- ============================================================
-- Fixes vs the previous reward_referral_conversion:
--   * Milestone 10 ("30 days Apex") wrongly set is_apex_subscriber = true — a
--     PERMANENT flag that update_status_tier honours forever — so the 30-day
--     reward was actually permanent Apex. Now grants only the time-limited
--     apex_credits_until (which expires), matching what's advertised.
--   * Milestone 25 ("Lifetime") set membership_credits_until to now()+100 years
--     — an unbounded liability. Now a finite 365-day (1 year) credit.
--   * Milestone 50 (Founders Circle) stays permanent Legend + Apex — 50 PAID
--     conversions is a deliberate, rarely-reached top reward.
-- Everything else (paid-only conversion, anti-fraud guards, milestone idempotency
-- via referral_milestones_hit) is unchanged.
-- ============================================================

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
