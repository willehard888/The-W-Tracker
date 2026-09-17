-- Assertions for the audit lockdown migration. Fails loudly (ON_ERROR_STOP).
\set a '''00000000-0000-0000-0000-00000000000a'''
\set b '''00000000-0000-0000-0000-00000000000b'''

INSERT INTO auth.users (id) VALUES (:a), (:b);
INSERT INTO public.active_members VALUES (:a);
INSERT INTO public.profiles (user_id) VALUES (:a), (:b);
INSERT INTO public.daily_checkins (user_id, verified_at) VALUES (:b, now());
INSERT INTO public.feed_posts (id, user_id, content, moderation_status, reported, image_url) VALUES
  ('10000000-0000-0000-0000-000000000001', :b, 'blocked one', 'blocked', true, NULL),
  ('10000000-0000-0000-0000-000000000002', :b, 'shared proof', 'approved', false, 'https://x.supabase.co/storage/v1/object/public/proof-photos/00000000-0000-0000-0000-00000000000b/shared.jpg');
INSERT INTO public.coach_programs (id, user_id, status) VALUES
  ('20000000-0000-0000-0000-000000000001', :a, 'active'), ('20000000-0000-0000-0000-000000000002', :b, 'superseded');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('proof-photos', '00000000-0000-0000-0000-00000000000b/private.jpg'),
  ('proof-photos', '00000000-0000-0000-0000-00000000000b/shared.jpg'),
  ('proof-photos', '00000000-0000-0000-0000-00000000000a/mine.jpg');

-- 1. grants
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.get_active_coach_program(uuid)', 'EXECUTE'), 'anon can still read programs';
  ASSERT NOT has_function_privilege('authenticated', 'public.get_active_coach_program(uuid)', 'EXECUTE'), 'members can still read any program';
  ASSERT NOT has_function_privilege('anon', 'public.dispatch_social_push(text,uuid,uuid,uuid)', 'EXECUTE'), 'anon can still push';
  ASSERT NOT has_function_privilege('authenticated', 'public.dispatch_social_push(text,uuid,uuid,uuid)', 'EXECUTE'), 'members can still push';
  ASSERT NOT has_function_privilege('anon', 'public.update_status_tier(uuid)', 'EXECUTE'), 'anon can still write tiers';
  ASSERT has_function_privilege('authenticated', 'public.update_status_tier(uuid)', 'EXECUTE'), 'the app lost its own tier refresh';
  ASSERT NOT has_function_privilege('anon', 'public.log_workout_set(uuid,int,int,text,text,numeric,int,numeric,int,date)', 'EXECUTE'), 'anon can log sets';
  ASSERT (SELECT count(*) FROM pg_proc WHERE proname = 'log_workout_set') = 1, 'two log_workout_set overloads: PostgREST would refuse the old call';
END $$;

