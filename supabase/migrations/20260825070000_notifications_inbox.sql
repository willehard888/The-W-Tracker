-- ============================================================
-- Notification inbox + social pushes (founder: "pushit miljarditasolle
-- ja appissa kohta josta näät ilmoitukset, invitet, ystäväpyynnöt yms").
--
--  * notifications — per-user ledger behind the bell. Written ONLY by
--    SECURITY DEFINER triggers + service-role edge functions; the client
--    may update read_at and nothing else.
--  * notify_user() — the one insert helper every trigger uses.
--  * Triggers add the missing social events (friend request/accept,
--    1v1 battle challenge/resolution, tribe join request, kudos,
--    feed comments, tribe invites) to the ledger; friend + battle
--    events ALSO push via the new notify-social edge fn (pg_net +
--    vault, same pattern as referral_join_notify — never able to
--    break the parent write).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  route text,
  actor_id uuid,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- The client may flip read_at — nothing else. A BEFORE UPDATE guard (the
-- direct_messages.read pattern) rejects any other column change.
CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_notifications_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IN ('authenticated', 'anon') THEN
    IF NEW.user_id  IS DISTINCT FROM OLD.user_id
       OR NEW.kind     IS DISTINCT FROM OLD.kind
       OR NEW.title    IS DISTINCT FROM OLD.title
       OR NEW.body     IS DISTINCT FROM OLD.body
       OR NEW.route    IS DISTINCT FROM OLD.route
       OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
       OR NEW.ref_id   IS DISTINCT FROM OLD.ref_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'only read_at may be updated';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifications_guard ON public.notifications;
CREATE TRIGGER notifications_guard
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_notifications_guard();

-- Realtime — the bell badge updates the moment a row lands.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Insert helper ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user uuid, p_kind text, p_title text, p_body text DEFAULT NULL,
  p_route text DEFAULT NULL, p_actor uuid DEFAULT NULL, p_ref uuid DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, route, actor_id, ref_id)
  SELECT p_user, left(p_kind, 40), left(p_title, 140), left(p_body, 280), left(p_route, 120), p_actor, p_ref
  WHERE p_user IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, uuid, uuid) TO service_role;

-- ── Mark read ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_before timestamptz DEFAULT now())
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.notifications
    SET read_at = now()
    WHERE user_id = auth.uid() AND read_at IS NULL AND created_at <= p_before
    RETURNING 1
  )
  SELECT count(*)::integer FROM updated;
