-- Release lockdown: the client key loses every write it does not need, and
-- blocking finally reaches the friend graph.
--
-- Verified before writing this file:
--   * every src/ path to daily_checkins and health_sync_snapshots is a SELECT;
--     the only writers are record_checkin() and upsert_health_snapshot(),
--     both SECURITY DEFINER, so the direct-write policies were pure attack
--     surface (XP, streak, tier, rank, the Verified badge and the three
--     health battle types were all forgeable with the public key).
--   * blocked_users already guards the friendships RLS policies, but every
--     friend read goes through a SECURITY DEFINER function, which bypasses
--     RLS -- so a blocked pair still saw each other everywhere.

-- 1. daily_checkins: the RPC is the only way in.
DROP POLICY IF EXISTS "Users can insert own checkins" ON public.daily_checkins;

-- 2. health_sync_snapshots: same, upsert_health_snapshot() is the only writer.
DROP POLICY IF EXISTS "Users can insert own health snapshots" ON public.health_sync_snapshots;
DROP POLICY IF EXISTS "Users can update own health snapshots" ON public.health_sync_snapshots;

-- 3. pg_net diagnostics were never meant for members.
REVOKE ALL ON FUNCTION public.debug_net_ping() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debug_net_result(bigint) FROM PUBLIC, anon, authenticated;

-- 4. Blocking reaches the friend graph. are_friends() is the choke point for
--    battles too (create_battle calls it, and so does the battles INSERT
--    policy), so one predicate closes the challenge path as well.
CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND ( (f.requester_id = a AND f.addressee_id = b)
         OR (f.requester_id = b AND f.addressee_id = a) )
  ) AND NOT public.is_blocked(a, b);
$$;

CREATE OR REPLACE FUNCTION public.list_friends()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT p.user_id, p.username, p.avatar_url, p.status_tier, p.streak, p.level
    FROM friendships f
    JOIN profiles p
      ON p.user_id = CASE WHEN f.requester_id = auth.uid()
                          THEN f.addressee_id ELSE f.requester_id END
    WHERE f.status = 'accepted'
      AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
      AND NOT public.is_blocked(f.requester_id, f.addressee_id)
    ORDER BY p.username
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.list_friend_requests()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT f.id AS friendship_id, p.user_id, p.username, p.avatar_url,
           p.status_tier, p.level, f.created_at
    FROM friendships f
    JOIN profiles p ON p.user_id = f.requester_id
    WHERE f.status = 'pending' AND f.addressee_id = auth.uid()
      AND NOT public.is_blocked(f.requester_id, f.addressee_id)
    ORDER BY f.created_at DESC
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.list_sent_friend_requests()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT f.id AS friendship_id, p.user_id, p.username, p.avatar_url,
           p.status_tier, p.level, f.created_at
    FROM friendships f
    JOIN profiles p ON p.user_id = f.addressee_id
    WHERE f.status = 'pending' AND f.requester_id = auth.uid()
      AND NOT public.is_blocked(f.requester_id, f.addressee_id)
    ORDER BY f.created_at DESC
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.pending_friend_request_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT count(*)::int FROM friendships f
  WHERE f.status = 'pending' AND f.addressee_id = auth.uid()
    AND NOT public.is_blocked(f.requester_id, f.addressee_id);
$$;

-- 5. Reporting is unlimited today and moderation_queue has no reporter column,
--    so a scripted client could bury the queue. 50 a day is far above any real
--    use and bounded by the counter the AI features already share.
CREATE OR REPLACE FUNCTION public.report_content(p_content_type text, p_content_id uuid, p_reported_user uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  IF NOT public.bump_ai_usage(50, 'report') THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '42901';
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

-- 6. The unauthenticated key has no business in the friend graph or the ladder.
--    (Supabase grants EXECUTE to anon AND authenticated on every new public
--    function, so these were open by default, not by decision.)
--    PUBLIC is revoked as well: the default EXECUTE-to-PUBLIC grant would
--    otherwise hand anon back everything this block takes away.
DO $lockdown$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.are_friends(uuid, uuid)',
    'public.list_friends()',
    'public.list_friend_requests()',
    'public.list_sent_friend_requests()',
    'public.pending_friend_request_count()',
    'public.create_battle(uuid, text, integer)',
    'public.get_user_rank(uuid)',
    'public.report_content(text, uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', s);
  END LOOP;
END
$lockdown$;

-- 7. A deletion archive is kept so a member who deletes by accident can be
--    restored; after 30 days it is just retained personal data.
SELECT cron.unschedule('archives-retention') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archives-retention');
SELECT cron.schedule('archives-retention', '50 4 * * *',
  $$ DELETE FROM public.deleted_account_archives WHERE archived_at < now() - interval '30 days' $$);

NOTIFY pgrst, 'reload schema';
