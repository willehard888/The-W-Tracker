-- ============================================================
-- Nutrition engine math + search + diary invariants (plan Phase 8).
--
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f scripts/nutrition/calc-check.sql
--
-- Runs as the superuser for the service-role paths (ingest_foods) and as
-- `authenticated` + request.jwt.claims for the member paths. Everything is
-- inside one transaction and rolled back, so it is safe to rerun.
-- Assertion style: plpgsql ASSERT; the first failure aborts with its message.
-- ============================================================
\set ON_ERROR_STOP on
\set A '11111111-1111-4111-8111-111111111111'
\set B '22222222-2222-4222-8222-222222222222'

BEGIN;

INSERT INTO auth.users (id, email) VALUES (:'A', 'a@local'), (:'B', 'b@local')
ON CONFLICT (id) DO NOTHING;

-- ---------- catalog (superuser = service role path) ----------
SELECT source_id, action FROM public.ingest_foods($json$[
  {"source":"fineli","source_id":"calc-chicken","name":"Broileri, rintafilee","name_en":"Chicken breast fillet",
   "nutrients":{"kcal":165,"protein_g":31,"fat_g":3.6,"carbs_g":0,"sodium_mg":74},
   "servings":[{"label":"1 fillet","grams":150,"is_default":true}],
   "barcodes":["012345678905"]},
  {"source":"fineli","source_id":"calc-milk","name":"Maito, rasvaton","name_en":"Milk, skimmed",
   "nutrients":{"kcal":33,"protein_g":3.3,"carbs_g":4.8,"fat_g":0.1,"calcium_mg":120},
   "servings":[{"label":"1 dl","grams":103,"is_default":true},{"label":"1 glass (2 dl)","grams":206}]},
  {"source":"fineli","source_id":"calc-quark","name":"Maitorahka","name_en":"Quark",
   "nutrients":{"kcal":60,"protein_g":11,"carbs_g":3.5,"fat_g":0.3}},
  {"source":"fineli","source_id":"calc-bread","name":"Ruisleipä","name_en":"Rye bread",
   "nutrients":{"kcal":220,"protein_g":7.5,"carbs_g":40,"fiber_g":9,"fat_g":1.5},
   "servings":[{"label":"1 slice","grams":30,"is_default":true}]}
]$json$::jsonb);

-- ---------- 1/5 engine + barcodes (superuser) ----------
DO $$
DECLARE
  chicken uuid;
  v       jsonb;
BEGIN
  SELECT id INTO chicken FROM public.foods WHERE source = 'fineli' AND source_id = 'calc-chicken';
  ASSERT chicken IS NOT NULL, 'ingest_foods did not create the chicken';
  ASSERT (SELECT count(*) FROM public.foods WHERE source = 'fineli' AND source_id LIKE 'calc-%') = 4, 'catalog size';
  ASSERT (SELECT barcode FROM public.food_barcodes WHERE food_id = chicken) = '0012345678905', 'barcode normalised on ingest';

  v := public.nutrition_for_grams(chicken, 100);
  ASSERT (v->>'kcal')::numeric = 165 AND (v->>'protein_g')::numeric = 31, '100 g: ' || v;
  ASSERT (v->>'kj')::numeric = 690.36 AND (v->>'carbs_total_g')::numeric = 0 AND (v->>'net_carbs_g')::numeric = 0, 'derived keys: ' || v;

  -- contract: 0 g keeps every key present with value 0 (never {} and never missing)
  v := public.nutrition_for_grams(chicken, 0);
  ASSERT (SELECT count(*) FROM jsonb_object_keys(v)) = 8, '0 g key count (5 stored + 3 derived): ' || v;
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_each_text(v) e WHERE e.value::numeric <> 0), '0 g has a non-zero: ' || v;

  v := public.nutrition_for_grams(chicken, 250);
  ASSERT (v->>'kcal')::numeric = 412.5 AND (v->>'protein_g')::numeric = 77.5
     AND (v->>'sodium_mg')::numeric = 185 AND (v->>'fat_g')::numeric = 9, '250 g = 2.5x: ' || v;

  ASSERT NOT (v ? 'fiber_g') AND NOT (v ? 'sugar_g'), 'absent nutrient must stay absent: ' || v;

  BEGIN
    PERFORM public.nutrition_for_grams(chicken, -1);
    RAISE EXCEPTION 'negative grams accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'INVALID_GRAMS', SQLERRM; END;
  BEGIN
    PERFORM public.nutrition_for_grams(gen_random_uuid(), 100);
    RAISE EXCEPTION 'unknown food accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FOOD_NOT_FOUND', SQLERRM; END;

  ASSERT public.normalize_barcode('012345678905')  = '0012345678905', 'UPC-A -> EAN-13';
  ASSERT public.normalize_barcode('00012345678905') = '0012345678905', 'GTIN-14 with leading 0 -> EAN-13';
  ASSERT public.normalize_barcode('7310865004703') = '7310865004703', 'EAN-13 kept';
  ASSERT public.normalize_barcode('96385074')      = '96385074',      'EAN-8 kept';
  ASSERT public.normalize_barcode('012345678906') IS NULL, 'bad check digit accepted';
  ASSERT public.normalize_barcode('96385075')     IS NULL, 'bad EAN-8 check digit accepted';
  ASSERT public.normalize_barcode('abc') IS NULL AND public.normalize_barcode('') IS NULL
     AND public.normalize_barcode(NULL) IS NULL AND public.normalize_barcode('1234567') IS NULL, 'garbage accepted';
  RAISE NOTICE 'calc-check 1/6 engine + barcodes: ok';
