
-- 1) Add pause state to tribes
ALTER TABLE public.tribes
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_reason text;

-- 2) Helper: is this user currently a "valid Apex" (can own/lead a tribe)?
CREATE OR REPLACE FUNCTION public.is_valid_tribe_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND (
        legend_pinned = true
        OR is_apex_subscriber = true
        OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
        OR status_tier IN ('apex','legend')
      )
  );
$$;

-- 3) Replace join_tribe to enforce membership caps:
--    non-Apex: max 1 active membership total
--    Apex (subscriber/credits/legend/apex tier): max 3 active memberships total
--    Cannot join a paused tribe.
CREATE OR REPLACE FUNCTION public.join_tribe(p_tribe_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_visibility text;
  v_status text;
  v_count integer;
  v_paused boolean;
  v_active_memberships integer;
  v_is_apex boolean;
  v_cap integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT visibility, member_count, is_paused
  INTO v_visibility, v_count, v_paused
  FROM tribes WHERE id = p_tribe_id;
  IF v_visibility IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;

  IF v_paused THEN
    RAISE EXCEPTION 'This tribe is paused — its founder is no longer Apex';
  END IF;

  IF EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = v_user) THEN
    RETURN 'already_member';
  END IF;

  -- 10-member tribe cap (public direct join)
  IF v_visibility = 'public' AND v_count >= 10 THEN
    RAISE EXCEPTION 'Tribe is full (max 10 members)';
  END IF;

  -- Per-user active membership cap
  v_is_apex := public.is_valid_tribe_owner(v_user);
  v_cap := CASE WHEN v_is_apex THEN 3 ELSE 1 END;
  SELECT count(*) INTO v_active_memberships
  FROM tribe_members
  WHERE user_id = v_user AND status = 'active';

  IF v_active_memberships >= v_cap THEN
    IF v_is_apex THEN
      RAISE EXCEPTION 'Apex members can belong to at most 3 tribes — leave one first';
    ELSE
      RAISE EXCEPTION 'You can only belong to 1 tribe at a time — leave your current tribe first, or unlock Apex to join up to 3';
    END IF;
  END IF;

  v_status := CASE WHEN v_visibility = 'public' THEN 'active' ELSE 'pending' END;

  INSERT INTO tribe_members (tribe_id, user_id, role, status)
  VALUES (p_tribe_id, v_user, 'member', v_status);

  IF v_status = 'active' THEN
    UPDATE tribes SET member_count = member_count + 1 WHERE id = p_tribe_id;
  END IF;

  RETURN v_status;
END;
$function$;

-- 4) Same caps for invite acceptance
CREATE OR REPLACE FUNCTION public.respond_to_tribe_invite(p_invite_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_invite RECORD;
  v_count integer;
  v_paused boolean;
  v_active_memberships integer;
  v_is_apex boolean;
  v_cap integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM tribe_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;

  IF v_invite.invitee_id != v_user THEN
    RAISE EXCEPTION 'Only the invitee can respond';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer pending';
  END IF;

  IF p_accept THEN
    SELECT member_count, is_paused INTO v_count, v_paused FROM tribes WHERE id = v_invite.tribe_id;
    IF v_paused THEN
      RAISE EXCEPTION 'This tribe is paused — its founder is no longer Apex';
    END IF;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Tribe is full (max 10 members)';
    END IF;

    v_is_apex := public.is_valid_tribe_owner(v_user);
    v_cap := CASE WHEN v_is_apex THEN 3 ELSE 1 END;
    SELECT count(*) INTO v_active_memberships
    FROM tribe_members WHERE user_id = v_user AND status = 'active';
    IF v_active_memberships >= v_cap THEN
      IF v_is_apex THEN
        RAISE EXCEPTION 'Apex members can belong to at most 3 tribes — leave one first';
      ELSE
        RAISE EXCEPTION 'You can only belong to 1 tribe at a time — leave your current tribe first';
      END IF;
    END IF;

    UPDATE tribe_invites
    SET status = 'accepted', responded_at = now()
    WHERE id = p_invite_id;

    IF NOT EXISTS (
      SELECT 1 FROM tribe_members
      WHERE tribe_id = v_invite.tribe_id AND user_id = v_user
    ) THEN
      INSERT INTO tribe_members (tribe_id, user_id, role, status)
      VALUES (v_invite.tribe_id, v_user, 'member', 'active');
      UPDATE tribes SET member_count = member_count + 1
      WHERE id = v_invite.tribe_id;
    ELSE
      UPDATE tribe_members SET status = 'active'
      WHERE tribe_id = v_invite.tribe_id AND user_id = v_user AND status != 'active';
      UPDATE tribes SET member_count = member_count + 1
      WHERE id = v_invite.tribe_id
        AND EXISTS (
          SELECT 1 FROM tribe_members
          WHERE tribe_id = v_invite.tribe_id AND user_id = v_user AND status = 'active'
        );
    END IF;
  ELSE
    UPDATE tribe_invites
    SET status = 'declined', responded_at = now()
    WHERE id = p_invite_id;
  END IF;
END;
$function$;

-- 5) Sweeper: pause tribes whose owner is no longer a valid Apex,
--    and resume tribes whose owner is again valid.
CREATE OR REPLACE FUNCTION public.sync_tribe_pause_state()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tribes t
  SET is_paused = true,
      paused_at = COALESCE(paused_at, now()),
      paused_reason = 'owner_lost_apex'
  WHERE t.is_paused = false
    AND NOT public.is_valid_tribe_owner(t.owner_id);

  UPDATE public.tribes t
  SET is_paused = false,
      paused_at = NULL,
      paused_reason = NULL
  WHERE t.is_paused = true
    AND public.is_valid_tribe_owner(t.owner_id);
