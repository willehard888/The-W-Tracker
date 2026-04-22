-- 1. De-duplicate existing tribe names (case-insensitive) by suffixing older ones
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, name
    FROM (
      SELECT id, name,
             ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY created_at ASC) AS rn
      FROM public.tribes
    ) t
    WHERE t.rn > 1
  LOOP
    UPDATE public.tribes
    SET name = left(r.name, 33) || '_' || substr(gen_random_uuid()::text, 1, 6)
    WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Case-insensitive unique index on tribe name
CREATE UNIQUE INDEX IF NOT EXISTS tribes_name_unique
  ON public.tribes (lower(name));

-- 3. Update create_tribe RPC with a friendly duplicate-name check
CREATE OR REPLACE FUNCTION public.create_tribe(
  p_name text,
  p_description text DEFAULT NULL::text,
  p_visibility text DEFAULT 'public'::text,
  p_cover_url text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
  v_slug text;
  v_id uuid;
  v_clean_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT can_create_tribe(v_user) THEN
    RAISE EXCEPTION 'Only Apex tier or Apex subscribers can create tribes';
  END IF;

  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 3 OR length(v_clean_name) > 40 THEN
    RAISE EXCEPTION 'Tribe name must be 3-40 chars';
  END IF;

  IF p_visibility NOT IN ('public','private') THEN
    RAISE EXCEPTION 'Invalid visibility';
  END IF;

  IF EXISTS (SELECT 1 FROM tribes WHERE lower(name) = lower(v_clean_name)) THEN
    RAISE EXCEPTION 'Tribe name already taken — try another';
  END IF;

  SELECT count(*) INTO v_count FROM tribes WHERE owner_id = v_user;
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Max 3 tribes per user';
  END IF;

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

-- 4. Tribe invites table
CREATE TABLE IF NOT EXISTS public.tribe_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS tribe_invites_pending_unique
  ON public.tribe_invites (tribe_id, invitee_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tribe_invites_invitee_idx
  ON public.tribe_invites (invitee_id, status);

CREATE INDEX IF NOT EXISTS tribe_invites_tribe_idx
  ON public.tribe_invites (tribe_id, status);

ALTER TABLE public.tribe_invites ENABLE ROW LEVEL SECURITY;

-- RLS: visible to inviter, invitee, or tribe owner
DROP POLICY IF EXISTS "Invites visible to participants" ON public.tribe_invites;
CREATE POLICY "Invites visible to participants"
ON public.tribe_invites
FOR SELECT
TO authenticated
USING (
  auth.uid() = inviter_id
  OR auth.uid() = invitee_id
  OR is_tribe_owner(tribe_id, auth.uid())
);

DROP POLICY IF EXISTS "No direct invite insert" ON public.tribe_invites;
CREATE POLICY "No direct invite insert"
ON public.tribe_invites FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct invite update" ON public.tribe_invites;
CREATE POLICY "No direct invite update"
ON public.tribe_invites FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "No direct invite delete" ON public.tribe_invites;
CREATE POLICY "No direct invite delete"
ON public.tribe_invites FOR DELETE TO authenticated USING (false);

-- 5. RPC: invite_to_tribe
CREATE OR REPLACE FUNCTION public.invite_to_tribe(
  p_tribe_id uuid,
  p_invitee_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_pending_count int;
  v_invite_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_invitee_id IS NULL OR p_invitee_id = v_user THEN
    RAISE EXCEPTION 'Invalid invitee';
  END IF;

  IF NOT is_tribe_member(p_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only tribe members can invite';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tribe_members
    WHERE tribe_id = p_tribe_id AND user_id = p_invitee_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is already a member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tribe_invites
    WHERE tribe_id = p_tribe_id AND invitee_id = p_invitee_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'User already invited';
  END IF;

  SELECT count(*) INTO v_pending_count
  FROM tribe_invites
  WHERE tribe_id = p_tribe_id AND status = 'pending';
  IF v_pending_count >= 50 THEN
    RAISE EXCEPTION 'Too many pending invites for this tribe';
  END IF;

  INSERT INTO tribe_invites (tribe_id, inviter_id, invitee_id, status)
  VALUES (p_tribe_id, v_user, p_invitee_id, 'pending')
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$function$;

-- 6. RPC: respond_to_tribe_invite
CREATE OR REPLACE FUNCTION public.respond_to_tribe_invite(
  p_invite_id uuid,
  p_accept boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_invite RECORD;
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

-- 7. RPC: revoke_tribe_invite
CREATE OR REPLACE FUNCTION public.revoke_tribe_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_invite RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM tribe_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_invite.inviter_id != v_user AND NOT is_tribe_owner(v_invite.tribe_id, v_user) THEN
    RAISE EXCEPTION 'Not authorized to revoke';
  END IF;

  IF v_invite.status = 'pending' THEN
    UPDATE tribe_invites
    SET status = 'revoked', responded_at = now()
    WHERE id = p_invite_id;
  END IF;
END;
$function$;