END $$;

-- ---------- 2/5 search (as user A) ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  chicken uuid;
  r       real;
BEGIN
  ASSERT auth.uid() = '11111111-1111-4111-8111-111111111111', 'auth.uid() stub not wired';
  SELECT id INTO chicken FROM public.foods WHERE source = 'fineli' AND source_id = 'calc-chicken';

  SELECT s.rank INTO r FROM public.search_foods('broileri') s WHERE s.id = chicken;
  ASSERT r >= 0.3, 'exact name: rank ' || COALESCE(r::text, 'no hit');
  SELECT s.rank INTO r FROM public.search_foods('Chicken Breast') s WHERE s.id = chicken;
  ASSERT r IS NOT NULL, 'english name did not hit';
  SELECT s.rank INTO r FROM public.search_foods('brolieri') s WHERE s.id = chicken;
  ASSERT r IS NOT NULL, 'typo "brolieri" did not hit (word_similarity candidates)';

  ASSERT (SELECT count(*) FROM public.search_foods(''))    = 0, 'empty query returned rows';
  ASSERT (SELECT count(*) FROM public.search_foods('   ')) = 0, 'blank query returned rows';
  ASSERT (SELECT count(*) FROM public.search_foods(NULL))  = 0, 'NULL query returned rows';
  ASSERT (SELECT count(*) FROM public.search_foods('maito'))    = 2, 'maito should hit milk + quark';
  ASSERT (SELECT count(*) FROM public.search_foods('maito', 1)) = 1, 'p_limit not respected';
  ASSERT (SELECT count(*) FROM public.search_foods('ma'))       = 2, '2-char prefix branch';
  ASSERT (SELECT count(*) FROM public.search_foods('ruisleipa') s WHERE s.name = 'Ruisleipä') = 1, 'unaccent: ruisleipa -> Ruisleipä';
  ASSERT (SELECT s.default_serving_grams FROM public.search_foods('maito, rasvaton') s LIMIT 1) = 103, 'default serving';

  ASSERT (SELECT count(*) FROM public.search_foods(NULL, p_barcode => '012345678905')) = 1, 'known barcode (UPC-A form)';
  ASSERT (SELECT s.id FROM public.search_foods(NULL, p_barcode => '0012345678905') s) = chicken, 'known barcode (EAN-13 form)';
  ASSERT (SELECT s.rank FROM public.search_foods(NULL, p_barcode => '0012345678905') s) >= 1.0, 'barcode hit rank';
  ASSERT (SELECT count(*) FROM public.search_foods(NULL, p_barcode => '7310865004703')) = 0, 'unknown barcode';
  ASSERT (SELECT count(*) FROM public.search_foods(NULL, p_barcode => '012345678906')) = 0, 'invalid barcode';
  RAISE NOTICE 'calc-check 2/6 search: ok';
