-- ============================================================
-- Referral engine v2 — real value, no status rewards.
-- Founder decisions (2026-08-24):
--   · every 3 PAID conversions → +30 days membership credits, no cap
--   · recruit's 3rd check-in   → +250 XP to the referrer ("activated")
--   · status is never a reward: the milestone-10 Apex grant and the
--     milestone-50 legend_pinned/is_apex_subscriber grant are REMOVED
--     (grants already made stay — no retroactive revoke)
--   · badges stay as badges: 1 (+250 XP), 5, 10, 25, 50
-- Ledger note: referral_milestones_hit keeps its old string keys
-- ("1".."50"); credit grants use NEW keys c3, c6, c9 … so historic
-- users are never mis-skipped. Special case: "3" was the old 1-month
-- credit — c3 is skipped when "3" is already present.
-- ============================================================

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS activated_at timestamptz;

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
  v_credit_key text;
  v_badge_count integer;
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

  -- Every paid conversion: instant XP + the public count.
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

  -- ── The real reward: every 3rd paid friend = +30 days free membership ──
  IF v_paid_count % 3 = 0 THEN
    v_credit_key := 'c' || v_paid_count::text;
    -- "3" is the legacy 1-month key — its holders already got this month.
    IF NOT (v_milestones ? v_credit_key)
       AND NOT (v_paid_count = 3 AND v_milestones ? '3') THEN
      UPDATE profiles
      SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '30 days',
          referral_milestones_hit = referral_milestones_hit || jsonb_build_array(v_credit_key)
      WHERE user_id = v_referrer_id;
      v_rewards := v_rewards || '["free_month"]'::jsonb;
    END IF;
  END IF;

  -- ── Badge milestones: badges + XP only, never credits or status ──
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

  FOREACH v_badge_count IN ARRAY ARRAY[5, 10, 25, 50] LOOP
    IF v_paid_count >= v_badge_count AND NOT (v_milestones ? v_badge_count::text) THEN
      UPDATE profiles
      SET referral_milestones_hit = referral_milestones_hit || jsonb_build_array(v_badge_count::text)
      WHERE user_id = v_referrer_id;
      SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = v_badge_count LIMIT 1;
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
      END IF;
      v_rewards := v_rewards || jsonb_build_array('badge_' || v_badge_count::text);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'paid_count', v_paid_count, 'rewards', v_rewards);
END;
$function$;

-- Grants unchanged: service_role only (S1). Re-assert for safety.
REVOKE ALL ON FUNCTION public.reward_referral_conversion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_referral_conversion(uuid) TO service_role;

-- claim_referral is called by the CLIENT now (the capture bug fix) — make the
-- grant explicit instead of relying on the CREATE-time default.
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

-- ── Activation: the recruit's 3rd check-in pays the referrer +250 XP ──
CREATE OR REPLACE FUNCTION public.tg_referral_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkins integer;
  v_referrer uuid;
BEGIN
  BEGIN
    -- Cheap early exit: only users who WERE referred have a row here.
    SELECT referrer_id INTO v_referrer
    FROM referrals
    WHERE referred_id = NEW.user_id AND activated_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_referrer IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT count(*) INTO v_checkins FROM daily_checkins WHERE user_id = NEW.user_id;
    IF v_checkins < 3 THEN
      RETURN NEW;
    END IF;

    UPDATE referrals SET activated_at = now()
    WHERE referred_id = NEW.user_id AND activated_at IS NULL;

    UPDATE profiles SET xp = xp + 250, updated_at = now()
    WHERE user_id = v_referrer;

    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/notify-referral',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'referrer_id', v_referrer,
        'referred_id', NEW.user_id,
        'kind', 'activated'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- A reward hiccup must never break the recruit's own check-in.
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_checkins_referral_activation ON public.daily_checkins;
CREATE TRIGGER daily_checkins_referral_activation
  AFTER INSERT ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.tg_referral_activation();

-- list_my_referrals v2: expose activation state to the invites list.
DROP FUNCTION IF EXISTS public.list_my_referrals(integer);
CREATE OR REPLACE FUNCTION public.list_my_referrals(p_limit integer DEFAULT 20)
RETURNS TABLE(referred_username text, avatar_url text, converted boolean, activated_at timestamptz, created_at timestamptz, converted_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.username, p.avatar_url, r.converted, r.activated_at, r.created_at, r.converted_at
  FROM referrals r
  JOIN profiles p ON p.user_id = r.referred_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;
REVOKE ALL ON FUNCTION public.list_my_referrals(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_referrals(integer) TO authenticated;
