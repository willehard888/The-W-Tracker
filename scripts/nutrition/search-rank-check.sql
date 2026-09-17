-- LOCAL DRY RUNS ONLY. The plain food comes first in search_foods.
-- Run after local-stubs.sql and the nutrition migrations (see local-stubs.sql).
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-0000000000f1') ON CONFLICT DO NOTHING;
INSERT INTO public.foods (source, source_id, name, food_type) VALUES
  ('usda_sr_legacy', 'r1', 'Peppers, banana or Hungarian wax, seeded', 'food'),
  ('usda_sr_legacy', 'r2', 'Pepper, banana, raw', 'food'),
  ('usda_sr_legacy', 'r3', 'Snacks, banana chips', 'food'),
  ('usda_sr_legacy', 'r4', 'Melon, banana (Navajo)', 'food'),
  ('usda_sr_legacy', 'r5', 'Bananas, raw', 'food'),
  ('off',            'r6', 'Banana Cake', 'branded'),
  ('off',            'r7', 'Bananas', 'branded'),
  ('fineli',         'r8', 'Maito, kevyt', 'food'),
  ('off',            'r9', 'Maitojuoma mansikka', 'branded'),
  ('fineli',         'r10', 'Kaurajuoma, maitoa korvaava', 'food');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
DO $$
DECLARE v_first text; v_rank_plain int; v_rank_pepper int;
BEGIN
  SELECT name INTO v_first FROM public.search_foods('banana') LIMIT 1;
  ASSERT v_first = 'Bananas, raw', 'banana: expected the plain food first, got ' || COALESCE(v_first, 'nothing');

  SELECT min(rn) FILTER (WHERE name = 'Bananas, raw'), min(rn) FILTER (WHERE name LIKE 'Pepper%')
    INTO v_rank_plain, v_rank_pepper
    FROM (SELECT name, row_number() OVER () AS rn FROM public.search_foods('banana')) t;
  ASSERT v_rank_plain < v_rank_pepper, 'banana peppers still outrank bananas';
  -- every banana-named product still beats a row that merely contains the word
  ASSERT (SELECT bool_and(rn < v_rank_pepper) FROM (SELECT name, row_number() OVER () AS rn FROM public.search_foods('banana')) t
           WHERE name IN ('Bananas', 'Banana Cake')), 'a name that starts with the query should beat an inner word';

  SELECT name INTO v_first FROM public.search_foods('maito') LIMIT 1;
  ASSERT v_first = 'Maito, kevyt', 'maito: expected the plain Fineli row first, got ' || COALESCE(v_first, 'nothing');
  -- typos still find something
  ASSERT EXISTS (SELECT 1 FROM public.search_foods('bananna')), 'a typo no longer matches';
END $$;
ROLLBACK;
\echo 'search ranking: all checks passed'