END $$;

-- ---------- 3/5 diary (as user A) ----------
DO $$
DECLARE
  chicken uuid; bread uuid; milk uuid; fillet uuid; rid uuid;
  m1 uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  m2 uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  m3 uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  m4 uuid := 'aaaaaaaa-0000-4000-8000-000000000004';
  i1 uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  i2 uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  d  date := '2026-09-04';
  res jsonb; t jsonb; n int; x numeric;
BEGIN
  SELECT id INTO chicken FROM public.foods WHERE source = 'fineli' AND source_id = 'calc-chicken';
  SELECT id INTO bread   FROM public.foods WHERE source = 'fineli' AND source_id = 'calc-bread';
  SELECT id INTO milk    FROM public.foods WHERE source = 'fineli' AND source_id = 'calc-milk';
  SELECT id INTO fillet  FROM public.food_servings WHERE food_id = chicken AND label = '1 fillet';

  -- 150 g chicken = 247.5 kcal / 46.5 g protein; 60 g bread = 132 kcal / 4.5 g
  res := public.log_meal(m1, d, 180, 'lunch', jsonb_build_array(
    jsonb_build_object('id', i1, 'kind', 'food', 'food_id', chicken, 'grams', 150, 'serving_id', fillet, 'serving_qty', 1),
    jsonb_build_object('id', i2, 'kind', 'food', 'food_id', bread,   'grams', 60)));
  ASSERT jsonb_array_length(res->'items') = 2, 'log_meal items: ' || res;
  ASSERT (res->'totals'->>'kcal')::numeric = 379.5 AND (res->'totals'->>'protein_g')::numeric = 51, 'log_meal totals: ' || (res->'totals');
  ASSERT (res->'meal'->>'kcal')::numeric = 379.5 AND (res->'meal'->>'protein_g')::numeric = 51
     AND (res->'meal'->>'carbs_g')::numeric = 24 AND (res->'meal'->>'fat_g')::numeric = 6.3, 'trigger-derived meal columns: ' || (res->'meal');
  SELECT sum((i.snapshot->>'kcal')::numeric) INTO x FROM public.meal_log_items i WHERE i.meal_log_id = m1;
  ASSERT x = 379.5, 'totals != sum of item snapshots: ' || x;
  SELECT kcal INTO x FROM public.meal_logs WHERE id = m1;
  ASSERT x = 379.5, 'meal_logs.kcal not maintained by trigger: ' || x;
  ASSERT (SELECT display_name FROM public.meal_log_items WHERE id = i1) = 'Broileri, rintafilee', 'display_name from catalog';

  -- offline replay: same ids again -> still 1 meal / 2 items
  PERFORM public.log_meal(m1, d, 180, 'lunch', jsonb_build_array(
    jsonb_build_object('id', i1, 'kind', 'food', 'food_id', chicken, 'grams', 150),
    jsonb_build_object('id', i2, 'kind', 'food', 'food_id', bread,   'grams', 60)));
  SELECT count(*) INTO n FROM public.meal_logs WHERE id = m1;            ASSERT n = 1, 'replay duplicated the meal';
  SELECT count(*) INTO n FROM public.meal_log_items WHERE meal_log_id = m1; ASSERT n = 2, 'replay duplicated items';

  -- edit = new measurement (re-snapshot from the current food)
  res := public.update_meal_item(i2, p_grams => 90);
  ASSERT (res->'item'->'snapshot'->>'kcal')::numeric = 198 AND (res->'item'->>'grams')::numeric = 90, 're-snapshot: ' || (res->'item');
  ASSERT (res->'meal'->>'kcal')::numeric = 445.5, 'meal after edit: ' || (res->'meal');
  -- serving-based edit: 2 fillets = 300 g
  res := public.update_meal_item(i1, p_serving_qty => 2);
  ASSERT (res->'item'->>'grams')::numeric = 300 AND (res->'item'->'snapshot'->>'kcal')::numeric = 495, 'serving edit: ' || (res->'item');
  res := public.update_meal_item(i1, p_grams => 150);
  ASSERT (res->'meal'->>'kcal')::numeric = 445.5, 'meal after revert: ' || (res->'meal');

  -- duplicate copies snapshots verbatim and is replay-safe
  res := public.duplicate_meal(m1, m2, d, 180, 'dinner');
  ASSERT (SELECT array_agg(i.snapshot ORDER BY i.sort_order) FROM public.meal_log_items i WHERE i.meal_log_id = m1)
       = (SELECT array_agg(i.snapshot ORDER BY i.sort_order) FROM public.meal_log_items i WHERE i.meal_log_id = m2), 'duplicate snapshots differ';
  ASSERT (res->'meal'->>'kcal')::numeric = 445.5 AND res->'meal'->>'source' = 'duplicate', 'duplicate meal: ' || (res->'meal');
  PERFORM public.duplicate_meal(m1, m2, d, 180, 'dinner');
  SELECT count(*) INTO n FROM public.meal_log_items WHERE meal_log_id = m2; ASSERT n = 2, 'duplicate replay copied twice';

  -- day totals = snapshot sums across meals
  t := public.daily_nutrition_totals(d);
  ASSERT jsonb_array_length(t) = 1, 'one day requested: ' || t;
  ASSERT (t->0->'totals'->>'kcal')::numeric = 891 AND (t->0->>'meal_count')::int = 2 AND (t->0->>'item_count')::int = 4, 'day totals: ' || (t->0);
  ASSERT (t->0->'by_slot'->'lunch'->>'kcal')::numeric = 445.5 AND (t->0->'by_slot'->'dinner'->>'kcal')::numeric = 445.5, 'by_slot: ' || (t->0->'by_slot');
  ASSERT t->0->'targets' = 'null'::jsonb, 'targets should be null before upsert: ' || (t->0->'targets');
  t := public.daily_nutrition_totals(d - 2, d);
  ASSERT jsonb_array_length(t) = 3 AND (t->0->>'meal_count')::int = 0 AND (t->0->'totals') = '{}'::jsonb, 'range + empty day: ' || t;
  BEGIN
    PERFORM public.daily_nutrition_totals(d, d + 92);
    RAISE EXCEPTION 'range > 92 days accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'INVALID_RANGE', SQLERRM; END;

  -- targets: COALESCE-patch on (user, effective_from), in force from that day on
  res := public.upsert_nutrition_targets(jsonb_build_object('effective_from', d, 'kcal', 2200, 'protein_g', 150, 'activity_level', 'moderate'));
  ASSERT (res->>'kcal')::int = 2200 AND (res->>'protein_g')::numeric = 150 AND res->>'activity_level' = 'moderate', 'targets: ' || res;
  res := public.upsert_nutrition_targets(jsonb_build_object('effective_from', d, 'protein_g', 160));
  ASSERT (res->>'kcal')::int = 2200 AND (res->>'protein_g')::numeric = 160, 'targets patch must merge: ' || res;
  ASSERT (SELECT count(*) FROM public.nutrition_targets) = 1, 'patch created a second row';
  t := public.daily_nutrition_totals(d);
  ASSERT (t->0->'targets'->>'protein_g')::numeric = 160, 'targets in force: ' || (t->0->'targets');
  t := public.daily_nutrition_totals(d - 1);
  ASSERT t->0->'targets' = 'null'::jsonb, 'target leaked to an earlier day';
  BEGIN
    PERFORM public.upsert_nutrition_targets(jsonb_build_object('effective_from', d, 'kcal', 50));
    RAISE EXCEPTION 'out-of-range kcal accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'INVALID_INPUT%', SQLERRM; END;
  BEGIN
    PERFORM public.upsert_nutrition_targets('{"micro_targets":{"nope_g":1}}'::jsonb);
    RAISE EXCEPTION 'unknown micro target accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'UNKNOWN_NUTRIENT_KEY%', SQLERRM; END;

  -- recipe: milk 400 g (132 kcal / 13.2 g) + bread 120 g (264 kcal / 9 g) = 396 / 22.2 -> per serving 99 / 5.55
  res := public.upsert_recipe(jsonb_build_object('name', 'Rahkapuuro', 'servings', 4, 'items', jsonb_build_array(
    jsonb_build_object('food_id', milk,  'grams', 400),
    jsonb_build_object('food_id', bread, 'grams', 120))));
  ASSERT (res->'per_serving'->>'kcal')::numeric = 99 AND (res->'per_serving'->>'protein_g')::numeric = 5.55, 'recipe per serving: ' || (res->'per_serving');
  ASSERT (res->'per_serving'->>'carbs_total_g')::numeric = 19.5 AND (res->'per_serving'->>'calcium_mg')::numeric = 120, 'recipe derived/micro per serving: ' || (res->'per_serving');
  rid := (res->'recipe'->>'id')::uuid;
  ASSERT public.recipe_nutrition_per_serving(rid) = res->'per_serving', 'recipe_nutrition_per_serving differs from upsert result';
  ASSERT (SELECT count(*) FROM public.nutrition_recipe_items WHERE recipe_id = rid) = 2, 'recipe items';
  -- re-upsert replaces items (sort_order defaults to input order)
  res := public.upsert_recipe(jsonb_build_object('id', rid, 'name', 'Rahkapuuro', 'servings', 2, 'items', jsonb_build_array(
    jsonb_build_object('food_id', milk, 'grams', 400))));
  ASSERT (res->'per_serving'->>'kcal')::numeric = 66, 'recipe re-upsert: ' || (res->'per_serving');
  ASSERT (SELECT count(*) FROM public.nutrition_recipes) = 1 AND (SELECT count(*) FROM public.nutrition_recipe_items WHERE recipe_id = rid) = 1, 'recipe items not replaced';
  ASSERT (SELECT count(*) FROM public.search_foods('rahkapuuro') s WHERE s.kind = 'recipe' AND s.id = rid AND s.kcal = 66 AND s.default_serving_grams = 200) = 1, 'recipe not searchable';

  -- log 3 servings of the recipe: grams = 3 x 400 / 2 = 600, kcal = 132 x 3 / 2 = 198
  res := public.log_meal(m3, d, 180, 'snack', jsonb_build_array(jsonb_build_object('kind', 'recipe', 'recipe_id', rid, 'serving_qty', 3)), NULL, 'recipe');
  ASSERT (res->'items'->0->>'grams')::numeric = 600 AND (res->'items'->0->'snapshot'->>'kcal')::numeric = 198
     AND res->'items'->0->>'display_name' = 'Rahkapuuro', 'recipe item: ' || (res->'items'->0);

  -- quick add: snapshot = the four macros as given
  res := public.log_meal(m4, d, 180, 'snack', jsonb_build_array(jsonb_build_object('kind', 'quick', 'name', 'Lounasbuffet', 'quick', jsonb_build_object('kcal', 300, 'protein_g', 10))), NULL, 'quick');
  ASSERT (res->'meal'->>'kcal')::numeric = 300 AND (res->'meal'->>'protein_g')::numeric = 10 AND (res->'meal'->>'carbs_g')::numeric = 0
     AND res->'items'->0->>'display_name' = 'Lounasbuffet', 'quick meal: ' || res;

  -- delete cascades and the trigger recomputes the parent
  DELETE FROM public.meal_log_items WHERE id = i2;
  SELECT kcal INTO x FROM public.meal_logs WHERE id = m1; ASSERT x = 247.5, 'trigger after delete: ' || x;
  DELETE FROM public.meal_logs WHERE id = m4;
  ASSERT (SELECT count(*) FROM public.meal_log_items WHERE meal_log_id = m4) = 0, 'items not cascaded';

  PERFORM set_config('wf.recipe', rid::text, true);
  RAISE NOTICE 'calc-check 3/6 diary: ok';
