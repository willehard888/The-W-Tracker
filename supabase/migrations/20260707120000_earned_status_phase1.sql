-- ============================================================
-- Earned Status Ladder — Phase 1: decouple status tier from payment
-- ============================================================
-- "Elite"/"Apex" meant two things: a PAID flag (is_elite / is_apex_subscriber)
-- AND an earned status_tier. update_status_tier even granted paid users a tier
-- FLOOR (is_apex_subscriber → Apex), so status was partly *bought*. Since all app
-- users are paid members, a paid "Elite" carries no status value.
--
-- This migration makes status_tier PURELY EARNED (performance only) and moves
-- paid-feature gating onto the existing has_premium() helper.
--   A. update_status_tier — performance-only, with an earned Legend path.
--   B. reward_referral_conversion — 50 referrals → Founder badge (+ finite
--      membership credit), NOT legend_pinned / permanent Apex.
--   C. feed_posts INSERT — gate on has_premium() (all paid members can post),
--      not the earned elite tier (which would lock most members out).
--   D. (optional) backfill: existing legend_pinned users → Founder badge + let
--      their tier recompute. Flagged — run only if you want that sweep.
-- ============================================================

-- ------------------------------------------------------------
-- A. update_status_tier — performance only (no paid / pinned influence)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
  user_score numeric;
BEGIN
  -- Founder/owner Legend override: `legend_pinned` is now set ONLY by hand for
  -- founder accounts — NEVER by payment or referrals (those paths were removed).
  -- It is a curated permanent Legend, not a bought/earned tier.
  IF (SELECT COALESCE(legend_pinned, false) FROM profiles WHERE user_id = target_user_id) THEN
    UPDATE profiles SET status_tier = 'legend' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  -- Everyone else: status is EARNED. No is_apex_subscriber / apex_credits / is_elite floor.
  PERFORM calculate_rank_score(target_user_id);
  SELECT rank_score INTO user_score FROM profiles WHERE user_id = target_user_id;

  IF user_score IS NULL OR user_score <= 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT rn INTO user_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles WHERE rank_score > 0
  ) r WHERE r.user_id = target_user_id;

  percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';

  SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = target_user_id;

  -- Purely earned ladder. Rank OR grind path for the mid tiers; Legend + Apex
  -- require the top percentile AND sustained streak + activity (no shortcut).
  IF    percentile >= 99 AND activity_days >= 30 AND user_streak >= 45 THEN
    new_tier := 'legend';
  ELSIF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN
    new_tier := 'apex';
  ELSIF percentile >= 80 OR (user_streak >= 30 AND activity_days >= 20) THEN
    new_tier := 'elite';
  ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14) THEN
    new_tier := 'high_performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN
    new_tier := 'performer';
  ELSIF percentile >= 25 AND activity_days >= 5 THEN
    new_tier := 'operator';
  ELSE
    new_tier := 'recruit';
  END IF;

  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$$;

-- ------------------------------------------------------------
-- B. reward_referral_conversion — Founder badge, not bought status
-- ------------------------------------------------------------
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

  -- 10 paid → 30 days of free MEMBERSHIP (a perk, NOT Apex status — status is earned).
  IF v_paid_count >= 10 AND NOT (v_milestones ? '10') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '30 days',
        referral_milestones_hit = referral_milestones_hit || '["10"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 10 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["1_month_free"]'::jsonb;
  END IF;

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

  -- 50 paid → Founders Circle: a permanent FOUNDER BADGE + long free-membership
  -- perk. Does NOT grant Legend / Apex status — status is earned by performance.
  IF v_paid_count >= 50 AND NOT (v_milestones ? '50') THEN
    UPDATE profiles
    SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '3650 days',
        referral_milestones_hit = referral_milestones_hit || '["50"]'::jsonb
    WHERE user_id = v_referrer_id;
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 50 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["founders_circle"]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'paid_count', v_paid_count, 'rewards', v_rewards);
END;
$function$;

-- ------------------------------------------------------------
-- C. feed_posts INSERT — all PAID members can post (has_premium), + staff
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Elite users can post" ON public.feed_posts;
DROP POLICY IF EXISTS "Members can post" ON public.feed_posts;
CREATE POLICY "Members can post"
ON public.feed_posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_premium(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  )
);

-- ------------------------------------------------------------
-- D. Founder legends — keep these accounts permanently Legend.
-- ------------------------------------------------------------
-- legend_pinned is a CURATED override (set only here, never by payment/referrals),
-- so these founder accounts stay Legend while everyone else earns their tier.
UPDATE public.profiles
   SET legend_pinned = true,
       status_tier = 'legend'
 WHERE lower(username) IN ('willehard', 'relentlessrise');
