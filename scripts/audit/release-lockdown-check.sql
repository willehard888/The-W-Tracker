\set a '''00000000-0000-0000-0000-00000000000a'''
\set b '''00000000-0000-0000-0000-00000000000b'''
INSERT INTO public.profiles (user_id, username) VALUES (:a,'ay'), (:b,'bee');
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (:a, :b, 'accepted');
SET request.uid = '00000000-0000-0000-0000-00000000000a';
SET request.role = 'authenticated';
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.uid'', true), '''')::uuid';
DO $$
DECLARE n int; v text;
BEGIN
  ASSERT public.are_friends('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b'), 'friends broke';
  ASSERT json_array_length(public.list_friends()) = 1, 'list_friends broke';
  INSERT INTO public.blocked_users VALUES ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000a');
  ASSERT NOT public.are_friends('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b'), 'block does not reach are_friends';
  ASSERT json_array_length(public.list_friends()) = 0, 'block does not reach list_friends';
  UPDATE public.friendships SET status = 'pending';
  ASSERT public.pending_friend_request_count() = 0, 'block does not reach pending count';
  ASSERT json_array_length(public.list_sent_friend_requests()) = 0, 'block does not reach sent requests';
  DELETE FROM public.blocked_users;
  ASSERT json_array_length(public.list_sent_friend_requests()) = 1, 'unblocked sent request lost';

  -- policies gone
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_checkins' AND cmd='INSERT'), 'checkin insert policy still there';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='health_sync_snapshots' AND cmd IN ('INSERT','UPDATE')), 'health write policy still there';

  -- grants
  ASSERT NOT has_function_privilege('authenticated','public.debug_net_ping()','EXECUTE'), 'members can still ping';
  ASSERT NOT has_function_privilege('authenticated','public.debug_net_result(bigint)','EXECUTE'), 'members can still read net results';
  ASSERT NOT has_function_privilege('anon','public.are_friends(uuid,uuid)','EXECUTE'), 'anon still reads the friend graph';
  ASSERT NOT has_function_privilege('anon','public.get_user_rank(uuid)','EXECUTE'), 'anon still reads the ladder';
  ASSERT NOT has_function_privilege('anon','public.report_content(text,uuid,uuid,text)','EXECUTE'), 'anon can still report';
  ASSERT has_function_privilege('authenticated','public.list_friends()','EXECUTE'), 'members lost their friend list';

  -- report rate limit: 50 pass, the 51st is refused
  FOR n IN 1..50 LOOP
    PERFORM public.report_content('feed_post', gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'x');
  END LOOP;
  BEGIN
    PERFORM public.report_content('feed_post', gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'x');
    v := 'ok';
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  ASSERT v = '42901', 'report 51 was not rate limited: ' || v;
  ASSERT (SELECT count(*) FROM public.moderation_queue) = 50, 'the refused report still landed';

  -- retention cron
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archives-retention'), 'no archive retention job';
  RAISE NOTICE 'all lockdown assertions passed';
END $$;

-- ── The one that could have broken the app ───────────────────────────────
-- Dropping the direct INSERT policies is only safe if a SECURITY DEFINER
-- function owned by the table owner still writes. This reproduces exactly that
-- shape: RLS on, force off, owner = the function owner, no INSERT policy.
CREATE OR REPLACE FUNCTION public.proof_record_checkin() RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.daily_checkins (user_id) VALUES (auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $f$;
GRANT EXECUTE ON FUNCTION public.proof_record_checkin() TO authenticated;
GRANT SELECT, INSERT ON public.daily_checkins TO authenticated;
DROP POLICY IF EXISTS "Users can view own checkins" ON public.daily_checkins;
CREATE POLICY "Users can view own checkins" ON public.daily_checkins FOR SELECT USING (auth.uid() = user_id);
TRUNCATE public.daily_checkins;

DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_checkins' AND cmd='INSERT'),
    'the fixture still has an INSERT policy — this proof would be meaningless';
  ASSERT (SELECT relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE oid='public.daily_checkins'::regclass),
    'RLS shape does not match production';
END $$;

SET request.uid = '00000000-0000-0000-0000-00000000000a';
SET ROLE authenticated;
DO $$
DECLARE v text; before int; after int;
BEGIN
  SELECT count(*) INTO before FROM public.daily_checkins;
  BEGIN
    INSERT INTO public.daily_checkins (user_id) VALUES ('00000000-0000-0000-0000-00000000000a');
    v := 'ok';
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE; END;
  ASSERT v = '42501', 'a member could still write the table directly: ' || v;
  PERFORM public.proof_record_checkin();
  SELECT count(*) INTO after FROM public.daily_checkins;
  ASSERT after = before + 1, format('the RPC no longer writes (%s -> %s): check-ins would be dead', before, after);
  RAISE NOTICE 'definer path intact: direct insert refused 42501, the RPC wrote a row the member can read';
END $$;
RESET ROLE;
