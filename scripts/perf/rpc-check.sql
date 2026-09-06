-- ============================================================
-- whealth_live_inputs() + season_board() behaviour under impersonation.
--
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f scripts/perf/rpc-check.sql
--
-- One transaction, rolled back. Role switching mirrors PostgREST:
-- SET LOCAL ROLE + request.jwt.claims. Seeds as postgres (bypasses RLS), then
-- reads as A / B / E (empty) / anon.
--
-- Season fixture (season S):
--   A  baseline 100, xp 150 →  50 season pts   → listed, rank 2
--   B  baseline 500, xp 900 → 400 season pts   → listed, rank 1
--   C  no baseline,  xp 900 →   0 (= own xp)   → hidden
--   D  baseline 900, xp 600 →   0 (clamped)    → hidden
--   E  xp 0                                    → outside the universe
-- ============================================================
\set ON_ERROR_STOP on
\set A '11111111-1111-4111-8111-111111111111'
\set B '22222222-2222-4222-8222-222222222222'
\set C '33333333-3333-4333-8333-333333333333'
\set D '44444444-4444-4444-8444-444444444444'
\set E '55555555-5555-4555-8555-555555555555'
\set S 'aaaaaaaa-0000-4000-8000-00000000000a'

BEGIN;

-- ---------- both functions must run as the caller ----------
DO $$
BEGIN
  ASSERT (SELECT prosecdef FROM pg_proc WHERE proname = 'whealth_live_inputs' AND pronamespace = 'public'::regnamespace) = false,
    'whealth_live_inputs is SECURITY DEFINER';
  ASSERT (SELECT prosecdef FROM pg_proc WHERE proname = 'season_board' AND pronamespace = 'public'::regnamespace) = false,
    'season_board is SECURITY DEFINER';
  RAISE NOTICE 'rpc-check: both RPCs are SECURITY INVOKER';
END $$;

-- ---------- seed (as postgres, RLS bypassed) ----------
INSERT INTO auth.users (id, email) VALUES
  (:'A','a@local'), (:'B','b@local'), (:'C','c@local'), (:'D','d@local'), (:'E','e@local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (user_id, username, xp, level, streak, status_tier) VALUES
  (:'A','a',150,2,3,'rising'), (:'B','b',900,5,10,'elite'), (:'C','c',900,5,0,'normal'),
  (:'D','d',600,4,0,'normal'), (:'E','e',0,1,0,'normal')
ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, xp = EXCLUDED.xp, level = EXCLUDED.level,
  streak = EXCLUDED.streak, status_tier = EXCLUDED.status_tier;
INSERT INTO public.leaderboard_seasons (id, name, starts_at, ends_at) VALUES (:'S', 'S', now() - interval '1 day', now() + interval '30 days');
INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp) VALUES
  (:'S', :'A', 100), (:'S', :'B', 500), (:'S', :'D', 900);

-- A's live-index rows (+ one of everything for B, to prove RLS scoping)
INSERT INTO public.daily_checkins (user_id, checked_in_at, sleep_hours, hydration_liters, workout, healthy_food, journal_entry, habits, verified_at) VALUES
  (:'A', now() - interval '2 days', 8.0, 3.0, true,  true,  'wrote', '{"meditation":true}', now()),
  (:'A', now() - interval '1 day',  7.5, 3.5, false, false, '   ',   '{}',                 NULL),
  (:'A', now() - interval '40 days', 6.0, 1.0, false, false, NULL,  '{}',                 NULL),   -- outside 28 d
  (:'B', now() - interval '1 day',  9.0, 3.0, true,  true,  'b',     '{}',                 NULL);
INSERT INTO public.health_night_metrics (user_id, night_date, resting_hr, sleep_total_min, sleep_deep_min, sleep_rem_min, sleep_start) VALUES
  (:'A', current_date - 1, 50, 460, 90, 100, now() - interval '1 day'),
  (:'A', current_date - 3, 54, 420, 80,  90, now() - interval '3 days'),
  (:'A', current_date - 2, 52, 440, 85,  95, now() - interval '2 days'),
  (:'A', current_date - 40, 60, 400, 70, 80, now() - interval '40 days'),   -- outside 28 d
  (:'B', current_date - 1, 48, 480, 90, 100, now() - interval '1 day');