$$;
REVOKE ALL ON FUNCTION public.mark_notifications_read(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(timestamptz) TO authenticated;

-- ── Push dispatch helper (pg_net → notify-social) ─────────────
CREATE OR REPLACE FUNCTION public.dispatch_social_push(p_kind text, p_user uuid, p_actor uuid, p_ref uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/notify-social',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object('kind', p_kind, 'user_id', p_user, 'actor_id', p_actor, 'ref_id', p_ref)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- a push failure must never break the parent write
  END;
END;
$$;

-- ── Friend requests ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_friendship_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.requester_id;
      PERFORM notify_user(NEW.addressee_id, 'friend_request',
        '@' || COALESCE(v_name, 'someone') || ' wants to be friends',
        'Accept from your notifications.', '/notifications', NEW.requester_id, NEW.id);
      PERFORM dispatch_social_push('friend_request', NEW.addressee_id, NEW.requester_id, NEW.id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.addressee_id;
      PERFORM notify_user(NEW.requester_id, 'friend_accepted',
        '@' || COALESCE(v_name, 'someone') || ' accepted your friend request',
        'You can battle and message each other now.', '/friends', NEW.addressee_id, NEW.id);
      PERFORM dispatch_social_push('friend_accepted', NEW.requester_id, NEW.addressee_id, NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS friendships_notify ON public.friendships;
CREATE TRIGGER friendships_notify
  AFTER INSERT OR UPDATE OF status ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.tg_friendship_notify();

-- ── 1v1 battles ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_battle_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.challenger_id;
      PERFORM notify_user(NEW.opponent_id, 'battle_challenge',
        '⚔️ @' || COALESCE(v_name, 'someone') || ' challenged you to a battle',
        initcap(COALESCE(NEW.battle_type, 'xp')) || ' battle · ' || COALESCE(NEW.duration_days, 7) || ' days. Accept from your notifications.',
        '/notifications', NEW.challenger_id, NEW.id);
      PERFORM dispatch_social_push('battle_challenge', NEW.opponent_id, NEW.challenger_id, NEW.id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
      PERFORM notify_user(NEW.challenger_id, 'battle_resolved', '⚔️ Battle decided',
        CASE WHEN NEW.winner_id = NEW.challenger_id THEN 'You won! +50 XP claimed.'
             WHEN NEW.winner_id IS NULL THEN 'It ends in a draw.'
             ELSE 'Your opponent takes it — run it back?' END,
        '/battles', NEW.opponent_id, NEW.id);
      PERFORM notify_user(NEW.opponent_id, 'battle_resolved', '⚔️ Battle decided',
        CASE WHEN NEW.winner_id = NEW.opponent_id THEN 'You won! +50 XP claimed.'
             WHEN NEW.winner_id IS NULL THEN 'It ends in a draw.'
             ELSE 'Your opponent takes it — run it back?' END,
        '/battles', NEW.challenger_id, NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS battles_notify ON public.battles;
CREATE TRIGGER battles_notify
  AFTER INSERT OR UPDATE OF status ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.tg_battle_notify();

-- ── Tribe join request → owner ────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_tribe_join_request_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
  v_tribe text;
BEGIN
  BEGIN
    IF NEW.status = 'pending' THEN
      SELECT owner_id, name INTO v_owner, v_tribe FROM tribes WHERE id = NEW.tribe_id;
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.user_id;
      IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
        PERFORM notify_user(v_owner, 'tribe_join_request',
          '@' || COALESCE(v_name, 'someone') || ' wants to join ' || COALESCE(v_tribe, 'your tribe'),
          'Review the request on the tribe page.', '/tribes/' || NEW.tribe_id, NEW.user_id, NEW.tribe_id);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tribe_members_join_request_notify ON public.tribe_members;
CREATE TRIGGER tribe_members_join_request_notify
  AFTER INSERT ON public.tribe_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_join_request_notify();

-- ── Tribe invite → ledger (push already sent by tribe-notify) ─
CREATE OR REPLACE FUNCTION public.tg_tribe_invite_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_tribe text;
BEGIN
  BEGIN
    SELECT username INTO v_name FROM profiles WHERE user_id = NEW.inviter_id;
    SELECT name INTO v_tribe FROM tribes WHERE id = NEW.tribe_id;
    PERFORM notify_user(NEW.invitee_id, 'tribe_invite',
      '🤝 @' || COALESCE(v_name, 'someone') || ' invited you to ' || COALESCE(v_tribe, 'a tribe'),
      'Accept from your notifications.', '/notifications', NEW.inviter_id, NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tribe_invites_ledger ON public.tribe_invites;
CREATE TRIGGER tribe_invites_ledger
  AFTER INSERT ON public.tribe_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_invite_ledger();

-- ── Kudos + comments on my posts (in-app only, no push) ───────
CREATE OR REPLACE FUNCTION public.tg_kudos_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  BEGIN
    IF NEW.receiver_id IS NOT NULL AND NEW.receiver_id <> NEW.giver_id THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.giver_id;
      PERFORM notify_user(NEW.receiver_id, 'kudos',
        '🏆 @' || COALESCE(v_name, 'someone') || ' gave you kudos',
        NULL, '/feed', NEW.giver_id, NEW.post_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS kudos_ledger ON public.kudos;
CREATE TRIGGER kudos_ledger
  AFTER INSERT ON public.kudos
  FOR EACH ROW EXECUTE FUNCTION public.tg_kudos_ledger();

CREATE OR REPLACE FUNCTION public.tg_feed_comment_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
BEGIN
  BEGIN
    SELECT user_id INTO v_owner FROM feed_posts WHERE id = NEW.post_id;
    IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.user_id;
      PERFORM notify_user(v_owner, 'comment',
        '💬 @' || COALESCE(v_name, 'someone') || ' commented on your post',
        left(NEW.content, 120), '/feed', NEW.user_id, NEW.post_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS feed_comments_ledger ON public.feed_comments;
CREATE TRIGGER feed_comments_ledger
  AFTER INSERT ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_feed_comment_ledger();
