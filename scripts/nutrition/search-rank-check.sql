-- LOCAL DRY RUNS ONLY. The plain food comes first in search_foods.
-- Run after local-stubs.sql and the nutrition migrations (see local-stubs.sql).
-- One transaction rolled back, like the other checks: search-check.sql counts the
-- OFF rows, so nothing here may stay behind.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-0000000000f1') ON CONFLICT DO NOTHING;
INSERT INTO public.foods (source, source_id, name, food_type, country) VALUES
  ('usda_sr_legacy', 'r1', 'Peppers, banana or Hungarian wax, seeded', 'food', NULL),
  ('usda_sr_legacy', 'r2', 'Pepper, banana, raw', 'food', NULL),
  ('usda_sr_legacy', 'r3', 'Snacks, banana chips', 'food', NULL),
  ('usda_sr_legacy', 'r4', 'Melon, banana (Navajo)', 'food', NULL),
  ('usda_sr_legacy', 'r5', 'Bananas, raw', 'food', NULL),
  ('off',            'r6', 'Banana Cake', 'branded', NULL),
  ('off',            'r7', 'Bananas', 'branded', NULL),
  ('off',            'r7b', 'Banana', 'branded', NULL),
  ('fineli',         'r8', 'Maito, kevyt', 'food', 'FI'),
  ('off',            'r9', 'Maitojuoma mansikka', 'branded', 'FI'),
  ('fineli',         'r10', 'Kaurajuoma, maitoa korvaava', 'food', 'FI'),
  ('fineli',         'r11', 'Maitosuklaa', 'food', 'FI'),
  ('fineli',         'r12', 'Kana, broileri, rintafilee', 'food', 'FI'),
  ('fineli',         'r13', 'Kananmuna, keitetty', 'food', 'FI'),
  ('fineli',         'r14', 'Kanakeitto', 'food', 'FI'),
  ('fineli',         'r15', 'Riisi-kana-ateria', 'food', 'FI'),
  ('off',            'r16', 'Kana', 'branded', 'FI'),
  ('usda_sr_legacy', 'r17', 'Egg, whole, raw, fresh', 'food', NULL),
  ('usda_sr_legacy', 'r18', 'Eggnog', 'food', NULL),
  ('usda_sr_legacy', 'r19', 'Eggplant, raw', 'food', NULL),
  ('usda_sr_legacy', 'r20', 'Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw', 'food', NULL);
-- more rows holding the exact word than the candidate cut keeps (200 per partition)
INSERT INTO public.foods (source, source_id, name, food_type)
SELECT 'usda_sr_legacy', 'r-soup-' || i, 'Soup ' || i || ', chicken', 'food' FROM generate_series(1, 250) AS i;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
DO $$
DECLARE v_first text; v_rank_plain int; v_rank_pepper int; r record;
BEGIN
  SELECT name INTO v_first FROM public.search_foods('banana') LIMIT 1;
  ASSERT v_first = 'Bananas, raw', 'banana: expected the plain food first, got ' || COALESCE(v_first, 'nothing');

  SELECT min(rn) FILTER (WHERE name = 'Bananas, raw'), min(rn) FILTER (WHERE name LIKE 'Pepper%')
    INTO v_rank_plain, v_rank_pepper
    FROM (SELECT name, row_number() OVER () AS rn FROM public.search_foods('banana')) t;
  ASSERT v_rank_plain < v_rank_pepper, 'banana peppers still outrank bananas';
  -- every banana-named product still beats a row that merely contains the word
  ASSERT (SELECT bool_and(rn < v_rank_pepper) FROM (SELECT name, row_number() OVER () AS rn FROM public.search_foods('banana')) t
           WHERE name IN ('Bananas', 'Banana', 'Banana Cake')), 'a name that starts with the query should beat an inner word';

  -- the word itself before its compounds and before a branded namesake, with and without the country boost
  FOR r IN SELECT * FROM (VALUES
      ('maito', 'FI', 'Maito, kevyt'), ('maito', NULL, 'Maito, kevyt'),
      ('kana',  'FI', 'Kana, broileri, rintafilee'), ('kana', NULL, 'Kana, broileri, rintafilee'),
      ('egg',   NULL, 'Egg, whole, raw, fresh'), ('eggs', NULL, 'Egg, whole, raw, fresh'),
      ('chicken', NULL, 'Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw')
    ) AS t(q, country, want)
  LOOP
    SELECT name INTO v_first FROM public.search_foods(r.q, 25, r.country) LIMIT 1;
    ASSERT v_first = r.want, format('%s (%s): expected "%s" first, got "%s"', r.q, COALESCE(r.country, '-'), r.want, COALESCE(v_first, 'nothing'));
  END LOOP;

  -- a full compound typed out is still an exact hit
  SELECT name INTO v_first FROM public.search_foods('maitosuklaa') LIMIT 1;
  ASSERT v_first = 'Maitosuklaa', 'maitosuklaa: got ' || COALESCE(v_first, 'nothing');
  -- typos still find something
  ASSERT EXISTS (SELECT 1 FROM public.search_foods('bananna')), 'a typo no longer matches';
END $$;
ROLLBACK;
\echo 'search ranking: all checks passed'
