-- Friends-centric social graph: power the Friends page, friend-only Pods
-- (invite + accept, no codes), and friend-only 1v1 Battles.
-- Safe to run multiple times (CREATE OR REPLACE / IF NOT EXISTS / idempotent).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Friendship helpers
-- ─────────────────────────────────────────────────────────────────────────

-- True if a and b are accepted friends (either direction).
CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND ( (f.requester_id = a AND f.addressee_id = b)
         OR (f.requester_id = b AND f.addressee_id = a) )
  );
$$;

-- Caller's accepted friends, with profile info, alphabetical.
CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT p.user_id, p.username, p.avatar_url, p.status_tier, p.streak, p.level
    FROM friendships f
    JOIN profiles p
      ON p.user_id = CASE WHEN f.requester_id = auth.uid()
                          THEN f.addressee_id ELSE f.requester_id END
    WHERE f.status = 'accepted'
      AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    ORDER BY p.username
  ) t;
$$;

-- Incoming pending friend requests (people who want to add the caller).
CREATE OR REPLACE FUNCTION public.list_friend_requests()
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT f.id AS friendship_id, p.user_id, p.username, p.avatar_url,
           p.status_tier, p.level, f.created_at
    FROM friendships f
    JOIN profiles p ON p.user_id = f.requester_id
    WHERE f.status = 'pending' AND f.addressee_id = auth.uid()
    ORDER BY f.created_at DESC
  ) t;
$$;

-- Outgoing pending requests the caller has sent (so the UI can show "Pending").
CREATE OR REPLACE FUNCTION public.list_sent_friend_requests()
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT f.id AS friendship_id, p.user_id, p.username, p.avatar_url,
           p.status_tier, p.level, f.created_at
    FROM friendships f
    JOIN profiles p ON p.user_id = f.addressee_id
    WHERE f.status = 'pending' AND f.requester_id = auth.uid()
    ORDER BY f.created_at DESC
  ) t;
$$;

-- Lightweight badge count for incoming requests.
CREATE OR REPLACE FUNCTION public.pending_friend_request_count()
RETURNS int LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT count(*)::int FROM friendships
  WHERE status = 'pending' AND addressee_id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Pods: friend invites instead of codes
-- ─────────────────────────────────────────────────────────────────────────

-- Invite codes are no longer used; keep the column for back-compat but allow null.
ALTER TABLE public.pods ALTER COLUMN invite_code DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.pod_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id     uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pod_id, invitee_id)
);

ALTER TABLE public.pod_invites ENABLE ROW LEVEL SECURITY;

-- The invitee can see invites addressed to them; pod members can see their pod's.
DROP POLICY IF EXISTS "read pod invites" ON public.pod_invites;
CREATE POLICY "read pod invites" ON public.pod_invites
  FOR SELECT TO authenticated
  USING (invitee_id = auth.uid() OR public.is_pod_member(pod_id));
-- (all writes go through SECURITY DEFINER RPCs below)

-- Create a pod with no invite code; auto-join the creator as owner + member.
CREATE OR REPLACE FUNCTION public.create_pod(p_name text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_pod uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM pod_members WHERE user_id = uid) THEN RAISE EXCEPTION 'already_in_pod'; END IF;
  INSERT INTO pods (name, owner_id)
    VALUES (COALESCE(NULLIF(trim(p_name), ''), 'My Pod'), uid)
    RETURNING id INTO v_pod;
  INSERT INTO pod_members (pod_id, user_id) VALUES (v_pod, uid);
  RETURN json_build_object('pod_id', v_pod);
END; $$;