END;
$$;

-- 6) Trigger: when a profile's apex/legend status changes, reconcile that owner's tribes.
CREATE OR REPLACE FUNCTION public.trg_reconcile_owned_tribes_pause()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_valid boolean;
BEGIN
  IF NEW.is_apex_subscriber IS DISTINCT FROM OLD.is_apex_subscriber
     OR NEW.apex_credits_until IS DISTINCT FROM OLD.apex_credits_until
     OR NEW.legend_pinned IS DISTINCT FROM OLD.legend_pinned
     OR NEW.status_tier IS DISTINCT FROM OLD.status_tier THEN

    v_now_valid := public.is_valid_tribe_owner(NEW.user_id);

    IF v_now_valid THEN
      UPDATE public.tribes
      SET is_paused = false, paused_at = NULL, paused_reason = NULL
      WHERE owner_id = NEW.user_id AND is_paused = true;
    ELSE
      UPDATE public.tribes
      SET is_paused = true,
          paused_at = COALESCE(paused_at, now()),
          paused_reason = 'owner_lost_apex'
      WHERE owner_id = NEW.user_id AND is_paused = false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_reconcile_tribe_pause ON public.profiles;
CREATE TRIGGER profiles_reconcile_tribe_pause
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_reconcile_owned_tribes_pause();

-- 7) Initial reconcile so existing data is consistent
SELECT public.sync_tribe_pause_state();

-- 8) Allow an Apex member of a paused tribe to claim ownership (revives it).
CREATE OR REPLACE FUNCTION public.claim_paused_tribe(p_tribe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_paused boolean;
  v_old_owner uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT is_paused, owner_id INTO v_paused, v_old_owner
  FROM tribes WHERE id = p_tribe_id;
  IF v_paused IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;
  IF NOT v_paused THEN RAISE EXCEPTION 'This tribe is not paused'; END IF;

  IF NOT public.is_valid_tribe_owner(v_user) THEN
    RAISE EXCEPTION 'Only Apex members can claim a paused tribe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tribe_members
    WHERE tribe_id = p_tribe_id AND user_id = v_user AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You must be an active member of the tribe to claim it';
  END IF;

  -- Demote the old owner row to admin (if still present)
  UPDATE tribe_members SET role = 'admin'
  WHERE tribe_id = p_tribe_id AND user_id = v_old_owner AND role = 'owner';

  -- Promote the new owner
  UPDATE tribe_members SET role = 'owner'
  WHERE tribe_id = p_tribe_id AND user_id = v_user;

  -- Reassign tribe ownership and resume
  UPDATE tribes
  SET owner_id = v_user,
      is_paused = false,
      paused_at = NULL,
      paused_reason = NULL,
      updated_at = now()
  WHERE id = p_tribe_id;
END;
$$;