INSERT INTO public.health_sync_snapshots (user_id, snapshot_date, steps, active_kcal, workout_minutes, mindful_minutes) VALUES
  (:'A', current_date - 1, 9000, 500, 45, 10), (:'B', current_date - 1, 100, 10, 0, 0);
INSERT INTO public.coach_reflections (user_id, reflection_date, energy_1to5, mood_1to5, win, friction) VALUES
  (:'A', current_date - 1, 4, 5, 'shipped', NULL), (:'B', current_date - 1, 1, 1, NULL, 'meh');
INSERT INTO public.vault_articles (slug, title) VALUES ('x1','X1'), ('x2','X2'), ('x3','X3');
INSERT INTO public.vault_lesson_progress (user_id, article_id, quiz_score)
  SELECT :'A', id, 80 FROM public.vault_articles WHERE slug = 'x1';
INSERT INTO public.vault_lesson_progress (user_id, article_id, quiz_score)
  SELECT :'B', id, 10 FROM public.vault_articles WHERE slug = 'x2';
INSERT INTO public.workout_set_logs (user_id, exercise_slug, exercise_name, weight, reps, logged_on, updated_at) VALUES
  (:'A', 'squat', 'Squat', 100, 5, current_date - 10, now() - interval '10 days'),
  (:'A', 'squat', 'Squat', 110, 5, current_date - 1,  now() - interval '1 day'),
  (:'A', 'squat', 'Squat', 105, 5, current_date - 5,  now() - interval '5 days'),
  (:'B', 'bench', 'Bench', 100, 5, current_date - 1,  now());
INSERT INTO public.tribes (id, owner_id, visibility) VALUES ('bbbbbbbb-0000-4000-8000-00000000000b', :'B', 'private');
INSERT INTO public.tribe_members (tribe_id, user_id) VALUES ('bbbbbbbb-0000-4000-8000-00000000000b', :'A'), ('bbbbbbbb-0000-4000-8000-00000000000b', :'B');
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES
  (:'A', :'B', 'accepted'), (:'C', :'A', 'accepted'), (:'A', :'D', 'pending'), (:'B', :'C', 'accepted');
INSERT INTO public.coach_athlete_profile (user_id, i_am) VALUES (:'A', 'a builder'), (:'B', '   ');
INSERT INTO public.meal_logs (id, user_id, log_date, meal_slot, kcal, protein_g) VALUES
  (gen_random_uuid(), :'A', current_date - 1, 'lunch', 600, 40),
  (gen_random_uuid(), :'A', current_date - 1, 'dinner', 500, 35),
  (gen_random_uuid(), :'A', current_date - 40, 'lunch', 999, 99),   -- outside 28 d
  (gen_random_uuid(), :'B', current_date - 1, 'lunch', 1, 1);
INSERT INTO public.nutrition_targets (user_id, effective_from, protein_g) VALUES
  (:'A', current_date - 10, 120), (:'A', current_date - 2, 150), (:'B', current_date - 1, 99);

-- ---------- season_board as A ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  s uuid := 'aaaaaaaa-0000-4000-8000-00000000000a';
  b jsonb;