-- 2. a member, acting as B
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
DO $$
DECLARE v_state text; n int; j jsonb;
BEGIN
  -- someone else's tier: refused
  BEGIN PERFORM public.update_status_tier('00000000-0000-0000-0000-00000000000a'); v_state := 'ok';
  EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE; END;
  ASSERT v_state = '42501', 'foreign tier write was not refused: ' || v_state;
  BEGIN PERFORM public.calculate_rank_score('00000000-0000-0000-0000-00000000000a'); v_state := 'ok';
  EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE; END;
  ASSERT v_state = '42501', 'foreign rank write was not refused: ' || v_state;
  -- their own: gets past the guard (whatever the stub tables then do)
  BEGIN PERFORM public.update_status_tier('00000000-0000-0000-0000-00000000000b'); v_state := 'ok';
  EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE; END;
  ASSERT v_state <> '42501', 'own tier refresh was refused';

  -- someone else's verification stats read as empty, their own are real
  j := public.user_verified_performer_stats('00000000-0000-0000-0000-00000000000a');
  ASSERT (j->>'total_checkins')::int = 0, 'foreign stats leaked';
  j := public.user_verified_performer_stats('00000000-0000-0000-0000-00000000000b');
  ASSERT (j->>'total_checkins')::int = 1, 'own stats lost';

  -- self-approval is ignored, the caption edit still lands
  UPDATE public.feed_posts SET moderation_status = 'approved', reported = false, content = 'edited'
   WHERE id = '10000000-0000-0000-0000-000000000001';
  ASSERT (SELECT moderation_status = 'blocked' AND reported AND content = 'edited' FROM public.feed_posts
           WHERE id = '10000000-0000-0000-0000-000000000001'), 'an author approved their own blocked post';

  -- B has no active access: cannot revive or rewrite a program
  BEGIN UPDATE public.coach_programs SET status = 'active' WHERE id = '20000000-0000-0000-0000-000000000002'; v_state := 'ok';
  EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE; END;
  ASSERT v_state = '42501', 'a lapsed member revived a program: ' || v_state;

  -- B sees their own two photos
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'proof-photos';
  ASSERT n = 2, 'owner should see exactly their own photos, saw ' || n;

  -- a set logged with the local day keeps it; a wild date falls back to the server's
  PERFORM public.log_workout_set(NULL, 1, 0, 'squat', 'Squat', 60, 5, NULL, 1, ((now() AT TIME ZONE 'utc')::date + 1));
  ASSERT (SELECT logged_on = (now() AT TIME ZONE 'utc')::date + 1 FROM public.workout_set_logs WHERE exercise_slug = 'squat'), 'local day was not kept';
  PERFORM public.log_workout_set(NULL, 1, 0, 'row', 'Row', 60, 5, NULL, 1, DATE '2031-01-01');
  ASSERT (SELECT logged_on = (now() AT TIME ZONE 'utc')::date FROM public.workout_set_logs WHERE exercise_slug = 'row'), 'a wild date was accepted';
  -- the nine-argument call from builds in the field still resolves
  PERFORM public.log_workout_set(NULL, 1, 0, 'curl', 'Curl', 10, 12, NULL, 1);
END $$;
ROLLBACK;

-- 3. a member with access, acting as A
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
DO $$
DECLARE v_state text; n int;
BEGIN
  UPDATE public.coach_programs SET plan_json = '{"weeks":[]}' WHERE id = '20000000-0000-0000-0000-000000000001';
  ASSERT FOUND, 'an active member could not edit their own program';
  BEGIN UPDATE public.coach_programs SET status = 'whatever' WHERE id = '20000000-0000-0000-0000-000000000001'; v_state := 'ok';
  EXCEPTION WHEN check_violation THEN v_state := 'check'; END;
  ASSERT v_state = 'check', 'an unknown status was accepted';
  BEGIN UPDATE public.coach_programs SET plan_json = jsonb_build_object('x', (SELECT string_agg(md5(i::text), '') FROM generate_series(1, 20000) i))
         WHERE id = '20000000-0000-0000-0000-000000000001'; v_state := 'ok';
  EXCEPTION WHEN check_violation THEN v_state := 'check'; END;
  ASSERT v_state = 'check', 'an oversized plan was accepted';

  -- A sees their own photo and the one B shared in an approved post, not B's private one
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'proof-photos';
  ASSERT n = 2, 'expected own + shared photo, saw ' || n;
  ASSERT NOT EXISTS (SELECT 1 FROM storage.objects WHERE name LIKE '%private.jpg'), 'a private proof photo leaked';
END $$;
ROLLBACK;

-- 4. the service role and cron still reach everything
BEGIN;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $$ DECLARE v_state text; BEGIN
  BEGIN PERFORM public.update_status_tier('00000000-0000-0000-0000-00000000000a'); v_state := 'ok';
  EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE; END;
  ASSERT v_state <> '42501', 'the service role was refused';
  ASSERT ((public.user_verified_performer_stats('00000000-0000-0000-0000-00000000000b'))->>'total_checkins')::int = 1, 'service role lost stats';
END $$;
ROLLBACK;

\echo 'audit lockdown: all checks passed'