END $$;

-- ---------- 4/5 history immutability (superuser re-ingests the food) ----------
RESET ROLE;
DO $$
DECLARE
  chicken uuid;
  i1 uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  m1 uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  x numeric;
BEGIN
  SELECT id INTO chicken FROM public.foods WHERE source = 'fineli' AND source_id = 'calc-chicken';
  PERFORM public.ingest_foods('[{"source":"fineli","source_id":"calc-chicken","name":"Broileri, rintafilee","name_en":"Chicken breast fillet","nutrients":{"kcal":200,"protein_g":40}}]'::jsonb);
  ASSERT (SELECT id FROM public.foods WHERE source = 'fineli' AND source_id = 'calc-chicken') = chicken, 're-ingest changed the food id';
  ASSERT (public.nutrition_for_grams(chicken, 150)->>'kcal')::numeric = 300, 'catalog not updated';
  ASSERT NOT (public.nutrition_for_grams(chicken, 150) ? 'sodium_mg'), 'nutrients not replaced on re-ingest';
  SELECT (snapshot->>'kcal')::numeric INTO x FROM public.meal_log_items WHERE id = i1;
  ASSERT x = 247.5, 'history rewritten: item snapshot kcal ' || x;
  SELECT kcal INTO x FROM public.meal_logs WHERE id = m1;
  ASSERT x = 247.5, 'history rewritten: meal kcal ' || x;
  -- the serving the item pointed at was replaced -> FK SET NULL, snapshot untouched
  ASSERT (SELECT serving_id FROM public.meal_log_items WHERE id = i1) IS NULL, 'serving_id should be SET NULL';
  RAISE NOTICE 'calc-check 4/6 history immutability: ok';