BEGIN
  b := public.season_board(s);
  ASSERT (SELECT jsonb_agg(t->>'username') FROM jsonb_array_elements(b->'top') t) = '["b","a"]'::jsonb, 'top order: ' || b::text;
  ASSERT (b->'top'->0->>'season_points')::int = 400 AND (b->'top'->1->>'season_points')::int = 50, 'season points: ' || b::text;
  ASSERT (b->'top'->0->>'xp')::int = 900 AND b->'top'->0->>'status_tier' = 'elite' AND (b->'top'->0->>'streak')::int = 10
     AND (b->'top'->0->>'level')::int = 5 AND b->'top'->0 ? 'avatar_url' AND b->'top'->0->>'user_id' = '22222222-2222-4222-8222-222222222222',
     'LeaderRow columns: ' || b::text;
  ASSERT (b->>'my_rank')::int = 2 AND (b->>'total')::int = 2, 'my_rank/total: ' || b::text;

  b := public.season_board(s, 1);
  ASSERT jsonb_array_length(b->'top') = 1 AND b->'top'->0->>'username' = 'b', 'p_limit=1 top: ' || b::text;
  ASSERT (b->>'my_rank')::int = 2 AND (b->>'total')::int = 2, 'p_limit=1 keeps full-set rank/total: ' || b::text;

  b := public.season_board(s, 0);
  ASSERT jsonb_array_length(b->'top') = 1, 'p_limit=0 clamps to 1';
  b := public.season_board(gen_random_uuid());
  ASSERT b->'top' = '[]'::jsonb AND b->'my_rank' = 'null'::jsonb AND (b->>'total')::int = 0, 'unknown season: ' || b::text;
  RAISE NOTICE 'rpc-check season_board as A: ok';
END $$;
RESET ROLE;

-- ---------- season_board as C (xp but no season points → unranked) ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
DO $$
DECLARE b jsonb := public.season_board('aaaaaaaa-0000-4000-8000-00000000000a');
BEGIN
  ASSERT b->'my_rank' = 'null'::jsonb AND (b->>'total')::int = 2 AND jsonb_array_length(b->'top') = 2, 'C rank: ' || b::text;
  RAISE NOTICE 'rpc-check season_board as C (no row): ok';
END $$;
RESET ROLE;

-- ---------- whealth_live_inputs as A ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  p jsonb := public.whealth_live_inputs();
  keys text[] := ARRAY['checkins','nights','days','reflections','lessons','lessons_total','lifts','tribe_count','friend_count','i_am','meals','targets'];
  k text;
