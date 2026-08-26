-- Two hardenings from the 2026-08-26 correctness review.
--
-- 1) claim_referral: only NEW accounts (< 7 days) may claim a referral code.
--    Auth.tsx stores ?ref= codes for anyone — including logged-in, already-
--    paying users — and the claim effect fires for any session. An existing
--    subscriber tapping a friend's link became that friend's "recruit", and
--    their next renewal paid out conversion progress the referrer didn't
--    cause. The window closes the leak without touching genuine signups
--    (the code is claimed on first login, minutes after account creation).
--
-- 2) webhook_events: shared dedup + ordering ledger for payment webhooks.
--    RevenueCat and Stripe both retry failed deliveries for hours and make
--    no ordering promise; without a ledger a retried stale RENEWAL delivered
--    after an EXPIRATION left is_elite = true forever. Service-role only
--    (RLS enabled, no policies).

CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id text PRIMARY KEY,
  source text NOT NULL,
  app_user_id text,
  event_ts bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS webhook_events_user_ts_idx
  ON public.webhook_events (source, app_user_id, event_ts DESC);

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
  v_created timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_referrer_code IS NULL OR length(trim(p_referrer_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
  END IF;

  -- Referral rewards are for bringing in NEW users. See file header.
  SELECT created_at INTO v_created FROM profiles WHERE user_id = v_user_id;
  IF v_created IS NOT NULL AND v_created < now() - interval '7 days' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'account_too_old');
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