END $$;

-- ---------- 5/5 user foods: owner-only ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE fid uuid;
BEGIN
  fid := public.upsert_user_food('{"name":"Oma proteiinipatukka","brand":"Kotitekoinen",
    "nutrients":{"kcal":200,"protein_g":20,"carbs_g":15},
    "servings":[{"label":"1 patukka","grams":50,"is_default":true}],"barcode":"96385074"}'::jsonb);
  ASSERT (SELECT count(*) FROM public.search_foods('proteiinipatukka') s WHERE s.id = fid AND s.source = 'user') = 1, 'owner cannot find own food';
  ASSERT (SELECT count(*) FROM public.search_foods(NULL, p_barcode => '96385074') s WHERE s.id = fid) = 1, 'owner barcode lookup';
  ASSERT (public.nutrition_for_grams(fid, 50)->>'kcal')::numeric = 100, 'user food math';
  ASSERT (SELECT owner_id FROM public.foods WHERE id = fid) = auth.uid(), 'owner_id';
  -- update keeps the id and replaces nutrients
  ASSERT public.upsert_user_food(jsonb_build_object('id', fid, 'name', 'Oma proteiinipatukka', 'nutrients', '{"kcal":210}'::jsonb)) = fid, 'upsert must keep the id';
  ASSERT NOT (public.nutrition_for_grams(fid, 100) ? 'protein_g'), 'nutrients not replaced';
  BEGIN
    PERFORM public.upsert_user_food('{"name":"x","nutrients":{"kcal":"1"}}'::jsonb);
    RAISE EXCEPTION 'string nutrient accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'UNKNOWN_NUTRIENT_KEY%', SQLERRM; END;
  PERFORM set_config('wf.user_food', fid::text, true);
  RAISE NOTICE 'calc-check 5/6 user food (owner): ok';