BEGIN
  FOREACH k IN ARRAY keys LOOP
    ASSERT p ? k, 'missing key ' || k;
  END LOOP;

  -- check-ins: own, 28 d, ascending, exact columns
  ASSERT jsonb_array_length(p->'checkins') = 2, 'checkins count: ' || (p->'checkins')::text;
  ASSERT (p->'checkins'->0->>'checked_in_at')::timestamptz < (p->'checkins'->1->>'checked_in_at')::timestamptz, 'checkins ascending';
  ASSERT p->'checkins'->0 ?& ARRAY['checked_in_at','sleep_hours','hydration_liters','workout','meditation_morning','meditation_evening',
                                    'protein_intake','healthy_food','no_phone_morning','no_phone_evening','journal_entry','habits','verified_at'],
    'checkin columns: ' || (p->'checkins'->0)::text;
  ASSERT p->'checkins'->0->'habits' = '{"meditation":true}'::jsonb AND (p->'checkins'->0->>'sleep_hours')::numeric = 8.0
     AND p->'checkins'->0->>'journal_entry' = 'wrote' AND p->'checkins'->0->'verified_at' <> 'null'::jsonb
     AND p->'checkins'->1->'verified_at' = 'null'::jsonb, 'checkin values: ' || (p->'checkins')::text;

  -- nights: 28 d, ASCENDING by night_date (the recovery slice(-7) fix)
  ASSERT jsonb_array_length(p->'nights') = 3, 'nights count';
  ASSERT (p->'nights'->0->>'night_date')::date < (p->'nights'->1->>'night_date')::date
     AND (p->'nights'->1->>'night_date')::date < (p->'nights'->2->>'night_date')::date, 'nights ascending: ' || (p->'nights')::text;
  ASSERT p->'nights'->0 ?& ARRAY['night_date','resting_hr','hrv_sdnn','respiratory_rate','sleep_total_min','sleep_deep_min','sleep_rem_min','sleep_start'],
    'night columns';
  ASSERT (p->'nights'->2->>'resting_hr')::numeric = 50, 'latest night is last';

  -- days / reflections: own rows only
  ASSERT jsonb_array_length(p->'days') = 1 AND (p->'days'->0->>'steps')::int = 9000 AND (p->'days'->0->>'active_kcal')::int = 500, 'days';
  ASSERT jsonb_array_length(p->'reflections') = 1 AND (p->'reflections'->0->>'mood_1to5')::int = 5 AND p->'reflections'->0->>'win' = 'shipped', 'reflections';

  -- lessons: own progress rows; lessons_total = every article the caller may read
  ASSERT p->'lessons' = '[{"quiz_score": 80}]'::jsonb, 'lessons: ' || (p->'lessons')::text;
  ASSERT (p->>'lessons_total')::int = 3, 'lessons_total: ' || (p->>'lessons_total');

  -- lifts: own, newest-first
  ASSERT jsonb_array_length(p->'lifts') = 3, 'lifts count';
  ASSERT (p->'lifts'->0->>'weight')::numeric = 110 AND (p->'lifts'->1->>'weight')::numeric = 105 AND (p->'lifts'->2->>'weight')::numeric = 100,
    'lifts newest-first: ' || (p->'lifts')::text;
  ASSERT p->'lifts'->0 ?& ARRAY['exercise_slug','exercise_name','weight','reps'], 'lift columns';

  -- counts / identity
  ASSERT (p->>'tribe_count')::int = 1, 'tribe_count';
  ASSERT (p->>'friend_count')::int = 2, 'friend_count (accepted, either side): ' || (p->>'friend_count');
  ASSERT p->>'i_am' = 'a builder', 'i_am';

  -- diary: own, 28 d; targets newest-first
  ASSERT jsonb_array_length(p->'meals') = 2 AND (SELECT sum((m->>'protein_g')::numeric) FROM jsonb_array_elements(p->'meals') m) = 75, 'meals';
  ASSERT jsonb_array_length(p->'targets') = 2 AND (p->'targets'->0->>'protein_g')::numeric = 150 AND (p->'targets'->1->>'protein_g')::numeric = 120,
    'targets newest-first: ' || (p->'targets')::text;
  RAISE NOTICE 'rpc-check whealth_live_inputs as A: ok';
END $$;
RESET ROLE;

-- ---------- whealth_live_inputs as E (nothing logged) ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
DO $$
DECLARE p jsonb := public.whealth_live_inputs();
BEGIN
  ASSERT p->'checkins' = '[]' AND p->'nights' = '[]' AND p->'days' = '[]' AND p->'reflections' = '[]' AND p->'lessons' = '[]'
     AND p->'lifts' = '[]' AND p->'meals' = '[]' AND p->'targets' = '[]', 'empty user lists: ' || p::text;
  ASSERT (p->>'tribe_count')::int = 0 AND (p->>'friend_count')::int = 0 AND p->'i_am' = 'null'::jsonb, 'empty user scalars: ' || p::text;
  ASSERT (p->>'lessons_total')::int = 3, 'lessons_total is catalog-wide (RLS-gated), not per user';
  RAISE NOTICE 'rpc-check whealth_live_inputs as E (empty): ok';
END $$;
RESET ROLE;

-- ---------- anon: neither function is callable ----------
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$
BEGIN
  BEGIN PERFORM public.whealth_live_inputs(); RAISE EXCEPTION 'anon can call whealth_live_inputs';
  EXCEPTION WHEN insufficient_privilege THEN ASSERT SQLSTATE = '42501'; END;
  BEGIN PERFORM public.season_board('aaaaaaaa-0000-4000-8000-00000000000a'); RAISE EXCEPTION 'anon can call season_board';
  EXCEPTION WHEN insufficient_privilege THEN ASSERT SQLSTATE = '42501'; END;
  RAISE NOTICE 'rpc-check as anon: ok (42501)';
END $$;

ROLLBACK;