-- Any pod member can invite one of their accepted friends (pod max 5).
CREATE OR REPLACE FUNCTION public.invite_to_pod(p_invitee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_pod uuid; v_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT pod_id INTO v_pod FROM pod_members WHERE user_id = uid LIMIT 1;
  IF v_pod IS NULL THEN RAISE EXCEPTION 'not_in_pod'; END IF;
  IF NOT public.are_friends(uid, p_invitee) THEN RAISE EXCEPTION 'not_friends'; END IF;
  IF EXISTS (SELECT 1 FROM pod_members WHERE pod_id = v_pod AND user_id = p_invitee) THEN RAISE EXCEPTION 'already_member'; END IF;
  SELECT count(*) INTO v_count FROM pod_members WHERE pod_id = v_pod;
  IF v_count >= 5 THEN RAISE EXCEPTION 'pod_full'; END IF;
  INSERT INTO pod_invites (pod_id, inviter_id, invitee_id)
    VALUES (v_pod, uid, p_invitee)
    ON CONFLICT (pod_id, invitee_id) DO NOTHING;
END; $$;

-- Accept an invite → join that pod (clears the user's other pending invites).
CREATE OR REPLACE FUNCTION public.accept_pod_invite(p_pod uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pod_invites WHERE pod_id = p_pod AND invitee_id = uid) THEN RAISE EXCEPTION 'no_invite'; END IF;
  IF EXISTS (SELECT 1 FROM pod_members WHERE user_id = uid) THEN RAISE EXCEPTION 'already_in_pod'; END IF;
  SELECT count(*) INTO v_count FROM pod_members WHERE pod_id = p_pod;
  IF v_count >= 5 THEN RAISE EXCEPTION 'pod_full'; END IF;
  INSERT INTO pod_members (pod_id, user_id) VALUES (p_pod, uid);
  DELETE FROM pod_invites WHERE invitee_id = uid;
  RETURN json_build_object('pod_id', p_pod);
END; $$;

CREATE OR REPLACE FUNCTION public.decline_pod_invite(p_pod uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM pod_invites WHERE pod_id = p_pod AND invitee_id = auth.uid();
END; $$;

-- Caller's incoming pod invites with pod name + inviter + size.
CREATE OR REPLACE FUNCTION public.list_pod_invites()
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT pi.pod_id, po.name AS pod_name, pr.username AS inviter_username,
           (SELECT count(*) FROM pod_members pm WHERE pm.pod_id = pi.pod_id)::int AS member_count,
           pi.created_at
    FROM pod_invites pi
    JOIN pods po ON po.id = pi.pod_id
    JOIN profiles pr ON pr.user_id = pi.inviter_id
    WHERE pi.invitee_id = auth.uid()
    ORDER BY pi.created_at DESC
  ) t;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Battles: friends only
-- ─────────────────────────────────────────────────────────────────────────

-- Create a 1v1 battle against an accepted friend (one active/pending at a time).
CREATE OR REPLACE FUNCTION public.create_battle(p_opponent uuid, p_battle_type text, p_duration_days int)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_opponent = uid THEN RAISE EXCEPTION 'self_battle'; END IF;
  IF NOT public.are_friends(uid, p_opponent) THEN RAISE EXCEPTION 'not_friends'; END IF;
  IF EXISTS (
    SELECT 1 FROM battles
    WHERE status IN ('pending','active')
      AND ( (challenger_id = uid AND opponent_id = p_opponent)
         OR (challenger_id = p_opponent AND opponent_id = uid) )
  ) THEN RAISE EXCEPTION 'battle_exists'; END IF;
  INSERT INTO battles (challenger_id, opponent_id, battle_type, duration_days, status)
    VALUES (uid, p_opponent,
            COALESCE(NULLIF(trim(p_battle_type), ''), 'xp'),
            COALESCE(p_duration_days, 7), 'pending')
    RETURNING id INTO v_id;
  RETURN json_build_object('battle_id', v_id);
END; $$;

-- Defense in depth: direct inserts must also be challenger + friends.
DROP POLICY IF EXISTS "Users can create battles" ON public.battles;
DROP POLICY IF EXISTS "Users can create battles with friends" ON public.battles;
CREATE POLICY "Users can create battles with friends" ON public.battles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = challenger_id AND public.are_friends(auth.uid(), opponent_id));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Grants
-- ─────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.are_friends(uuid,uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_requests()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_sent_friend_requests()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.pending_friend_request_count()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pod(text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_to_pod(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_pod_invite(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_pod_invite(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pod_invites()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_battle(uuid,text,int)      TO authenticated;