END $$;

SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
DO $$
DECLARE fid uuid := current_setting('wf.user_food')::uuid;
BEGIN
  ASSERT auth.uid() = '22222222-2222-4222-8222-222222222222', 'claims switch';
  ASSERT (SELECT count(*) FROM public.search_foods('proteiinipatukka')) = 0, 'user food visible to another user';
  ASSERT (SELECT count(*) FROM public.search_foods(NULL, p_barcode => '96385074')) = 0, 'user barcode visible to another user';
  ASSERT (SELECT count(*) FROM public.foods WHERE id = fid) = 0, 'RLS leak on foods';
  BEGIN
    PERFORM public.nutrition_for_grams(fid, 100);   -- SECURITY INVOKER: B sees neither food nor nutrients
    RAISE EXCEPTION 'B could compute A''s private food';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FOOD_NOT_FOUND', SQLERRM; END;
  BEGIN
    PERFORM public.upsert_user_food(jsonb_build_object('id', fid, 'name', 'hijack', 'nutrients', '{}'::jsonb));
    RAISE EXCEPTION 'B overwrote A''s food';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'FORBIDDEN', SQLERRM; END;
  RAISE NOTICE 'calc-check 5/6 user food (other user): ok';
END $$;

-- ---------- 6/6 verify_checkin: the diary corroborates a protein claim ----------
-- On 2026-09-04 user A has 3 meals: m1 (46.5 g protein), m2 (53.25 g), m3 (19.8 g) = 119.55 g.
RESET ROLE;
INSERT INTO public.profiles (user_id) VALUES ('11111111-1111-4111-8111-111111111111') ON CONFLICT DO NOTHING;
INSERT INTO public.health_sync_snapshots (user_id, snapshot_date, steps) VALUES ('11111111-1111-4111-8111-111111111111', '2026-09-04', 9000);
INSERT INTO public.daily_checkins (id, user_id, protein_intake, checked_in_at)
VALUES ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', true, '2026-09-04 21:00+03');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  cid uuid := 'cccccccc-0000-4000-8000-000000000001';
  res jsonb;
