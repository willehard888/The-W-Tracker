-- Block-user + report-content — App Store 1.2 safety requirements.
--
-- Founder scope: ONE-WAY block (you block them), content hides BOTH ways so
-- neither party sees the other's posts/comments/reactions/DMs/friendship, and
-- the blocked party cannot send you a new DM or friend request. Existing
-- content is hidden by RLS, not deleted. Reporting on comments/DMs/profiles
-- routes into the existing moderation_queue the admin panel already reviews.

-- ── blocked_users ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
-- Reverse lookups (is_blocked checks both directions).
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON public.blocked_users (blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
-- A user sees and manages only their own block rows. (is_blocked below is
-- SECURITY DEFINER so the RLS policies can still test blocks in both directions.)
DROP POLICY IF EXISTS "own blocks select" ON public.blocked_users;
CREATE POLICY "own blocks select" ON public.blocked_users
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "own blocks insert" ON public.blocked_users;
CREATE POLICY "own blocks insert" ON public.blocked_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "own blocks delete" ON public.blocked_users;
CREATE POLICY "own blocks delete" ON public.blocked_users
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Bidirectional block test — true if EITHER user blocked the other, so a
-- one-way block hides content symmetrically. SECURITY DEFINER so it reads
-- blocked_users regardless of the caller's row-level visibility.
CREATE OR REPLACE FUNCTION public.is_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;
REVOKE ALL ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;

-- ── block / unblock RPCs ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_user(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_target IS NULL OR p_target = v_me THEN RETURN; END IF;
  INSERT INTO public.blocked_users (blocker_id, blocked_id)
  VALUES (v_me, p_target)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_user(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.blocked_users WHERE blocker_id = v_me AND blocked_id = p_target;
END;
$$;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ── report_content: user reports on any surface → moderation_queue ─────────
-- moderation_queue has no authenticated INSERT policy (AI edge functions write
-- it), so this SECURITY DEFINER RPC is the controlled user-report path. Lands
-- in the same queue AdminModeration already reviews.
CREATE OR REPLACE FUNCTION public.report_content(
  p_content_type text,
  p_content_id uuid,
  p_reported_user uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_content_type NOT IN ('feed_post','tribe_post','comment','tribe_comment','direct_message','profile') THEN
    RAISE EXCEPTION 'invalid_content_type';
  END IF;
  IF p_reported_user IS NULL THEN
    RAISE EXCEPTION 'reported_user_required';
  END IF;
  INSERT INTO public.moderation_queue
    (content_type, content_id, user_id, text_content, ai_action, ai_reason, severity, status)
  VALUES (
    p_content_type, p_content_id, p_reported_user,
    left(COALESCE(p_reason, 'Reported by user'), 500),
    'user_report', 'Reported by @' || COALESCE((SELECT username FROM profiles WHERE user_id = v_me), 'user'),
    'user_report', 'pending'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.report_content(text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, uuid, text) TO authenticated;

-- ── Append the block predicate to every content SELECT policy ──────────────
-- Each policy is recreated verbatim from its current definition plus one
-- `AND NOT public.is_blocked(...)` term. Author column noted per table.

-- feed_posts (author = user_id)
DROP POLICY IF EXISTS "Feed viewable by members" ON public.feed_posts;
CREATE POLICY "Feed viewable by members" ON public.feed_posts
  FOR SELECT TO authenticated
  USING (
    (moderation_status = 'approved' OR user_id = auth.uid())
    AND NOT public.is_blocked(auth.uid(), user_id)
  );

-- feed_comments (author = user_id)
DROP POLICY IF EXISTS "Comments viewable by members" ON public.feed_comments;
CREATE POLICY "Comments viewable by members" ON public.feed_comments
  FOR SELECT TO authenticated
  USING (NOT public.is_blocked(auth.uid(), user_id));

-- feed_reactions (author = user_id)
DROP POLICY IF EXISTS "Reactions viewable by members" ON public.feed_reactions;
CREATE POLICY "Reactions viewable by members" ON public.feed_reactions
  FOR SELECT TO authenticated
  USING (NOT public.is_blocked(auth.uid(), user_id));

-- kudos (author = giver_id)
DROP POLICY IF EXISTS "Kudos viewable by members" ON public.kudos;
CREATE POLICY "Kudos viewable by members" ON public.kudos
  FOR SELECT TO authenticated
  USING (NOT public.is_blocked(auth.uid(), giver_id));

-- tribe_posts (author = user_id)
DROP POLICY IF EXISTS "Tribe posts viewable by members or public" ON public.tribe_posts;
CREATE POLICY "Tribe posts viewable by members or public" ON public.tribe_posts
  FOR SELECT TO authenticated
  USING (
    (moderation_status = 'approved' OR user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tribes t
      WHERE t.id = tribe_id
        AND (t.visibility = 'public' OR is_tribe_member(t.id, auth.uid()))
    )
    AND NOT public.is_blocked(auth.uid(), user_id)
  );

-- tribe_post_comments (author = user_id)
DROP POLICY IF EXISTS "Tribe comments viewable by tribe-visible viewers" ON public.tribe_post_comments;
CREATE POLICY "Tribe comments viewable by tribe-visible viewers" ON public.tribe_post_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tribe_posts p
      JOIN public.tribes t ON t.id = p.tribe_id
      WHERE p.id = tribe_post_comments.post_id
        AND (t.visibility = 'public' OR public.is_tribe_member(t.id, auth.uid()))
    )
    AND NOT public.is_blocked(auth.uid(), user_id)
  );

-- tribe_post_reactions (author = user_id)
DROP POLICY IF EXISTS "Reactions viewable by tribe-visible viewers" ON public.tribe_post_reactions;
CREATE POLICY "Reactions viewable by tribe-visible viewers" ON public.tribe_post_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tribe_posts p
      JOIN public.tribes t ON t.id = p.tribe_id
      WHERE p.id = post_id
        AND (t.visibility = 'public' OR is_tribe_member(t.id, auth.uid()))
    )
    AND NOT public.is_blocked(auth.uid(), user_id)
  );

-- direct_messages: hide threads with a blocked user, and block sending to them.
DROP POLICY IF EXISTS "Users can view own messages" ON public.direct_messages;
CREATE POLICY "Users can view own messages" ON public.direct_messages
  FOR SELECT
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND NOT public.is_blocked(sender_id, receiver_id)
  );

DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages" ON public.direct_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_blocked(sender_id, receiver_id)
  );

-- friendships: a blocked user can't request the blocker, and a blocked pairing
-- drops off both friend lists.
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = requester_id OR auth.uid() = addressee_id)
    AND NOT public.is_blocked(requester_id, addressee_id)
  );

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND requester_id != addressee_id
    AND NOT public.is_blocked(requester_id, addressee_id)
  );

NOTIFY pgrst, 'reload schema';
