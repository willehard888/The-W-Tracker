-- Phase 4 — open Tribes to everyone. Remove the Elite/Apex paywall: anyone can
-- create and join clubs, clubs can be large, and tribes no longer pause when an
-- owner isn't Apex. Idempotent.

-- Per-tribe member cap (was a hardcoded 10). Default 100 = real "club" size.
ALTER TABLE public.tribes ADD COLUMN IF NOT EXISTS member_cap int NOT NULL DEFAULT 100;

-- Creation is open to every authenticated member now.
CREATE OR REPLACE FUNCTION public.can_create_tribe(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _user_id IS NOT NULL; $$;

-- Ownership no longer requires Apex → no tribe ever auto-pauses.
CREATE OR REPLACE FUNCTION public.is_valid_tribe_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _user_id IS NOT NULL; $$;

-- Revive anything that was paused under the old Apex rule.
UPDATE public.tribes SET is_paused = false, paused_at = NULL, paused_reason = NULL
WHERE is_paused = true;

-- create_tribe: no tier gate; generous per-user create limit to deter abuse.
CREATE OR REPLACE FUNCTION public.create_tribe(
  p_name text,
  p_description text DEFAULT NULL::text,
  p_visibility text DEFAULT 'public'::text,
  p_cover_url text DEFAULT NULL::text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_count int; v_slug text; v_id uuid; v_clean_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 3 OR length(v_clean_name) > 40 THEN
    RAISE EXCEPTION 'Tribe name must be 3-40 chars';
  END IF;
  IF p_visibility NOT IN ('public','private') THEN RAISE EXCEPTION 'Invalid visibility'; END IF;
  IF EXISTS (SELECT 1 FROM tribes WHERE lower(name) = lower(v_clean_name)) THEN
    RAISE EXCEPTION 'Tribe name already taken — try another';
  END IF;
  SELECT count(*) INTO v_count FROM tribes WHERE owner_id = v_user;
  IF v_count >= 10 THEN RAISE EXCEPTION 'You can lead up to 10 tribes'; END IF;

  v_slug := lower(regexp_replace(v_clean_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO tribes (owner_id, name, slug, description, visibility, cover_url, member_count)
  VALUES (v_user, v_clean_name, v_slug, p_description, p_visibility, p_cover_url, 1)
  RETURNING id INTO v_id;
  INSERT INTO tribe_members (tribe_id, user_id, role, status)
  VALUES (v_id, v_user, 'owner', 'active');
  RETURN v_id;
END;
$function$;

-- join_tribe: per-tribe cap from member_cap; flat generous per-user cap (no tier).
CREATE OR REPLACE FUNCTION public.join_tribe(p_tribe_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_visibility text; v_status text; v_count integer; v_cap_tribe integer;
  v_active_memberships integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT visibility, member_count, member_cap INTO v_visibility, v_count, v_cap_tribe
  FROM tribes WHERE id = p_tribe_id;
  IF v_visibility IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;

  IF EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = v_user) THEN
    RETURN 'already_member';
  END IF;

  IF v_visibility = 'public' AND v_count >= COALESCE(v_cap_tribe, 100) THEN
    RAISE EXCEPTION 'This club is full';
  END IF;

  SELECT count(*) INTO v_active_memberships
  FROM tribe_members WHERE user_id = v_user AND status = 'active';
  IF v_active_memberships >= 25 THEN
    RAISE EXCEPTION 'You can be in up to 25 clubs — leave one first';
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

-- Invite acceptance: same open caps.
CREATE OR REPLACE FUNCTION public.respond_to_tribe_invite(p_invite_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid(); v_invite RECORD; v_count integer; v_cap_tribe integer;
  v_active_memberships integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_invite FROM tribe_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_invite.invitee_id != v_user THEN RAISE EXCEPTION 'Only the invitee can respond'; END IF;
  IF v_invite.status != 'pending' THEN RAISE EXCEPTION 'Invite is no longer pending'; END IF;

  IF p_accept THEN
    SELECT member_count, member_cap INTO v_count, v_cap_tribe FROM tribes WHERE id = v_invite.tribe_id;
    IF v_count >= COALESCE(v_cap_tribe, 100) THEN RAISE EXCEPTION 'This club is full'; END IF;
    SELECT count(*) INTO v_active_memberships
    FROM tribe_members WHERE user_id = v_user AND status = 'active';
    IF v_active_memberships >= 25 THEN RAISE EXCEPTION 'You can be in up to 25 clubs — leave one first'; END IF;

    UPDATE tribe_invites SET status = 'accepted', responded_at = now() WHERE id = p_invite_id;
    IF NOT EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = v_invite.tribe_id AND user_id = v_user) THEN
      INSERT INTO tribe_members (tribe_id, user_id, role, status)
      VALUES (v_invite.tribe_id, v_user, 'member', 'active');
      UPDATE tribes SET member_count = member_count + 1 WHERE id = v_invite.tribe_id;
    ELSE
      UPDATE tribe_members SET status = 'active'
      WHERE tribe_id = v_invite.tribe_id AND user_id = v_user AND status != 'active';
      UPDATE tribes SET member_count = member_count + 1
      WHERE id = v_invite.tribe_id
        AND EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = v_invite.tribe_id AND user_id = v_user AND status = 'active');
    END IF;
  ELSE
    UPDATE tribe_invites SET status = 'declined', responded_at = now() WHERE id = p_invite_id;
  END IF;
END;
$function$;
