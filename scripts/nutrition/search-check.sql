-- ============================================================
-- search_foods at Open Food Facts scale + nutrition_catalog_report()
-- (migration 20260906100000_off_bulk_search.sql).
--
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f scripts/nutrition/search-check.sql
--
-- One generic Fineli milk (FI) against 500 branded OFF rows that all prefix-match
-- "maito": 450 sold in SE, 50 in FI. Same conventions as calc-check.sql: one
-- transaction rolled back, superuser for the service-role paths (ingest_foods,
-- the report), `authenticated` + request.jwt.claims for the member paths,
-- plpgsql ASSERT — the first failure aborts with its message.
-- ============================================================
\set ON_ERROR_STOP on
\set A '11111111-1111-4111-8111-111111111111'

BEGIN;

INSERT INTO auth.users (id, email) VALUES (:'A', 'a@local') ON CONFLICT (id) DO NOTHING;

SELECT count(*) AS fineli_rows FROM public.ingest_foods($json$[
  {"source":"fineli","source_id":"search-milk","name":"Maito, rasvaton","name_en":"Milk, skimmed","country":"FI",
   "nutrients":{"kcal":33,"protein_g":3.3,"carbs_g":4.8,"fat_g":0.1},
   "servings":[{"label":"1 dl","grams":103,"is_default":true}]}
]$json$::jsonb);

-- ingest_foods takes at most 500 rows per call
SELECT count(*) AS off_se_rows FROM public.ingest_foods((
  SELECT jsonb_agg(jsonb_build_object(
    'source', 'off', 'source_id', 'search-se-' || i, 'name', 'Maito juoma ' || i, 'brand', 'Valio',
    'country', 'SE', 'food_type', 'branded', 'data_quality', 3,
    'nutrients', jsonb_build_object('kcal', 40, 'protein_g', 3.4, 'carbs_g', 4.7, 'fat_g', 1.5)))
  FROM generate_series(1, 450) AS i));
SELECT count(*) AS off_fi_rows FROM public.ingest_foods((
  SELECT jsonb_agg(jsonb_build_object(
    'source', 'off', 'source_id', 'search-fi-' || i, 'name', 'Maito juoma ' || i, 'brand', 'Valio',
    'country', 'FI', 'food_type', 'branded', 'data_quality', 3,
    'nutrients', jsonb_build_object('kcal', 40, 'protein_g', 3.4, 'carbs_g', 4.7, 'fat_g', 1.5),
    'barcodes', CASE WHEN i = 1 THEN '["7310865004703"]'::jsonb ELSE '[]'::jsonb END))
  FROM generate_series(1, 50) AS i));

-- ---------- as user A ----------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
DECLARE
  milk uuid; fi1 uuid; rid uuid; res jsonb;
  n_se int; n_fi int;
  r1 real; m1 real; r2 real; m2 real;
