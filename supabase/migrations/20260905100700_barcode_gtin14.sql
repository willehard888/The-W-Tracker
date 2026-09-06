-- ============================================================
-- Barcode normalisation, round two: GTIN-14 → consumer-unit GTIN-13, and
-- zero-padded EAN-8.
--
-- ITF-14 on outer cases, Code 128 AI (01) and GS1 Digital Link payloads all
-- carry a 14-digit GTIN whose first (indicator) digit is packaging level, not
-- identity: digits 2-13 + a fresh check digit is the EAN-13 printed on the
-- consumer unit. Indicator 9 = variable-measure item (priced by weight) with
-- no single consumer code → NULL. A 13-digit code starting 00000 is an EAN-8
-- padded by a label printer → the 8 digits.
--
-- THREE MIRRORS must agree — change all or none:
--   * public.normalize_barcode                       (this file)
--   * src/lib/nutrition/barcode.ts                   (client; also UPC-E + payload parsing)
--   * supabase/functions/nutrition-lookup/map.ts     (edge function)
-- Shared vectors: scripts/nutrition/calc-check.sql, barcode.test.ts,
-- nutrition-lookup-map.test.ts.
-- ============================================================

-- GS1 mod-10 check digit for a payload WITHOUT its check digit
-- (weights 3,1,3,1… from the rightmost payload digit).
CREATE OR REPLACE FUNCTION public.gs1_check_digit(p_body text)
RETURNS int
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
SET search_path = public
AS $$
  SELECT ((10 - (COALESCE(sum(substr(p_body, i, 1)::int * CASE WHEN (length(p_body) - i) % 2 = 0 THEN 3 ELSE 1 END), 0) % 10)) % 10)::int
  FROM generate_series(1, length(p_body)) AS i;
$$;

CREATE OR REPLACE FUNCTION public.normalize_barcode(p_raw text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  v text;
  n int;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  v := regexp_replace(p_raw, '[^0-9]', '', 'g');
  n := length(v);
  IF n = 14 THEN
    IF left(v, 1) = '9' OR public.gs1_check_digit(left(v, 13)) <> substr(v, 14, 1)::int THEN RETURN NULL; END IF;
    v := substr(v, 2, 12);
    v := v || public.gs1_check_digit(v)::text;
    n := 13;
  END IF;
  IF n = 12 THEN v := '0' || v; n := 13; END IF;
  IF n = 13 AND left(v, 5) = '00000' THEN v := substr(v, 6); n := 8; END IF;
  IF n <> 8 AND n <> 13 THEN RETURN NULL; END IF;
  IF public.gs1_check_digit(left(v, n - 1)) <> substr(v, n, 1)::int THEN RETURN NULL; END IF;
  RETURN v;
END;
$$;

-- normalize_barcode is SECURITY INVOKER, so every caller needs EXECUTE on the helper too.
REVOKE ALL ON FUNCTION public.gs1_check_digit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gs1_check_digit(text) TO authenticated, service_role;
