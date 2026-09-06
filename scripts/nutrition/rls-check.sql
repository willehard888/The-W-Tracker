-- ============================================================
-- Row-level security for the nutrition tables: two members A and B.
-- A creates every kind of private row through the RPCs; B must see and
-- touch none of it, directly or via RPC; anon gets nothing at all.
--
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f scripts/nutrition/rls-check.sql
--
-- Runs inside one transaction and rolls back. Role switching mirrors
-- PostgREST: SET LOCAL ROLE + request.jwt.claims. "Blocked" means either a
-- missing grant or an RLS violation — both are SQLSTATE 42501.
-- ============================================================
\set ON_ERROR_STOP on
\set A '11111111-1111-4111-8111-111111111111'
\set B '22222222-2222-4222-8222-222222222222'

BEGIN;

INSERT INTO auth.users (id, email) VALUES (:'A', 'a@local'), (:'B', 'b@local')
ON CONFLICT (id) DO NOTHING;

SELECT source_id, action FROM public.ingest_foods('[
  {"source":"fineli","source_id":"rls-chicken","name":"Broileri, rintafilee","name_en":"Chicken breast fillet",
   "nutrients":{"kcal":165,"protein_g":31,"fat_g":3.6,"carbs_g":0},"barcodes":["012345678905"]}
]'::jsonb);

-- ---------- as A: create private rows through the RPCs ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  chicken uuid; rid uuid; fid uuid; res jsonb;
  m1 uuid := 'aaaaaaaa-0000-4000-8000-0000000000a1';
  i1 uuid := 'bbbbbbbb-0000-4000-8000-0000000000a1';
BEGIN
  SELECT id INTO chicken FROM public.foods WHERE source = 'fineli' AND source_id = 'rls-chicken';
  PERFORM public.log_meal(m1, '2026-09-04', 180, 'lunch',
    jsonb_build_array(jsonb_build_object('id', i1, 'kind', 'food', 'food_id', chicken, 'grams', 100)));
  PERFORM public.upsert_nutrition_targets('{"kcal":2000,"protein_g":140}'::jsonb);
  res := public.upsert_recipe(jsonb_build_object('name', 'R', 'servings', 2, 'items',
           jsonb_build_array(jsonb_build_object('food_id', chicken, 'grams', 100))));
  rid := (res->'recipe'->>'id')::uuid;
  INSERT INTO public.food_favorites (user_id, food_id) VALUES (auth.uid(), chicken);
  fid := public.upsert_user_food('{"name":"Private bar","nutrients":{"kcal":1}}'::jsonb);
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('meal-photos', auth.uid()::text || '/2026-09-04/a.jpg', auth.uid());

  -- A sees own rows
  ASSERT (SELECT count(*) FROM public.meal_logs) = 1 AND (SELECT count(*) FROM public.meal_log_items) = 1
     AND (SELECT count(*) FROM public.nutrition_targets) = 1 AND (SELECT count(*) FROM public.nutrition_recipes) = 1
     AND (SELECT count(*) FROM public.nutrition_recipe_items) = 1 AND (SELECT count(*) FROM public.food_favorites) = 1
     AND (SELECT count(*) FROM public.foods WHERE owner_id = auth.uid()) = 1
     AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'meal-photos') = 1, 'A does not see own rows';

  -- A may edit the note of an own meal ...
  UPDATE public.meal_logs SET note = 'edited' WHERE id = m1;
  ASSERT FOUND, 'A cannot edit own note';
  -- ... but never the trigger-derived columns (protein_g feeds verify_checkin XP)
  BEGIN
    UPDATE public.meal_logs SET protein_g = 999 WHERE id = m1;
    RAISE EXCEPTION 'A wrote meal_logs.protein_g directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- ... and diary rows are RPC-only even for oneself
  BEGIN
    INSERT INTO public.meal_logs (id, user_id, log_date, meal_slot) VALUES (gen_random_uuid(), auth.uid(), current_date, 'snack');
    RAISE EXCEPTION 'direct INSERT into meal_logs succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.meal_log_items (id, meal_log_id, user_id, kind, grams, display_name) VALUES (gen_random_uuid(), m1, auth.uid(), 'quick', 1, 'x');
    RAISE EXCEPTION 'direct INSERT into meal_log_items succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.meal_log_items SET snapshot = '{"kcal":9999}' WHERE id = i1;
    IF FOUND THEN RAISE EXCEPTION 'A rewrote an item snapshot directly'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.nutrition_targets (user_id, kcal) VALUES (auth.uid(), 1000);
    RAISE EXCEPTION 'direct INSERT into nutrition_targets succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.meal_scan_cache (user_id, image_sha256, model, result) VALUES (auth.uid(), repeat('b', 64), 'x', '{}');
    RAISE EXCEPTION 'member wrote meal_scan_cache';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- a photo path outside the caller's folder is refused by the RPC
  BEGIN
    PERFORM public.log_meal(gen_random_uuid(), current_date, 0, 'lunch', '[{"kind":"quick","quick":{"kcal":1}}]'::jsonb, NULL, 'scan',
                            '22222222-2222-4222-8222-222222222222/x.jpg');
    RAISE EXCEPTION 'foreign photo_path accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FORBIDDEN', SQLERRM; END;

  PERFORM set_config('wf.recipe', rid::text, true);
  PERFORM set_config('wf.user_food', fid::text, true);
  RAISE NOTICE 'rls-check as A: ok';