BEGIN
  ASSERT auth.uid() = '11111111-1111-4111-8111-111111111111', 'auth.uid() stub not wired';
  SELECT id INTO milk FROM public.foods WHERE source = 'fineli' AND source_id = 'search-milk';
  SELECT id INTO fi1  FROM public.foods WHERE source = 'off'    AND source_id = 'search-fi-1';
  ASSERT (SELECT count(*) FROM public.foods WHERE source = 'off') = 500, 'precondition: 500 OFF rows';

  -- the generic row survives the per-food_type candidate cut and tops the list
  ASSERT (SELECT s.id FROM public.search_foods('maito', 50, 'FI') s LIMIT 1) = milk, 'Fineli milk crowded out by OFF rows';
  ASSERT (SELECT s.id FROM public.search_foods('ma', 50, 'FI') s LIMIT 1) = milk, 'prefix branch: Fineli milk not first';

  -- every FI OFF row outranks every SE OFF row: 50 FI rows exist, so the top 50 has no SE row …
  SELECT count(*) FILTER (WHERE s.country = 'SE'), count(*) FILTER (WHERE s.source = 'off' AND s.country = 'FI')
    INTO n_se, n_fi FROM public.search_foods('maito', 50, 'FI') s;
  ASSERT n_se = 0 AND n_fi = 49, format('p_country FI: %s FI OFF / %s SE rows in the top 50', n_fi, n_se);
  -- … and the boost follows p_country, it is not a hard-coded FI
  SELECT count(*) FILTER (WHERE s.country = 'SE'), count(*) FILTER (WHERE s.country = 'FI')
    INTO n_se, n_fi FROM public.search_foods('maito', 50, 'SE') s;
  ASSERT n_se = 50 AND n_fi = 0, format('p_country SE: %s SE / %s FI rows in the top 50', n_se, n_fi);

  -- match_score is a bounded similarity and rank only ever adds to it
  ASSERT (SELECT bool_and(s.match_score BETWEEN 0 AND 1 AND s.rank >= s.match_score) FROM public.search_foods('maito', 50, 'FI') s),
         'match_score out of [0, 1] or rank below it';
  ASSERT (SELECT bool_and(s.match_score BETWEEN 0 AND 1 AND s.rank >= s.match_score AND s.match_score < 0.9) FROM public.search_foods('juomaa', 50) s),
         'typo query: match_score not a plain similarity';

  -- a barcode hit is a perfect match
  ASSERT (SELECT count(*) FROM public.search_foods(NULL, p_barcode => '7310865004703') s
          WHERE s.id = fi1 AND s.match_score = 1 AND s.rank >= 1) = 1, 'barcode hit must have match_score 1';
  ASSERT (SELECT count(*) FROM public.search_foods(NULL, p_barcode => '96385074')) = 0, 'unknown barcode';

  -- a favourite raises rank, never match_score
  SELECT s.rank, s.match_score INTO r1, m1 FROM public.search_foods('maito', 50, 'FI') s WHERE s.id = milk;
  INSERT INTO public.food_favorites (user_id, food_id) VALUES (auth.uid(), milk);
  SELECT s.rank, s.match_score INTO r2, m2 FROM public.search_foods('maito', 50, 'FI') s WHERE s.id = milk;
  ASSERT r2 > r1 AND m2 = m1, format('favourite: rank %s -> %s, match_score %s -> %s', r1, r2, m1, m2);
  ASSERT (SELECT s.is_favorite FROM public.search_foods('maito', 50, 'FI') s WHERE s.id = milk), 'is_favorite';

  -- recipes: rank = match_score + 0.06
  res := public.upsert_recipe(jsonb_build_object('name', 'Maitokaakao', 'servings', 1, 'items',
           jsonb_build_array(jsonb_build_object('food_id', milk, 'grams', 200))));
  rid := (res->'recipe'->>'id')::uuid;
  SELECT s.rank, s.match_score INTO r1, m1 FROM public.search_foods('maitokaakao') s WHERE s.id = rid AND s.kind = 'recipe';
  ASSERT m1 = 1 AND abs(r1 - 1.06) < 1e-5, format('recipe: rank %s / match_score %s', r1, m1);
  RAISE NOTICE 'search-check as A: ok';
END $$;

-- ---------- report (service-role path) ----------
RESET ROLE;
DO $$
DECLARE r jsonb := public.nutrition_catalog_report();
BEGIN
  ASSERT r->'off'->>'foods' = '500', 'off foods: ' || COALESCE(r->'off', 'null'::jsonb)::text;
  ASSERT (r->'off'->>'no_serving')::int = 500 AND (r->'off'->>'barcodes')::int = 1 AND (r->'off'->>'missing_macro')::int = 0,
         'off counts: ' || (r->'off')::text;
  ASSERT (r->'off'->'coverage'->>'kcal')::int = 500 AND (r->'fineli'->'coverage'->>'kcal')::int = 1, 'coverage: ' || r::text;
  ASSERT (r->'fineli'->>'foods')::int = 1 AND (r->'fineli'->>'no_serving')::int = 0, 'fineli counts: ' || (r->'fineli')::text;
  -- 40 kcal vs 4·3.4 + 4·4.7 + 9·1.5 = 45.9 and 33 vs 33.3: both within 25 %
  ASSERT (r->'off'->>'outlier_count')::int = 0 AND jsonb_array_length(r->'off'->'outliers') = 0
     AND jsonb_array_length(r->'fineli'->'outliers') = 0, 'outliers: ' || r::text;
  RAISE NOTICE 'search-check report: ok';
END $$;

-- a member may not call the report
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    PERFORM public.nutrition_catalog_report();
    RAISE EXCEPTION 'nutrition_catalog_report callable by authenticated';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'search-check grants: ok';
END $$;
RESET ROLE;

ROLLBACK;
