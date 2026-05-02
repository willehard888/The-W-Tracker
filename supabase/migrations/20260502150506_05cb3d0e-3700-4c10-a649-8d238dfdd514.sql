
-- 1. Legend invites table
CREATE TABLE public.legend_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  note text,
  expires_at timestamptz,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legend_invites_code ON public.legend_invites (lower(code));
CREATE INDEX idx_legend_invites_used_by ON public.legend_invites (used_by);

ALTER TABLE public.legend_invites ENABLE ROW LEVEL SECURITY;

-- Admins can view all invites
CREATE POLICY "Admins can view legend invites"
  ON public.legend_invites
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view invites they redeemed
CREATE POLICY "Users can view own redeemed invites"
  ON public.legend_invites
  FOR SELECT TO authenticated
  USING (auth.uid() = used_by);

-- All writes go through SECURITY DEFINER RPCs only
CREATE POLICY "No direct insert"
  ON public.legend_invites FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct update"
  ON public.legend_invites FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct delete"
  ON public.legend_invites FOR DELETE TO authenticated USING (false);

-- 2. Admin-only RPC: create a legend invite
CREATE OR REPLACE FUNCTION public.create_legend_invite(
  p_code text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_invite legend_invites;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  v_code := COALESCE(NULLIF(trim(p_code), ''), upper(encode(gen_random_bytes(6), 'hex')));

  IF length(v_code) < 4 OR length(v_code) > 40 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code_length');
  END IF;

  INSERT INTO legend_invites (code, created_by, expires_at, note)
  VALUES (v_code, auth.uid(), p_expires_at, p_note)
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_invite.id,
    'code', v_invite.code,
    'expires_at', v_invite.expires_at
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'reason', 'code_taken');
END;
$$;

-- 3. RPC: redeem a legend invite (any authed user)
CREATE OR REPLACE FUNCTION public.redeem_legend_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite legend_invites;
  v_already_legend boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
  END IF;

  SELECT legend_pinned INTO v_already_legend FROM profiles WHERE user_id = v_uid;
  IF COALESCE(v_already_legend, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_legend');
  END IF;

  -- Lock the invite row
  SELECT * INTO v_invite
  FROM legend_invites
  WHERE lower(code) = lower(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_used');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_expired');
  END IF;

  UPDATE legend_invites
  SET used_by = v_uid, used_at = now()
  WHERE id = v_invite.id;

  UPDATE profiles
  SET legend_pinned = true,
      status_tier = 'legend',
      updated_at = now()
  WHERE user_id = v_uid;

  -- Founding apex auto-grant for legends (existing helper)
  PERFORM auto_grant_founding_apex_to_legends();

  RETURN jsonb_build_object('success', true, 'code', v_invite.code);
END;
$$;

-- 4. Update status tier calculation: legend is now invite-only (legend_pinned only)
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
  is_pinned_legend boolean;
  is_apex_sub boolean;
  apex_credits timestamptz;
BEGIN
  SELECT legend_pinned, is_apex_subscriber, apex_credits_until
    INTO is_pinned_legend, is_apex_sub, apex_credits
    FROM profiles WHERE user_id = target_user_id;

  -- Legend is INVITE-ONLY: only achievable via redeem_legend_invite (sets legend_pinned)
  IF COALESCE(is_pinned_legend, false) THEN
    UPDATE profiles SET status_tier = 'legend' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  PERFORM calculate_rank_score(target_user_id);
  SELECT rank_score INTO user_score FROM profiles WHERE user_id = target_user_id;

  IF COALESCE(is_apex_sub, false) OR (apex_credits IS NOT NULL AND apex_credits > now()) THEN
    UPDATE profiles SET status_tier = 'apex' WHERE user_id = target_user_id;
    RETURN;
  END IF;

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

  -- NOTE: Legend tier intentionally removed from earned thresholds — invite only.
  IF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN
    new_tier := 'apex';
  ELSIF percentile >= 80 OR (activity_days >= 20 AND user_streak >= 21) THEN
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
