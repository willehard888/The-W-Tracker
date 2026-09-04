-- ============================================================
-- Engine contract: SQL nutrition_for_grams(food_id, grams) must reproduce
-- src/lib/nutrition/__fixtures__/contract.json byte-for-byte (same key set,
-- every value numerically equal). The client scale() asserts the same file.
--
-- Run from the repo root (the fixture is read via a psql backtick):
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f scripts/nutrition/contract-check.sql
-- Rolls back: leaves no rows behind.
-- ============================================================
\set ON_ERROR_STOP on
\set contract `cat src/lib/nutrition/__fixtures__/contract.json`

BEGIN;
-- psql variables are not expanded inside dollar-quoted bodies; hand the JSON over via a GUC.
SELECT set_config('wf.contract', :'contract', true) IS NOT NULL AS fixture_loaded;

DO $$
DECLARE
  cases    jsonb := current_setting('wf.contract')::jsonb;
  c        jsonb;
  i        int := 0;
  fid      uuid;
  actual   jsonb;
  expected jsonb;
  diff     text;
  bad      text[] := '{}';
BEGIN
  ASSERT jsonb_typeof(cases) = 'array' AND jsonb_array_length(cases) > 0, 'fixture not loaded — run from the repo root';

  FOR c IN SELECT value FROM jsonb_array_elements(cases) LOOP
    i := i + 1;
    -- one catalog food per case, its per-100 g vector = the fixture's per100g
    SELECT food_id INTO fid FROM public.ingest_foods(jsonb_build_array(jsonb_build_object(
      'source', 'usda_foundation', 'source_id', 'contract-' || i, 'name', 'contract case ' || i,
      'nutrients', c->'per100g')));

    actual   := public.nutrition_for_grams(fid, (c->>'grams')::numeric);
    expected := c->'expected';

    -- symmetric difference of the key sets + per-key numeric inequality
    SELECT string_agg(format('%s expected=%s actual=%s', ks.k, expected->ks.k, actual->ks.k), ', ' ORDER BY ks.k)
      INTO diff
    FROM (SELECT jsonb_object_keys(expected) AS k UNION SELECT jsonb_object_keys(actual)) ks
    WHERE expected->ks.k IS NULL OR actual->ks.k IS NULL
       OR (expected->>ks.k)::numeric - (actual->>ks.k)::numeric <> 0;

    IF diff IS NOT NULL THEN
      bad := bad || format('[%s] %s: %s', i, c->>'label', diff);
    END IF;
  END LOOP;

  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION E'contract: % of % cases MISMATCH\n%', cardinality(bad), i, array_to_string(bad, E'\n');
  END IF;
  RAISE NOTICE 'contract: all % cases match', i;
END $$;

ROLLBACK;