END $$;
RESET ROLE;

-- service-side row (edge function writes as service_role)
INSERT INTO public.meal_scan_cache (id, user_id, image_sha256, model, result)
VALUES ('cccccccc-0000-4000-8000-0000000000a1', :'A', repeat('a', 64), 'test', '{}');

-- ---------- as A again: scan review is RPC-only, own rows visible ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  sid uuid := 'cccccccc-0000-4000-8000-0000000000a1';
  n int;
BEGIN
  n := public.record_scan_review(sid, '[{"item_index":0,"model_name":"Chicken","model_grams":150,"final_grams":120,"action":"grams_edited"}]'::jsonb);
  ASSERT n = 1, 'record_scan_review did not return 1';
  ASSERT (SELECT count(*) FROM public.meal_scan_reviews) = 1, 'A does not see own review';
  ASSERT (SELECT image_sha256 FROM public.meal_scan_reviews LIMIT 1) = repeat('a', 64), 'review did not copy the cache sha';
  BEGIN
    INSERT INTO public.meal_scan_reviews (user_id, scan_id, item_index, action) VALUES (auth.uid(), sid, 0, 'kept');
    RAISE EXCEPTION 'member wrote meal_scan_reviews directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.record_scan_review(sid, '[{"item_index":0,"action":"hacked"}]'::jsonb);
    RAISE EXCEPTION 'bad action accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'BAD_ACTION', SQLERRM; END;
  ASSERT jsonb_typeof(public.scan_user_priors()) = 'array', 'scan_user_priors as A';
  UPDATE public.profiles SET nutrition_prefs = '{"plate_cm":30}' WHERE user_id = auth.uid();
  RAISE NOTICE 'rls-check scan review as A: ok';
END $$;
RESET ROLE;

-- ---------- as B: nothing of A's is visible or writable ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
DO $$
DECLARE
  a   uuid := '11111111-1111-4111-8111-111111111111';
  m1  uuid := 'aaaaaaaa-0000-4000-8000-0000000000a1';
  i1  uuid := 'bbbbbbbb-0000-4000-8000-0000000000a1';
  rid uuid := current_setting('wf.recipe')::uuid;
  fid uuid := current_setting('wf.user_food')::uuid;
  chicken uuid;
  n int;
