
-- Allow tribe owners to edit their tribe metadata (name, description, visibility, cover_url)
CREATE OR REPLACE FUNCTION public.update_tribe(
  p_tribe_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_visibility text DEFAULT NULL,
  p_cover_url text DEFAULT NULL,
  p_clear_cover boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_new_name text;
  v_new_slug text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can edit a tribe';
  END IF;

  IF p_visibility IS NOT NULL AND p_visibility NOT IN ('public','private') THEN
    RAISE EXCEPTION 'Invalid visibility';
  END IF;

  IF p_name IS NOT NULL THEN
    v_new_name := trim(p_name);
    IF length(v_new_name) < 3 OR length(v_new_name) > 40 THEN
      RAISE EXCEPTION 'Name must be 3-40 characters';
    END IF;
    -- Case-insensitive uniqueness check (excluding current tribe)
    IF EXISTS (
      SELECT 1 FROM tribes
      WHERE lower(name) = lower(v_new_name) AND id <> p_tribe_id
    ) THEN
      RAISE EXCEPTION 'Tribe name already taken — try another';
    END IF;
    v_new_slug := regexp_replace(lower(v_new_name), '[^a-z0-9]+', '-', 'g');
    v_new_slug := trim(both '-' from v_new_slug);
    IF v_new_slug = '' THEN v_new_slug := 'tribe-' || substring(p_tribe_id::text, 1, 8); END IF;
  END IF;

  UPDATE tribes
  SET
    name = COALESCE(v_new_name, name),
    slug = COALESCE(v_new_slug, slug),
    description = CASE WHEN p_description IS NOT NULL THEN NULLIF(trim(p_description), '') ELSE description END,
    visibility = COALESCE(p_visibility, visibility),
    cover_url = CASE
      WHEN p_clear_cover THEN NULL
      WHEN p_cover_url IS NOT NULL THEN p_cover_url
      ELSE cover_url
    END,
    updated_at = now()
  WHERE id = p_tribe_id;
END;
$$;

-- Promote/demote a tribe member (owner only). Max 2 admins per tribe.
CREATE OR REPLACE FUNCTION public.set_tribe_member_role(
  p_tribe_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_admin_count integer;
  v_target_status text;
  v_target_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can change roles';
  END IF;
  IF p_role NOT IN ('admin','member') THEN
    RAISE EXCEPTION 'Role must be admin or member';
  END IF;
  IF p_user_id = v_user THEN
    RAISE EXCEPTION 'Owner cannot change own role';
  END IF;

  SELECT status, role INTO v_target_status, v_target_role
  FROM tribe_members
  WHERE tribe_id = p_tribe_id AND user_id = p_user_id;

  IF v_target_status IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this tribe';
  END IF;
  IF v_target_status <> 'active' THEN
    RAISE EXCEPTION 'User is not an active member';
  END IF;
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change the owner role';
  END IF;

  IF p_role = 'admin' THEN
    SELECT count(*) INTO v_admin_count
    FROM tribe_members
    WHERE tribe_id = p_tribe_id AND role = 'admin' AND status = 'active';
    IF v_admin_count >= 2 THEN
      RAISE EXCEPTION 'This tribe already has the maximum of 2 admins';
    END IF;
  END IF;

  UPDATE tribe_members
  SET role = p_role
  WHERE tribe_id = p_tribe_id AND user_id = p_user_id;
END;
$$;

-- Helper: is the user an admin (or owner) of a tribe?
CREATE OR REPLACE FUNCTION public.is_tribe_admin(_tribe_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tribe_members
    WHERE tribe_id = _tribe_id
      AND user_id = _user_id
      AND status = 'active'
      AND role IN ('owner','admin')
  );
$$;

-- Owner can also remove a member (kick)
CREATE OR REPLACE FUNCTION public.remove_tribe_member(
  p_tribe_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text;
  v_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT is_tribe_owner(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only the owner can remove members';
  END IF;
  IF p_user_id = v_user THEN
    RAISE EXCEPTION 'Owner cannot remove self';
  END IF;

  SELECT status, role INTO v_status, v_role
  FROM tribe_members
  WHERE tribe_id = p_tribe_id AND user_id = p_user_id;

  IF v_status IS NULL THEN RETURN; END IF;
  IF v_role = 'owner' THEN RAISE EXCEPTION 'Cannot remove the owner'; END IF;

  DELETE FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = p_user_id;
  IF v_status = 'active' THEN
    UPDATE tribes SET member_count = GREATEST(member_count - 1, 0) WHERE id = p_tribe_id;
  END IF;
END;
$$;
