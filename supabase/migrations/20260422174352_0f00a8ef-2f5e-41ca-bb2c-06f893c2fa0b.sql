-- Cap tribe membership at 10 members
-- Update join_tribe RPC and respond_to_tribe_invite/approve_tribe_member to enforce cap

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
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT visibility, member_count INTO v_visibility, v_count FROM tribes WHERE id = p_tribe_id;
  IF v_visibility IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;

  IF EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = v_user) THEN
    RETURN 'already_member';
  END IF;

  -- Enforce 10-member cap on direct joins (public tribes)
  IF v_visibility = 'public' AND v_count >= 10 THEN
    RAISE EXCEPTION 'Tribe is full (max 10 members)';
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

-- Block approval if tribe is full
CREATE OR REPLACE FUNCTION public.approve_tribe_member(p_tribe_id uuid, p_user_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can approve members';
  END IF;

  IF p_accept THEN
    SELECT member_count INTO v_count FROM tribes WHERE id = p_tribe_id;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Tribe is full (max 10 members)';
    END IF;

    UPDATE tribe_members SET status = 'active'
    WHERE tribe_id = p_tribe_id AND user_id = p_user_id AND status = 'pending';
    UPDATE tribes SET member_count = member_count + 1
    WHERE id = p_tribe_id AND EXISTS (
      SELECT 1 FROM tribe_members
      WHERE tribe_id = p_tribe_id AND user_id = p_user_id AND status = 'active'
    );
  ELSE
    DELETE FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = p_user_id;
  END IF;
END;
$function$;

-- Block invite acceptance if tribe is full
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
    SELECT member_count INTO v_count FROM tribes WHERE id = v_invite.tribe_id;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Tribe is full (max 10 members)';
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