BEGIN
  ASSERT (SELECT round(sum(protein_g), 2) FROM public.meal_logs WHERE log_date = '2026-09-04') = 119.55, 'precondition: day protein';
  -- target 120 g -> 90 % bar = 108 g, 3 meals -> matched; with steps 9000 that is 2 signals -> verified, +20 XP
  PERFORM public.upsert_nutrition_targets('{"effective_from":"2026-09-04","protein_g":120}'::jsonb);
  res := public.verify_checkin(cid, '2026-09-04');
  ASSERT (res->>'ok')::boolean AND (res->>'verified')::boolean, 'not verified: ' || res;
  ASSERT res->'signals'->'nutrition'->>'matched' = 'true' AND (res->'signals'->'nutrition'->>'protein_g')::int = 120
     AND (res->'signals'->'nutrition'->>'meals')::int = 3 AND (res->>'matches')::int = 2 AND (res->>'claims')::int = 0, 'nutrition signal: ' || res;
  ASSERT (res->>'bonus_awarded')::int = 20, 'bonus: ' || res;
  -- a diary match never counts as a claim, and a second call awards nothing more
  res := public.verify_checkin(cid, '2026-09-04');
  ASSERT (res->>'bonus_awarded')::int = 0 AND (res->>'bonus_xp')::int = 20, 'delta guard: ' || res;
  -- target out of reach -> nutrition unmatched, steps alone still verifies (single signal, zero claims -> not verified)
  PERFORM public.upsert_nutrition_targets('{"effective_from":"2026-09-04","protein_g":200}'::jsonb);
  res := public.verify_checkin(cid, '2026-09-04');
  ASSERT res->'signals'->'nutrition'->>'matched' = 'false' AND NOT (res->>'verified')::boolean, 'unmatched target: ' || res;
  RAISE NOTICE 'calc-check 6/6 verify_checkin protein signal: ok';
END $$;
RESET ROLE;
DO $$
BEGIN
  ASSERT (SELECT xp FROM public.profiles WHERE user_id = '11111111-1111-4111-8111-111111111111') = 20, 'profile XP not awarded once';
  ASSERT (SELECT verified_bonus_xp FROM public.daily_checkins WHERE id = 'cccccccc-0000-4000-8000-000000000001') = 20, 'verified_bonus_xp kept after un-verify';
END $$;

ROLLBACK;
