-- ============================================================
-- Pilot access codes.
--
-- The pilot runs free for its testers, but the paywall is switched on so the
-- purchase flow, trial expiry and store plumbing are all exercised for real
-- before a commercial launch. Testers redeem a code that grants membership
-- credits for the pilot window.
--
-- Deliberately built on the EXISTING access path: membership_credits_until is
-- already honoured by has_active_access() and by the client's isPremium, so a
-- redeemed code needs no new gate, no new flag, and nothing to unwind when the
-- pilot ends — the credits simply lapse.
--
-- Shape mirrors legend_invites (single-use codes, SECURITY DEFINER redemption,
-- FOR UPDATE locking, admin-only creation) with one difference: a code carries
-- a redemption cap, so one code can be handed to the whole pilot group instead
-- of minting and tracking fifty of them.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pilot_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Uniqueness lives on lower(code) below, matching the case-insensitive
  -- lookup in redeem_pilot_code — a column-level UNIQUE would happily hold
  -- 'Alpha' and 'alpha' and leave the lookup picking one at random.
  code text NOT NULL,
  note text,
  -- How long the code grants free access for, from the moment of redemption.
  grant_days integer NOT NULL DEFAULT 90 CHECK (grant_days > 0),
  -- How many people may redeem this code in total. 1 = a personal invite.
  max_redemptions integer NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  -- After this, the code stops working regardless of remaining capacity.
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_codes_code ON public.pilot_codes (lower(code));

CREATE TABLE IF NOT EXISTS public.pilot_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.pilot_codes(id) ON DELETE CASCADE,
  -- CASCADE: deleted test accounts (pilot-setup.sql encourages cleanup via
  -- auth.users) must release their slot, not consume max_redemptions forever.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  -- One redemption per person per code: without this, a tester could re-run
  -- the same code every time their credits ran low and extend forever.
  UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pilot_code_redemptions_user
  ON public.pilot_code_redemptions (user_id);

ALTER TABLE public.pilot_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies are dropped first so a half-applied run of this migration can be
-- re-run cleanly (CREATE POLICY has no IF NOT EXISTS, and the tables above
-- use IF NOT EXISTS — without this the retry would fail on the policies).
--
-- Codes are never readable by the people redeeming them: listing them would
-- hand every tester every other code, cap and expiry in the table.
DROP POLICY IF EXISTS "Admins read pilot codes" ON public.pilot_codes;
DROP POLICY IF EXISTS "No direct insert" ON public.pilot_codes;
DROP POLICY IF EXISTS "No direct update" ON public.pilot_codes;
DROP POLICY IF EXISTS "No direct delete" ON public.pilot_codes;

CREATE POLICY "Admins read pilot codes"
  ON public.pilot_codes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "No direct insert" ON public.pilot_codes FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct update" ON public.pilot_codes FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct delete" ON public.pilot_codes FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "Users read own redemptions" ON public.pilot_code_redemptions;
DROP POLICY IF EXISTS "No direct insert" ON public.pilot_code_redemptions;
DROP POLICY IF EXISTS "No direct update" ON public.pilot_code_redemptions;
DROP POLICY IF EXISTS "No direct delete" ON public.pilot_code_redemptions;

CREATE POLICY "Users read own redemptions"
  ON public.pilot_code_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "No direct insert" ON public.pilot_code_redemptions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct update" ON public.pilot_code_redemptions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct delete" ON public.pilot_code_redemptions FOR DELETE TO authenticated USING (false);

-- ─── Admin: mint a code ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_pilot_code(
  p_code text DEFAULT NULL,
  p_grant_days integer DEFAULT 90,
  p_max_redemptions integer DEFAULT 1,
  p_expires_at timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- No code supplied → random, like legend_invites. Guessable dictionary
  -- words × unlimited signups × 90 free days is the actual threat model.
  v_final text := COALESCE(nullif(trim(p_code), ''), upper(encode(gen_random_bytes(6), 'hex')));
  v_row pilot_codes;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  IF length(v_final) < 4 OR length(v_final) > 40 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_length');
  END IF;

  INSERT INTO pilot_codes (code, grant_days, max_redemptions, expires_at, note, created_by)
  VALUES (v_final, p_grant_days, p_max_redemptions, p_expires_at, p_note, auth.uid())
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'code', v_row.code, 'id', v_row.id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_exists');
  WHEN check_violation THEN
    -- grant_days/max_redemptions <= 0 — keep the {success:false} contract
    -- instead of surfacing a PostgREST 500.
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_params');
END;
$$;

-- ─── Tester: redeem a code ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_pilot_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code pilot_codes;
  v_used integer;
  v_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- Brute-force guard: signup is free and the reason strings form an oracle,
  -- so cap attempts per user per day. bump_ai_usage (20260819083232) is the
  -- house atomic counter; it reads auth.uid() itself.
  IF NOT bump_ai_usage(10, 'pilot_code') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'too_many_attempts');
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
  END IF;

  -- Lock the code row so two testers redeeming the last remaining slot at the
  -- same moment can't both pass the capacity check.
  SELECT * INTO v_code
  FROM pilot_codes
  WHERE lower(code) = lower(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_expired');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pilot_code_redemptions
    WHERE code_id = v_code.id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_redeemed');
  END IF;

  SELECT count(*) INTO v_used
  FROM pilot_code_redemptions WHERE code_id = v_code.id;

  IF v_used >= v_code.max_redemptions THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_exhausted');
  END IF;

  INSERT INTO pilot_code_redemptions (code_id, user_id)
  VALUES (v_code.id, v_uid);

  -- Extend from whichever is later: existing credits or now. A tester who
  -- already had credits keeps them and gets the pilot window on top.
  UPDATE profiles
  SET membership_credits_until =
        GREATEST(COALESCE(membership_credits_until, now()), now())
        + make_interval(days => v_code.grant_days),
      updated_at = now()
  WHERE user_id = v_uid
  RETURNING membership_credits_until INTO v_until;

  -- A missing profile row must ROLL BACK the redemption insert above —
  -- returning "success" here would burn the slot while granting nothing.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'redeem_pilot_code: no profile row for user %', v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'access_until', v_until,
    'granted_days', v_code.grant_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_pilot_code(text, integer, integer, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_pilot_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pilot_code(text, integer, integer, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_pilot_code(text) TO authenticated;
