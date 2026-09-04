-- ============================================================
-- Nutrition engine (1/6) — extensions + pure helpers.
--
-- pg_trgm powers fuzzy food search ("brolieri" → "broileri"), unaccent lets
-- "ä/ö" match with or without diacritics. Both live in the `extensions`
-- schema on Supabase, which is INVISIBLE from any function that runs with
-- `SET search_path = public` — and a GENERATED column may only call
-- IMMUTABLE functions. The wrapper below solves both.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- IMMUTABLE wrapper: unaccent() itself is only STABLE (its dictionary can be
-- reloaded), so it cannot be used in a STORED generated column directly.
-- We pin the dictionary explicitly so the result is deterministic.
CREATE OR REPLACE FUNCTION public.f_unaccent(p_text text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
SET search_path = public, extensions
AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, p_text);
$$;

-- Normalise a scanned/typed barcode to the canonical EAN-8 / EAN-13 form used
-- as food_barcodes PK. Returns NULL for anything we refuse to trust:
--   * non-digit garbage, wrong lengths
--   * GTIN-14 that is not a plain 0-padded EAN-13
--   * UPC-A (12) → prepended 0 (EAN-13 superset)
--   * failed GS1 mod-10 check digit (8 and 13 digits)
CREATE OR REPLACE FUNCTION public.normalize_barcode(p_raw text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  v text;
  n int;
  i int;
  s int := 0;
  w int;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  v := regexp_replace(p_raw, '[^0-9]', '', 'g');
  n := length(v);
  IF n = 14 AND left(v, 1) = '0' THEN
    v := substr(v, 2); n := 13;
  ELSIF n = 12 THEN
    v := '0' || v; n := 13;
  END IF;
  IF n <> 8 AND n <> 13 THEN RETURN NULL; END IF;

  -- GS1 mod-10: weights 3,1,3,1… from the rightmost payload digit.
  FOR i IN 1..(n - 1) LOOP
    w := CASE WHEN ((n - 1 - i) % 2) = 0 THEN 3 ELSE 1 END;
    s := s + w * substr(v, i, 1)::int;
  END LOOP;
  IF ((10 - (s % 10)) % 10) <> substr(v, n, 1)::int THEN RETURN NULL; END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.f_unaccent(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_unaccent(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.normalize_barcode(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_barcode(text) TO authenticated, service_role;