BEGIN
  ASSERT auth.uid() = '22222222-2222-4222-8222-222222222222', 'claims switch';
  SELECT id INTO chicken FROM public.foods WHERE source = 'fineli' AND source_id = 'rls-chicken';

  -- SELECT
  ASSERT (SELECT count(*) FROM public.meal_logs)             = 0, 'meal_logs leak';
  ASSERT (SELECT count(*) FROM public.meal_log_items)        = 0, 'meal_log_items leak';
  ASSERT (SELECT count(*) FROM public.nutrition_targets)     = 0, 'nutrition_targets leak';
  ASSERT (SELECT count(*) FROM public.nutrition_recipes)     = 0, 'nutrition_recipes leak';
  ASSERT (SELECT count(*) FROM public.nutrition_recipe_items)= 0, 'nutrition_recipe_items leak';
  ASSERT (SELECT count(*) FROM public.food_favorites)        = 0, 'food_favorites leak';
  ASSERT (SELECT count(*) FROM public.meal_scan_cache)       = 0, 'meal_scan_cache leak';
  ASSERT (SELECT count(*) FROM public.meal_scan_reviews)     = 0, 'meal_scan_reviews leak';
  ASSERT public.scan_user_priors() = '[]'::jsonb, 'scan_user_priors leaks A''s portions';
  BEGIN
    PERFORM public.record_scan_review('cccccccc-0000-4000-8000-0000000000a1', '[{"item_index":0,"action":"kept"}]'::jsonb);
    RAISE EXCEPTION 'B reviewed A''s scan';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FORBIDDEN', SQLERRM; END;
  ASSERT (SELECT count(*) FROM public.foods WHERE id = fid)  = 0, 'user food leak';
  ASSERT (SELECT count(*) FROM public.food_nutrients fn WHERE fn.food_id = fid) = 0, 'user food nutrients leak';
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'meal-photos') = 0, 'storage leak';
  BEGIN
    ASSERT (SELECT count(*) FROM public.food_barcode_misses) = 0, 'food_barcode_misses readable by members';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;   -- no grant at all is also fine

  -- direct INSERT as A
  BEGIN
    INSERT INTO public.meal_logs (id, user_id, log_date, meal_slot) VALUES (gen_random_uuid(), a, current_date, 'lunch');
    RAISE EXCEPTION 'B inserted a meal for A';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.food_favorites (user_id, food_id) VALUES (a, chicken);
    RAISE EXCEPTION 'B favourited as A';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('meal-photos', a::text || '/x.jpg', a);
    RAISE EXCEPTION 'B uploaded into A''s folder';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- own folder is fine
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('meal-photos', auth.uid()::text || '/b.jpg', auth.uid());
  ASSERT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'meal-photos') = 1, 'B does not see own photo';

  -- UPDATE / DELETE A's rows: 0 rows
  UPDATE public.meal_logs SET note = 'hacked' WHERE user_id = a;        GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B updated A''s meal';
  DELETE FROM public.meal_logs WHERE user_id = a;                        GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B deleted A''s meal';
  DELETE FROM public.meal_log_items WHERE user_id = a;                   GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B deleted A''s items';
  DELETE FROM public.nutrition_targets WHERE user_id = a;                GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B deleted A''s targets';
  DELETE FROM public.nutrition_recipes WHERE user_id = a;                GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B deleted A''s recipes';
  DELETE FROM public.food_favorites WHERE user_id = a;                   GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B deleted A''s favorites';
  DELETE FROM public.foods WHERE id = fid;                               GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B deleted A''s food';
  DELETE FROM storage.objects WHERE bucket_id = 'meal-photos' AND owner = a; GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'B deleted A''s photo';

  -- RPCs on A's objects
  BEGIN
    PERFORM public.update_meal_item(i1, p_grams => 10);
    RAISE EXCEPTION 'B edited A''s item';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FORBIDDEN', SQLERRM; END;
  BEGIN
    PERFORM public.duplicate_meal(m1, gen_random_uuid(), current_date, 0, 'lunch');
    RAISE EXCEPTION 'B duplicated A''s meal';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FORBIDDEN', SQLERRM; END;
  BEGIN
    PERFORM public.log_meal(m1, current_date, 0, 'lunch', '[{"kind":"quick","quick":{"kcal":1}}]'::jsonb);
    RAISE EXCEPTION 'B appended to A''s meal';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FORBIDDEN', SQLERRM; END;
  BEGIN
    PERFORM public.recipe_nutrition_per_serving(rid);
    RAISE EXCEPTION 'B read A''s recipe';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'RECIPE_NOT_FOUND', SQLERRM; END;
  BEGIN
    PERFORM public.log_meal(gen_random_uuid(), current_date, 0, 'lunch', jsonb_build_array(jsonb_build_object('kind', 'recipe', 'recipe_id', rid)));
    RAISE EXCEPTION 'B logged A''s recipe';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'RECIPE_NOT_FOUND', SQLERRM; END;
  BEGIN
    PERFORM public.log_meal(gen_random_uuid(), current_date, 0, 'lunch', jsonb_build_array(jsonb_build_object('kind', 'food', 'food_id', fid, 'grams', 10)));
    RAISE EXCEPTION 'B logged A''s private food';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FOOD_NOT_FOUND', SQLERRM; END;
  BEGIN
    PERFORM public.upsert_recipe(jsonb_build_object('id', rid, 'name', 'stolen', 'servings', 1, 'items', jsonb_build_array(jsonb_build_object('food_id', chicken, 'grams', 1))));
    RAISE EXCEPTION 'B overwrote A''s recipe';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FORBIDDEN', SQLERRM; END;
  ASSERT (SELECT count(*) FROM public.search_foods('private bar')) = 0, 'search leaks A''s food';

  -- catalog + engine are available to every member ...
  ASSERT (SELECT count(*) FROM public.food_sources) = 6 AND (SELECT count(*) FROM public.nutrient_definitions) = 49, 'catalog not readable';
  ASSERT (SELECT count(*) FROM public.foods WHERE owner_id IS NULL) = 1 AND (SELECT count(*) FROM public.food_barcodes) = 1, 'public foods not readable';
  ASSERT (SELECT count(*) FROM public.search_foods('broileri') s WHERE s.id = chicken) = 1, 'search_foods as authenticated';
  ASSERT (public.nutrition_for_grams(chicken, 100)->>'kcal')::numeric = 165, 'nutrition_for_grams as authenticated';
  ASSERT public.normalize_barcode('96385074') = '96385074', 'normalize_barcode as authenticated';
  ASSERT jsonb_array_length(public.daily_nutrition_totals(current_date)) = 1, 'daily_nutrition_totals as authenticated';
  -- ... ingestion is not
  BEGIN
    PERFORM public.ingest_foods('[{"source":"fineli","source_id":"x","name":"x"}]'::jsonb);
    RAISE EXCEPTION 'ingest_foods callable by authenticated';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.foods (source, source_id, name) VALUES ('fineli', 'forged', 'Forged public food');
    RAISE EXCEPTION 'member inserted a public catalog food';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.food_nutrients SET amount_per_100g = 0 WHERE food_id = chicken;
    IF FOUND THEN RAISE EXCEPTION 'member edited public catalog nutrients'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'rls-check as B: ok';
END $$;

-- ---------- anon: nothing ----------
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$
BEGIN
  BEGIN PERFORM public.search_foods('broileri');           RAISE EXCEPTION 'anon can search';    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.nutrition_for_grams(gen_random_uuid(), 1); RAISE EXCEPTION 'anon can compute'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.log_meal(gen_random_uuid(), current_date, 0, 'lunch', '[]'::jsonb); RAISE EXCEPTION 'anon can log'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.daily_nutrition_totals(current_date); RAISE EXCEPTION 'anon can read totals'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.scan_user_priors(); RAISE EXCEPTION 'anon can read priors'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.record_scan_review(gen_random_uuid(), '[]'::jsonb); RAISE EXCEPTION 'anon can review'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- Supabase's default grants give anon SELECT; every policy is TO authenticated, so anon gets 0 rows (or no grant at all locally).
  BEGIN PERFORM 1 FROM public.foods; IF FOUND THEN RAISE EXCEPTION 'anon can read foods'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.meal_logs; IF FOUND THEN RAISE EXCEPTION 'anon can read meals'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'rls-check as anon: ok';
END $$;

ROLLBACK;
