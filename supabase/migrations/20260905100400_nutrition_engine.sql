-- ============================================================
-- Nutrition engine (5/6) — every RPC. Created after all tables exist.
--
-- Error contract (RAISE EXCEPTION message = machine-readable code):
--   UNAUTHENTICATED · PREMIUM_REQUIRED · FORBIDDEN · FOOD_NOT_FOUND · RECIPE_NOT_FOUND
--   INVALID_GRAMS · INVALID_ITEMS · INVALID_KIND · INVALID_QUICK · INVALID_SERVING
--   INVALID_SLOT · INVALID_SOURCE · INVALID_RANGE · INVALID_INPUT · UNKNOWN_NUTRIENT_KEY
-- ============================================================

-- ---------- pure helpers ----------

-- THE contract: every stored nutrient scaled to p_grams, 3 decimals; absent stays
-- absent (never 0); derived carbs_total_g / net_carbs_g / kj. The client scale()
-- mirrors this byte-for-byte (src/lib/nutrition/__fixtures__/contract.json).
CREATE OR REPLACE FUNCTION public.nutrition_for_grams(p_food_id uuid, p_grams numeric)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v       jsonb;
  v_carbs numeric;
  v_kcal  numeric;
BEGIN
  -- NaN = NaN is true for numeric; > 1e9 also rejects +Infinity.
  IF p_grams IS NULL OR p_grams = 'NaN'::numeric OR p_grams < 0 OR p_grams > 1e9 THEN
    RAISE EXCEPTION 'INVALID_GRAMS';
  END IF;

  SELECT jsonb_object_agg(d.key, round(n.amount_per_100g * p_grams / 100.0, 3))
    INTO v
  FROM food_nutrients n
  JOIN nutrient_definitions d ON d.id = n.nutrient_id
  WHERE n.food_id = p_food_id;

  IF v IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM foods f WHERE f.id = p_food_id) THEN
      RAISE EXCEPTION 'FOOD_NOT_FOUND';
    END IF;
    RETURN '{}'::jsonb;
  END IF;

  v_carbs := (v->>'carbs_g')::numeric;
  IF v_carbs IS NOT NULL THEN
    v := v || jsonb_build_object(
      'carbs_total_g', round(v_carbs + COALESCE((v->>'fiber_g')::numeric, 0), 3),
      'net_carbs_g',   round(v_carbs - COALESCE((v->>'sugar_alcohol_g')::numeric, 0), 3));
  END IF;
  v_kcal := (v->>'kcal')::numeric;
  IF v_kcal IS NOT NULL THEN
    v := v || jsonb_build_object('kj', round(v_kcal * 4.184, 3));
  END IF;
  RETURN v;
END;
$$;

-- Key-wise sum of nutrient vectors. Non-numeric values are ignored. {} for none.
CREATE OR REPLACE FUNCTION public.sum_nutrition(p_items jsonb[])
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(t.k, round(t.s, 3)), '{}'::jsonb)
  FROM (
    SELECT e.key AS k, sum(e.value::numeric) AS s
    FROM unnest(p_items) AS it
    CROSS JOIN LATERAL jsonb_each(it) AS e
    WHERE jsonb_typeof(e.value) = 'number'
    GROUP BY e.key
  ) t;
$$;

-- Multiply every numeric key by p_num / p_den (exact numeric, then round 3).
-- Used for recipe per-serving (1 / servings) and logged servings (qty / servings).
CREATE OR REPLACE FUNCTION public.scale_nutrition(p_vec jsonb, p_num numeric, p_den numeric)
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(e.key, round(e.value::numeric * p_num / p_den, 3)), '{}'::jsonb)
  FROM jsonb_each(COALESCE(p_vec, '{}'::jsonb)) AS e
  WHERE jsonb_typeof(e.value) = 'number';
$$;

-- ---------- catalog ingestion (service role only) ----------
-- Input: array of
--   { source, source_id, name, name_fi?, name_en?, brand?, country?, category?, food_type?,
--     data_quality?, image_url?, source_version?, is_active?,
--     servings?: [{label, grams, source_unit?, is_default?, sort_order?}],
--     nutrients?: {<nutrient key>: amount_per_100g},   -- unknown key = exception
--     barcodes?: [raw strings] }
-- Set-based: one upsert per batch, then replace children for the touched foods.
CREATE OR REPLACE FUNCTION public.ingest_foods(p_foods jsonb)
RETURNS TABLE(source_id text, food_id uuid, action text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
-- OUT columns source_id / food_id would otherwise be ambiguous inside ON CONFLICT (…) lists.
#variable_conflict use_column
DECLARE
  v_bad text;
BEGIN
  IF p_foods IS NULL OR jsonb_typeof(p_foods) <> 'array' OR jsonb_array_length(p_foods) = 0
     OR jsonb_array_length(p_foods) > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  SELECT e->>'source' INTO v_bad FROM jsonb_array_elements(p_foods) e
  WHERE COALESCE(e->>'source', '') = 'user'
     OR NOT EXISTS (SELECT 1 FROM food_sources fs WHERE fs.code = e->>'source')
     OR COALESCE(e->>'source_id', '') = '' OR COALESCE(btrim(e->>'name'), '') = ''
  LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'INVALID_INPUT: source=%', v_bad; END IF;

  SELECT kv.key INTO v_bad
  FROM jsonb_array_elements(p_foods) e
  CROSS JOIN LATERAL jsonb_each(COALESCE(e->'nutrients', '{}'::jsonb)) kv
  WHERE NOT EXISTS (SELECT 1 FROM nutrient_definitions d WHERE d.key = kv.key)
  LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'UNKNOWN_NUTRIENT_KEY: %', v_bad; END IF;

  -- 1) foods (DISTINCT ON guards "cannot affect row a second time")
  RETURN QUERY
  WITH src AS (
    SELECT DISTINCT ON (x.source, x.source_id) x.*
    FROM jsonb_to_recordset(p_foods) AS x(
      source text, source_id text, name text, name_fi text, name_en text, brand text,
      country text, category text, food_type text, data_quality smallint, image_url text,
      source_version text, is_active boolean)
  ),
  up AS (
    INSERT INTO foods AS f (source, source_id, name, name_fi, name_en, brand, country, category,
                            food_type, data_quality, image_url, source_version, fetched_at, is_active, updated_at)
    SELECT s.source, s.source_id, left(btrim(s.name), 200), s.name_fi, s.name_en, s.brand,
           upper(left(s.country, 2)), s.category,
           COALESCE(s.food_type, CASE WHEN s.brand IS NOT NULL THEN 'branded' ELSE 'food' END),
           COALESCE(s.data_quality, fs.default_quality), s.image_url, s.source_version, now(),
           COALESCE(s.is_active, true), now()
    FROM src s JOIN food_sources fs ON fs.code = s.source
    ON CONFLICT (source, source_id) DO UPDATE SET
      name = EXCLUDED.name, name_fi = EXCLUDED.name_fi, name_en = EXCLUDED.name_en,
      brand = EXCLUDED.brand, country = EXCLUDED.country, category = EXCLUDED.category,
      food_type = EXCLUDED.food_type, data_quality = EXCLUDED.data_quality,
      image_url = EXCLUDED.image_url, source_version = EXCLUDED.source_version,
      fetched_at = now(), is_active = EXCLUDED.is_active, updated_at = now()
    RETURNING f.id, f.source_id, (xmax = 0) AS inserted
  )
  SELECT up.source_id, up.id, CASE WHEN up.inserted THEN 'inserted' ELSE 'updated' END FROM up;

  -- 2) servings: replace
  DELETE FROM food_servings s
  USING foods f, (SELECT DISTINCT e->>'source' AS source, e->>'source_id' AS source_id FROM jsonb_array_elements(p_foods) e) x
  WHERE f.source = x.source AND f.source_id = x.source_id AND s.food_id = f.id;

  INSERT INTO food_servings (food_id, label, grams, source_unit, is_default, sort_order)
  SELECT f.id, left(btrim(sv.label), 80), sv.grams, sv.source_unit, COALESCE(sv.is_default, false), COALESCE(sv.sort_order, 0)
  FROM jsonb_array_elements(p_foods) e
  JOIN foods f ON f.source = e->>'source' AND f.source_id = e->>'source_id'
  CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(e->'servings', '[]'::jsonb))
    AS sv(label text, grams numeric, source_unit text, is_default boolean, sort_order int)
  WHERE COALESCE(btrim(sv.label), '') <> '' AND sv.grams > 0 AND sv.grams <= 5000
  ON CONFLICT (food_id, label) DO NOTHING;

  -- 3) nutrients: replace (negative values are dropped, never stored)
  DELETE FROM food_nutrients n
  USING foods f, (SELECT DISTINCT e->>'source' AS source, e->>'source_id' AS source_id FROM jsonb_array_elements(p_foods) e) x
  WHERE f.source = x.source AND f.source_id = x.source_id AND n.food_id = f.id;

  INSERT INTO food_nutrients (food_id, nutrient_id, amount_per_100g)
  SELECT f.id, d.id, kv.value::numeric
  FROM jsonb_array_elements(p_foods) e
  JOIN foods f ON f.source = e->>'source' AND f.source_id = e->>'source_id'
  CROSS JOIN LATERAL jsonb_each(COALESCE(e->'nutrients', '{}'::jsonb)) kv
  JOIN nutrient_definitions d ON d.key = kv.key
  WHERE jsonb_typeof(kv.value) = 'number' AND kv.value::numeric >= 0
  ON CONFLICT (food_id, nutrient_id) DO UPDATE SET amount_per_100g = EXCLUDED.amount_per_100g;

  -- 4) barcodes: one product per code. A mapping is replaced only when the new
  --    source has a HIGHER priority, or the old mapping points at a user's private
  --    food (a public product must win over one member's custom entry, or nobody
  --    else could ever scan it).
  INSERT INTO food_barcodes AS b (barcode, food_id, source)
  SELECT c.code, c.food_id, c.source
  FROM (
    SELECT DISTINCT ON (bc.code) bc.code, f.id AS food_id, f.source, fs.priority
    FROM jsonb_array_elements(p_foods) e
    JOIN foods f ON f.source = e->>'source' AND f.source_id = e->>'source_id'
    JOIN food_sources fs ON fs.code = f.source
    CROSS JOIN LATERAL (
      SELECT public.normalize_barcode(v) AS code FROM jsonb_array_elements_text(COALESCE(e->'barcodes', '[]'::jsonb)) v
    ) bc
    WHERE bc.code IS NOT NULL
    ORDER BY bc.code, fs.priority DESC
  ) c
  ON CONFLICT (barcode) DO UPDATE SET food_id = EXCLUDED.food_id, source = EXCLUDED.source, created_at = now()
  WHERE (SELECT fs.priority FROM food_sources fs WHERE fs.code = EXCLUDED.source)
        > (SELECT fs.priority FROM food_sources fs WHERE fs.code = b.source)
     OR EXISTS (SELECT 1 FROM foods pf WHERE pf.id = b.food_id AND pf.owner_id IS NOT NULL);

  -- 5) a code we now know is no longer a miss
  DELETE FROM food_barcode_misses m
  USING (
    SELECT DISTINCT public.normalize_barcode(v) AS code
    FROM jsonb_array_elements(p_foods) e, jsonb_array_elements_text(COALESCE(e->'barcodes', '[]'::jsonb)) v
  ) c
  WHERE m.barcode = c.code;

  RETURN;
END;
$$;

-- ---------- custom foods ----------
-- { id?, name, brand?, category?, servings?: [...], nutrients: {...}, barcode? }
-- source 'user', owner = caller, quality 4. Servings/nutrients are replaced.
CREATE OR REPLACE FUNCTION public.upsert_user_food(p_food jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid       uuid := auth.uid();
  v_id      uuid;
  v_name    text;
  v_bad     text;
  v_barcode text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_food IS NULL OR jsonb_typeof(p_food) <> 'object' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;

  v_name := left(btrim(p_food->>'name'), 200);
  IF COALESCE(v_name, '') = '' THEN RAISE EXCEPTION 'INVALID_INPUT: name'; END IF;

  v_id := COALESCE((p_food->>'id')::uuid, gen_random_uuid());
  IF EXISTS (SELECT 1 FROM foods f WHERE f.id = v_id AND (f.owner_id IS DISTINCT FROM uid OR f.source <> 'user')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF jsonb_typeof(COALESCE(p_food->'nutrients', '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'INVALID_INPUT: nutrients'; END IF;
  SELECT kv.key INTO v_bad
  FROM jsonb_each(COALESCE(p_food->'nutrients', '{}'::jsonb)) kv
  WHERE NOT EXISTS (SELECT 1 FROM nutrient_definitions d WHERE d.key = kv.key)
     OR jsonb_typeof(kv.value) <> 'number' OR kv.value::numeric < 0 OR kv.value::numeric > 100000
  LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'UNKNOWN_NUTRIENT_KEY: %', v_bad; END IF;

  IF jsonb_typeof(COALESCE(p_food->'servings', '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_food->'servings', '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'INVALID_SERVING';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(COALESCE(p_food->'servings', '[]'::jsonb)) AS sv(label text, grams numeric)
    WHERE COALESCE(btrim(sv.label), '') = '' OR sv.grams IS NULL OR sv.grams <= 0 OR sv.grams > 5000
  ) THEN RAISE EXCEPTION 'INVALID_SERVING'; END IF;

  IF p_food ? 'barcode' AND COALESCE(p_food->>'barcode', '') <> '' THEN
    v_barcode := public.normalize_barcode(p_food->>'barcode');
    IF v_barcode IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT: barcode'; END IF;
  END IF;

  INSERT INTO foods AS f (id, source, source_id, owner_id, name, brand, category, food_type, data_quality, updated_at)
  VALUES (v_id, 'user', v_id::text, uid, v_name, nullif(btrim(p_food->>'brand'), ''), nullif(btrim(p_food->>'category'), ''), 'custom', 4, now())
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, brand = EXCLUDED.brand, category = EXCLUDED.category, is_active = true, updated_at = now();

  DELETE FROM food_servings s WHERE s.food_id = v_id;
  INSERT INTO food_servings (food_id, label, grams, is_default, sort_order)
  SELECT v_id, left(btrim(sv.label), 80), sv.grams, COALESCE(sv.is_default, false), COALESCE(sv.sort_order, 0)
  FROM jsonb_to_recordset(COALESCE(p_food->'servings', '[]'::jsonb)) AS sv(label text, grams numeric, is_default boolean, sort_order int)
  ON CONFLICT (food_id, label) DO NOTHING;

  DELETE FROM food_nutrients n WHERE n.food_id = v_id;
  INSERT INTO food_nutrients (food_id, nutrient_id, amount_per_100g)
  SELECT v_id, d.id, kv.value::numeric
  FROM jsonb_each(p_food->'nutrients') kv JOIN nutrient_definitions d ON d.key = kv.key;

  -- A private food never overrides an existing (public) mapping; it only fills a gap.
  IF v_barcode IS NOT NULL THEN
    DELETE FROM food_barcodes b WHERE b.food_id = v_id AND b.barcode <> v_barcode;
    INSERT INTO food_barcodes (barcode, food_id, source) VALUES (v_barcode, v_id, 'user')
    ON CONFLICT (barcode) DO NOTHING;
  END IF;

  RETURN v_id;
END;
$$;

-- ---------- recipes ----------
CREATE OR REPLACE FUNCTION public.recipe_totals(p_recipe_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT public.sum_nutrition(ARRAY(
    SELECT public.nutrition_for_grams(i.food_id, i.grams)
    FROM nutrition_recipe_items i WHERE i.recipe_id = p_recipe_id ORDER BY i.sort_order
  ));
$$;

-- Computed on read from the CURRENT food rows — never stored.
CREATE OR REPLACE FUNCTION public.recipe_nutrition_per_serving(p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_servings numeric;
BEGIN
  SELECT r.servings INTO v_servings FROM nutrition_recipes r
  WHERE r.id = p_recipe_id AND r.user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'RECIPE_NOT_FOUND'; END IF;
  RETURN public.scale_nutrition(public.recipe_totals(p_recipe_id), 1, v_servings);
END;
$$;

-- { id?, name, servings, total_grams?, notes?, items: [{food_id, grams, sort_order?}] } (1..60 items)
CREATE OR REPLACE FUNCTION public.upsert_recipe(p_recipe jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid        uuid := auth.uid();
  v_id       uuid;
  v_name     text;
  v_servings numeric;
  v_total    numeric;
  v_notes    text;
  v_row      nutrition_recipes;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_recipe IS NULL OR jsonb_typeof(p_recipe) <> 'object' OR jsonb_typeof(p_recipe->'items') <> 'array' THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF jsonb_array_length(p_recipe->'items') < 1 OR jsonb_array_length(p_recipe->'items') > 60 THEN
    RAISE EXCEPTION 'INVALID_ITEMS';
  END IF;

  v_id       := COALESCE((p_recipe->>'id')::uuid, gen_random_uuid());
  v_name     := left(btrim(p_recipe->>'name'), 120);
  v_servings := (p_recipe->>'servings')::numeric;
  v_total    := (p_recipe->>'total_grams')::numeric;
  v_notes    := left(p_recipe->>'notes', 2000);
  IF COALESCE(v_name, '') = '' OR v_servings IS NULL OR v_servings <= 0 OR v_servings > 1000
     OR (v_total IS NOT NULL AND (v_total <= 0 OR v_total > 100000)) THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  IF EXISTS (SELECT 1 FROM nutrition_recipes r WHERE r.id = v_id AND r.user_id <> uid) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- every ingredient must be a food the caller can see, with sane grams
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_recipe->'items') AS it(food_id uuid, grams numeric)
    WHERE it.food_id IS NULL OR it.grams IS NULL OR it.grams <= 0 OR it.grams > 20000
       OR NOT EXISTS (SELECT 1 FROM foods f WHERE f.id = it.food_id AND (f.owner_id IS NULL OR f.owner_id = uid))
  ) THEN RAISE EXCEPTION 'FOOD_NOT_FOUND'; END IF;

  INSERT INTO nutrition_recipes AS r (id, user_id, name, servings, total_grams, notes, updated_at)
  VALUES (v_id, uid, v_name, v_servings, v_total, v_notes, now())
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, servings = EXCLUDED.servings, total_grams = EXCLUDED.total_grams,
    notes = EXCLUDED.notes, updated_at = now()
  RETURNING r.* INTO v_row;

  DELETE FROM nutrition_recipe_items i WHERE i.recipe_id = v_id;
  INSERT INTO nutrition_recipe_items (recipe_id, food_id, grams, sort_order)
  SELECT v_id, it.food_id, it.grams, COALESCE(it.sort_order, (it.ord - 1)::int)
  -- WITH ORDINALITY + a column definition list is only legal inside ROWS FROM().
  FROM ROWS FROM (jsonb_to_recordset(p_recipe->'items') AS (food_id uuid, grams numeric, sort_order int))
       WITH ORDINALITY AS it(food_id, grams, sort_order, ord);

  RETURN jsonb_build_object(
    'recipe', to_jsonb(v_row),
    'per_serving', public.scale_nutrition(public.recipe_totals(v_id), 1, v_servings));
END;
$$;

-- ---------- search ----------
-- plpgsql (not sql) because the three branches — barcode / 2-char prefix / trigram —
-- need DIFFERENT index-friendly predicates; OR-ing them in one SQL body would defeat
-- the GIN index. Each branch only collects candidate ids; ranking is one shared query.
CREATE OR REPLACE FUNCTION public.search_foods(
  p_query   text,
  p_limit   int  DEFAULT 25,
  p_country text DEFAULT NULL,
  p_barcode text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, kind text, name text, brand text, source text, country text, data_quality smallint,
  default_serving_label text, default_serving_grams numeric,
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  is_favorite boolean, use_count int, rank real
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, extensions
SET pg_trgm.word_similarity_threshold = 0.3
AS $$
#variable_conflict use_column
DECLARE
  v_uid     uuid := auth.uid();
  v_q       text;
  v_code    text;
  v_country text := upper(nullif(btrim(p_country), ''));
  v_limit   int  := least(greatest(COALESCE(p_limit, 25), 1), 50);
  v_ids     uuid[];
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  IF COALESCE(btrim(p_barcode), '') <> '' THEN
    v_code := public.normalize_barcode(p_barcode);
    IF v_code IS NULL THEN RETURN; END IF;
    v_ids := ARRAY(
      SELECT b.food_id FROM food_barcodes b
      JOIN foods f ON f.id = b.food_id
      WHERE (b.barcode = v_code
             OR (length(v_code) = 13 AND left(v_code, 1) = '0' AND b.barcode = substr(v_code, 2)))
        AND f.is_active AND (f.owner_id IS NULL OR f.owner_id = v_uid));
  ELSE
    v_q := public.f_unaccent(lower(btrim(COALESCE(p_query, ''))));
    IF length(v_q) < 2 THEN RETURN; END IF;
    IF length(v_q) < 3 THEN
      v_ids := ARRAY(
        SELECT f.id FROM foods f
        WHERE f.is_active AND (f.owner_id IS NULL OR f.owner_id = v_uid)
          AND f.search_text LIKE v_q || '%'
        ORDER BY length(f.search_text) LIMIT 300);
    ELSE
      -- `<%` = word_similarity ≥ threshold (GIN-supported). Whole-string `%` would
      -- never let a typo through: search_text is name+name_fi+name_en+brand, so
      -- similarity('brolieri', 'broileri chicken breast') ≈ 0.17 while its best
      -- word extent scores ≈ 0.39.
      v_ids := ARRAY(
        SELECT f.id FROM foods f
        WHERE f.is_active AND (f.owner_id IS NULL OR f.owner_id = v_uid)
          AND (v_q <% f.search_text OR f.search_text ILIKE '%' || v_q || '%')
        ORDER BY greatest(similarity(f.search_text, v_q), word_similarity(v_q, f.search_text)) DESC
        LIMIT 300);
    END IF;
  END IF;

  RETURN QUERY
  WITH recent_use AS (
    SELECT i.food_id, count(*)::int AS n
    FROM meal_log_items i
    WHERE i.user_id = v_uid AND i.food_id IS NOT NULL AND i.created_at > now() - interval '90 days'
    GROUP BY i.food_id
  ),
  food_rows AS (
    SELECT f.id, 'food'::text AS kind, f.name, f.brand, f.source, f.country::text AS country, f.data_quality,
           sv.label AS default_serving_label, sv.grams AS default_serving_grams,
           mac.kcal, mac.protein_g, mac.carbs_g, mac.fat_g,
           (fav.food_id IS NOT NULL) AS is_favorite,
           COALESCE(u.n, 0) AS use_count,
           (
             CASE
               WHEN v_code IS NOT NULL THEN 1.0
               WHEN public.f_unaccent(lower(f.name)) = v_q THEN 1.0
               WHEN public.f_unaccent(lower(f.name)) LIKE v_q || '%' THEN 0.9
               ELSE greatest(similarity(f.search_text, v_q), word_similarity(v_q, f.search_text))
             END
             + CASE WHEN fav.food_id IS NOT NULL THEN 0.30 ELSE 0 END
             + 0.02 * least(COALESCE(u.n, 0), 10)
             + CASE WHEN v_country IS NOT NULL AND f.country = v_country THEN 0.05 ELSE 0 END
             + 0.01 * fs.priority / 12.0
             + CASE WHEN f.owner_id = v_uid THEN 0.05 ELSE 0 END
           )::real AS rank
    FROM unnest(v_ids) AS c(id)
    JOIN foods f ON f.id = c.id
    JOIN food_sources fs ON fs.code = f.source
    LEFT JOIN food_favorites fav ON fav.food_id = f.id AND fav.user_id = v_uid
    LEFT JOIN recent_use u ON u.food_id = f.id
    LEFT JOIN LATERAL (
      SELECT s.label, s.grams FROM food_servings s WHERE s.food_id = f.id
      ORDER BY s.is_default DESC, s.sort_order, s.label LIMIT 1
    ) sv ON true
    LEFT JOIN LATERAL (
      SELECT max(CASE WHEN d.key = 'kcal'      THEN n.amount_per_100g END) AS kcal,
             max(CASE WHEN d.key = 'protein_g' THEN n.amount_per_100g END) AS protein_g,
             max(CASE WHEN d.key = 'carbs_g'   THEN n.amount_per_100g END) AS carbs_g,
             max(CASE WHEN d.key = 'fat_g'     THEN n.amount_per_100g END) AS fat_g
      FROM food_nutrients n JOIN nutrient_definitions d ON d.id = n.nutrient_id
      WHERE n.food_id = f.id AND d.key IN ('kcal','protein_g','carbs_g','fat_g')
    ) mac ON true
  ),
  recipe_rows AS (
    SELECT r.id, 'recipe'::text AS kind, r.name, NULL::text AS brand, 'recipe'::text AS source, NULL::text AS country,
           4::smallint AS data_quality,
           '1 serving'::text AS default_serving_label,
           round(COALESCE(r.total_grams, tg.total) / r.servings, 1) AS default_serving_grams,
           (ps.v->>'kcal')::numeric AS kcal, (ps.v->>'protein_g')::numeric AS protein_g,
           (ps.v->>'carbs_g')::numeric AS carbs_g, (ps.v->>'fat_g')::numeric AS fat_g,
           false AS is_favorite, 0 AS use_count,
           (
             CASE
               WHEN public.f_unaccent(lower(r.name)) = v_q THEN 1.0
               WHEN public.f_unaccent(lower(r.name)) LIKE v_q || '%' THEN 0.9
               ELSE greatest(similarity(public.f_unaccent(lower(r.name)), v_q), word_similarity(v_q, public.f_unaccent(lower(r.name))))
             END + 0.06
           )::real AS rank
    FROM nutrition_recipes r
    CROSS JOIN LATERAL (SELECT public.recipe_nutrition_per_serving(r.id) AS v) ps
    CROSS JOIN LATERAL (SELECT COALESCE(sum(i.grams), 0) AS total FROM nutrition_recipe_items i WHERE i.recipe_id = r.id) tg
    WHERE v_code IS NULL AND r.user_id = v_uid
      AND public.f_unaccent(lower(r.name)) ILIKE '%' || v_q || '%'
  )
  SELECT t.* FROM (
    SELECT * FROM food_rows
    UNION ALL
    SELECT * FROM recipe_rows
  ) t
  ORDER BY t.rank DESC, length(t.name)
  LIMIT v_limit;
END;
$$;

-- ---------- diary ----------
-- Shared response shape for log_meal / duplicate_meal: {meal, items[], totals}.
CREATE OR REPLACE FUNCTION public.meal_payload(p_meal_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'meal',   to_jsonb(m),
    'items',  COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order, i.created_at)
                        FROM meal_log_items i WHERE i.meal_log_id = m.id), '[]'::jsonb),
    'totals', public.sum_nutrition(ARRAY(SELECT i.snapshot FROM meal_log_items i WHERE i.meal_log_id = m.id))
  )
  FROM meal_logs m WHERE m.id = p_meal_id;
$$;

-- Item: {id?, kind:'food'|'recipe'|'quick', food_id?, recipe_id?, grams?, serving_id?,
--        serving_qty?, name?, quick?:{kcal,protein_g,carbs_g,fat_g}}
-- Snapshots are computed HERE, at write time, from the current catalog — the diary
-- never re-derives from foods later (a re-ingest must not rewrite history).
-- Replay-safe: meal and item ids are client uuids, both inserts are ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.log_meal(
  p_meal_id           uuid,
  p_log_date          date,
  p_tz_offset_minutes int,
  p_meal_slot         text,
  p_items             jsonb,
  p_note              text DEFAULT NULL,
  p_source            text DEFAULT 'manual',
  p_photo_path        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  v_tz         int;
  v_meal       meal_logs;
  v_item       jsonb;
  v_i          int := 0;
  v_id         uuid;
  v_kind       text;
  v_food_id    uuid;
  v_recipe_id  uuid;
  v_serving_id uuid;
  v_qty        numeric;
  v_grams      numeric;
  v_name       text;
  v_snapshot   jsonb;
  v_servings   numeric;
  v_total      numeric;
  v_quick      jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.has_active_access(uid) THEN RAISE EXCEPTION 'PREMIUM_REQUIRED'; END IF;
  IF p_meal_id IS NULL OR p_log_date IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF p_meal_slot IS NULL OR p_meal_slot NOT IN ('breakfast','lunch','dinner','snack') THEN RAISE EXCEPTION 'INVALID_SLOT'; END IF;
  IF p_source IS NULL OR p_source NOT IN ('manual','barcode','scan','recipe','quick','duplicate') THEN RAISE EXCEPTION 'INVALID_SOURCE'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'INVALID_ITEMS';
  END IF;
  -- a photo may only live in the caller's own folder of the private bucket
  IF p_photo_path IS NOT NULL AND p_photo_path NOT LIKE uid::text || '/%' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  v_tz := COALESCE(p_tz_offset_minutes, 0);
  IF v_tz < -840 OR v_tz > 720 THEN v_tz := 0; END IF;

  INSERT INTO meal_logs (id, user_id, log_date, tz_offset_minutes, meal_slot, source, note, photo_path)
  VALUES (p_meal_id, uid, p_log_date, v_tz, p_meal_slot, p_source, left(p_note, 500), p_photo_path)
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_meal FROM meal_logs m WHERE m.id = p_meal_id FOR UPDATE;
  IF v_meal.user_id <> uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_items) e LOOP
    v_i := v_i + 1;
    v_id := COALESCE((v_item->>'id')::uuid, gen_random_uuid());
    v_kind := v_item->>'kind';
    v_food_id := NULL; v_recipe_id := NULL; v_serving_id := NULL; v_qty := NULL; v_name := NULL;
    v_grams := (v_item->>'grams')::numeric;

    IF v_kind = 'food' THEN
      v_food_id := (v_item->>'food_id')::uuid;
      SELECT f.name INTO v_name FROM foods f
      WHERE f.id = v_food_id AND f.is_active AND (f.owner_id IS NULL OR f.owner_id = uid);
      IF NOT FOUND THEN RAISE EXCEPTION 'FOOD_NOT_FOUND'; END IF;
      v_serving_id := (v_item->>'serving_id')::uuid;
      v_qty := (v_item->>'serving_qty')::numeric;
      IF v_serving_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM food_servings s WHERE s.id = v_serving_id AND s.food_id = v_food_id) THEN
          RAISE EXCEPTION 'INVALID_SERVING';
        END IF;
        IF v_grams IS NULL THEN
          SELECT s.grams * COALESCE(v_qty, 1) INTO v_grams FROM food_servings s WHERE s.id = v_serving_id;
        END IF;
      END IF;
      IF v_grams IS NULL OR v_grams <= 0 OR v_grams > 5000 THEN RAISE EXCEPTION 'INVALID_GRAMS'; END IF;
      v_snapshot := public.nutrition_for_grams(v_food_id, v_grams);

    ELSIF v_kind = 'recipe' THEN
      v_recipe_id := (v_item->>'recipe_id')::uuid;
      SELECT r.name, r.servings,
             COALESCE(r.total_grams, (SELECT sum(i.grams) FROM nutrition_recipe_items i WHERE i.recipe_id = r.id))
        INTO v_name, v_servings, v_total
      FROM nutrition_recipes r WHERE r.id = v_recipe_id AND r.user_id = uid;
      IF NOT FOUND THEN RAISE EXCEPTION 'RECIPE_NOT_FOUND'; END IF;
      v_qty := COALESCE((v_item->>'serving_qty')::numeric, 1);
      IF v_qty <= 0 OR v_qty > 100 THEN RAISE EXCEPTION 'INVALID_GRAMS'; END IF;
      v_grams := round(v_qty * COALESCE(v_total, 0) / v_servings, 3);
      IF v_grams <= 0 OR v_grams > 5000 THEN RAISE EXCEPTION 'INVALID_GRAMS'; END IF;
      v_snapshot := public.scale_nutrition(public.recipe_totals(v_recipe_id), v_qty, v_servings);

    ELSIF v_kind = 'quick' THEN
      v_quick := v_item->'quick';
      IF v_quick IS NULL OR jsonb_typeof(v_quick) <> 'object' THEN RAISE EXCEPTION 'INVALID_QUICK'; END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_each(v_quick) e
        WHERE e.key IN ('kcal','protein_g','carbs_g','fat_g')
          AND (jsonb_typeof(e.value) <> 'number' OR e.value::numeric < 0 OR e.value::numeric > 20000)
      ) THEN RAISE EXCEPTION 'INVALID_QUICK'; END IF;
      SELECT jsonb_object_agg(e.key, round(e.value::numeric, 3)) INTO v_snapshot
      FROM jsonb_each(v_quick) e WHERE e.key IN ('kcal','protein_g','carbs_g','fat_g');
      IF v_snapshot IS NULL THEN RAISE EXCEPTION 'INVALID_QUICK'; END IF;
      v_grams := COALESCE(v_grams, 1);
      IF v_grams <= 0 OR v_grams > 5000 THEN RAISE EXCEPTION 'INVALID_GRAMS'; END IF;
      v_name := 'Quick add';
    ELSE
      RAISE EXCEPTION 'INVALID_KIND';
    END IF;

    INSERT INTO meal_log_items (id, meal_log_id, user_id, kind, food_id, recipe_id, grams,
                                serving_id, serving_qty, display_name, snapshot, sort_order)
    VALUES (v_id, p_meal_id, uid, v_kind, v_food_id, v_recipe_id, v_grams, v_serving_id, v_qty,
            left(COALESCE(nullif(btrim(v_item->>'name'), ''), v_name), 200), v_snapshot, v_i - 1)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  RETURN public.meal_payload(p_meal_id);
END;
$$;

-- An edit is a NEW measurement: the item is re-snapshotted from the current food /
-- recipe. Untouched items are never rewritten. Quick items have nothing to re-derive.
CREATE OR REPLACE FUNCTION public.update_meal_item(
  p_item_id     uuid,
  p_grams       numeric DEFAULT NULL,
  p_serving_id  uuid    DEFAULT NULL,
  p_serving_qty numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  v_item       meal_log_items;
  v_grams      numeric;
  v_serving_id uuid;
  v_qty        numeric;
  v_snapshot   jsonb;
  v_servings   numeric;
  v_total      numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT * INTO v_item FROM meal_log_items i WHERE i.id = p_item_id AND i.user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF v_item.kind = 'quick' THEN
    RETURN jsonb_build_object('item', to_jsonb(v_item),
      'meal', (SELECT to_jsonb(m) FROM meal_logs m WHERE m.id = v_item.meal_log_id));
  END IF;

  IF v_item.kind = 'food' THEN
    IF v_item.food_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM foods f WHERE f.id = v_item.food_id AND (f.owner_id IS NULL OR f.owner_id = uid)
    ) THEN RAISE EXCEPTION 'FOOD_NOT_FOUND'; END IF;
    v_serving_id := COALESCE(p_serving_id, v_item.serving_id);
    v_qty := COALESCE(p_serving_qty, v_item.serving_qty);
    IF v_serving_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM food_servings s WHERE s.id = v_serving_id AND s.food_id = v_item.food_id
    ) THEN RAISE EXCEPTION 'INVALID_SERVING'; END IF;
    IF p_grams IS NOT NULL THEN
      v_grams := p_grams;
    ELSIF (p_serving_id IS NOT NULL OR p_serving_qty IS NOT NULL) AND v_serving_id IS NOT NULL THEN
      SELECT s.grams * COALESCE(v_qty, 1) INTO v_grams FROM food_servings s WHERE s.id = v_serving_id;
    ELSE
      v_grams := v_item.grams;
    END IF;
    IF v_grams IS NULL OR v_grams <= 0 OR v_grams > 5000 THEN RAISE EXCEPTION 'INVALID_GRAMS'; END IF;
    v_snapshot := public.nutrition_for_grams(v_item.food_id, v_grams);
  ELSE
    SELECT r.servings,
           COALESCE(r.total_grams, (SELECT sum(i.grams) FROM nutrition_recipe_items i WHERE i.recipe_id = r.id))
      INTO v_servings, v_total
    FROM nutrition_recipes r WHERE r.id = v_item.recipe_id AND r.user_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'RECIPE_NOT_FOUND'; END IF;
    v_qty := COALESCE(p_serving_qty, v_item.serving_qty, 1);
    IF v_qty <= 0 OR v_qty > 100 THEN RAISE EXCEPTION 'INVALID_GRAMS'; END IF;
    v_grams := round(v_qty * COALESCE(v_total, 0) / v_servings, 3);
    IF v_grams <= 0 OR v_grams > 5000 THEN RAISE EXCEPTION 'INVALID_GRAMS'; END IF;
    v_snapshot := public.scale_nutrition(public.recipe_totals(v_item.recipe_id), v_qty, v_servings);
  END IF;

  UPDATE meal_log_items i
     SET grams = v_grams, serving_id = v_serving_id, serving_qty = v_qty, snapshot = v_snapshot, updated_at = now()
   WHERE i.id = p_item_id
   RETURNING i.* INTO v_item;

  RETURN jsonb_build_object('item', to_jsonb(v_item),
    'meal', (SELECT to_jsonb(m) FROM meal_logs m WHERE m.id = v_item.meal_log_id));
END;
$$;

-- Copy a meal (repeat / "copy yesterday's lunch"). Snapshots are copied verbatim —
-- the user is re-eating what was measured then, not re-measuring.
CREATE OR REPLACE FUNCTION public.duplicate_meal(
  p_source_meal_id    uuid,
  p_new_meal_id       uuid,
  p_log_date          date,
  p_tz_offset_minutes int,
  p_meal_slot         text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid     uuid := auth.uid();
  v_tz    int;
  v_owner uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.has_active_access(uid) THEN RAISE EXCEPTION 'PREMIUM_REQUIRED'; END IF;
  IF p_source_meal_id IS NULL OR p_new_meal_id IS NULL OR p_log_date IS NULL
     OR p_source_meal_id = p_new_meal_id THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF p_meal_slot IS NULL OR p_meal_slot NOT IN ('breakfast','lunch','dinner','snack') THEN RAISE EXCEPTION 'INVALID_SLOT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM meal_logs m WHERE m.id = p_source_meal_id AND m.user_id = uid) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_tz := COALESCE(p_tz_offset_minutes, 0);
  IF v_tz < -840 OR v_tz > 720 THEN v_tz := 0; END IF;

  INSERT INTO meal_logs (id, user_id, log_date, tz_offset_minutes, meal_slot, source)
  VALUES (p_new_meal_id, uid, p_log_date, v_tz, p_meal_slot, 'duplicate')
  ON CONFLICT (id) DO NOTHING;

  SELECT m.user_id INTO v_owner FROM meal_logs m WHERE m.id = p_new_meal_id FOR UPDATE;
  IF v_owner <> uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  -- replay-safe: a second call with the same new id copies nothing
  IF NOT EXISTS (SELECT 1 FROM meal_log_items i WHERE i.meal_log_id = p_new_meal_id) THEN
    INSERT INTO meal_log_items (id, meal_log_id, user_id, kind, food_id, recipe_id, grams, serving_id,
                                serving_qty, display_name, snapshot, snapshot_version, sort_order)
    SELECT gen_random_uuid(), p_new_meal_id, uid, i.kind, i.food_id, i.recipe_id, i.grams, i.serving_id,
           i.serving_qty, i.display_name, i.snapshot, i.snapshot_version, i.sort_order
    FROM meal_log_items i WHERE i.meal_log_id = p_source_meal_id;
  END IF;

  RETURN public.meal_payload(p_new_meal_id);
END;
$$;

-- [{log_date, totals, by_slot, meal_count, item_count, targets}] for every day in
-- [p_from, p_to] (≤ 92 days). Pure snapshot sums; targets = the row in force that day.
CREATE OR REPLACE FUNCTION public.daily_nutrition_totals(p_from date, p_to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  uid  uuid := auth.uid();
  v_to date := COALESCE(p_to, p_from);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_from IS NULL OR v_to < p_from OR (v_to - p_from) > 91 THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(x.day_obj ORDER BY d.dt), '[]'::jsonb)
    FROM generate_series(p_from, v_to, interval '1 day') AS d(dt)
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'log_date', d.dt::date,
        'totals', public.sum_nutrition(ARRAY(
          SELECT i.snapshot FROM meal_log_items i JOIN meal_logs m ON m.id = i.meal_log_id
          WHERE m.user_id = uid AND m.log_date = d.dt::date)),
        'by_slot', (
          SELECT COALESCE(jsonb_object_agg(s.meal_slot, s.tot), '{}'::jsonb)
          FROM (
            SELECT m.meal_slot, public.sum_nutrition(array_agg(i.snapshot)) AS tot
            FROM meal_logs m JOIN meal_log_items i ON i.meal_log_id = m.id
            WHERE m.user_id = uid AND m.log_date = d.dt::date
            GROUP BY m.meal_slot
          ) s),
        'meal_count', (SELECT count(*) FROM meal_logs m WHERE m.user_id = uid AND m.log_date = d.dt::date),
        'item_count', (SELECT count(*) FROM meal_log_items i JOIN meal_logs m ON m.id = i.meal_log_id
                       WHERE m.user_id = uid AND m.log_date = d.dt::date),
        'targets', (SELECT to_jsonb(t) FROM nutrition_targets t
                    WHERE t.user_id = uid AND t.effective_from <= d.dt::date
                    ORDER BY t.effective_from DESC LIMIT 1)
      ) AS day_obj
    ) x
  );
END;
$$;

-- COALESCE-patch on (user_id, effective_from). Ranges are the table CHECKs; a
-- violation is re-raised as INVALID_INPUT so the client gets one error shape.
CREATE OR REPLACE FUNCTION public.upsert_nutrition_targets(p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid    uuid := auth.uid();
  v_from date;
  v_row  nutrition_targets;
  v_bad  text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  v_from := COALESCE((p_patch->>'effective_from')::date, current_date);

  IF p_patch ? 'micro_targets' THEN
    IF jsonb_typeof(p_patch->'micro_targets') <> 'object' THEN RAISE EXCEPTION 'INVALID_INPUT: micro_targets'; END IF;
    SELECT e.key INTO v_bad FROM jsonb_each(p_patch->'micro_targets') e
    WHERE NOT EXISTS (SELECT 1 FROM nutrient_definitions d WHERE d.key = e.key)
       OR jsonb_typeof(e.value) <> 'number' OR e.value::numeric < 0 OR e.value::numeric > 100000
    LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'UNKNOWN_NUTRIENT_KEY: %', v_bad; END IF;
  END IF;

  INSERT INTO nutrition_targets (user_id, effective_from) VALUES (uid, v_from)
  ON CONFLICT (user_id, effective_from) DO NOTHING;

  UPDATE nutrition_targets t SET
    kcal           = COALESCE(round((p_patch->>'kcal')::numeric)::int, t.kcal),
    protein_g      = COALESCE((p_patch->>'protein_g')::numeric, t.protein_g),
    carbs_g        = COALESCE((p_patch->>'carbs_g')::numeric, t.carbs_g),
    fat_g          = COALESCE((p_patch->>'fat_g')::numeric, t.fat_g),
    fiber_g        = COALESCE((p_patch->>'fiber_g')::numeric, t.fiber_g),
    water_ml       = COALESCE(round((p_patch->>'water_ml')::numeric)::int, t.water_ml),
    micro_targets  = COALESCE(p_patch->'micro_targets', t.micro_targets),
    method         = COALESCE(p_patch->>'method', t.method),
    activity_level = COALESCE(p_patch->>'activity_level', t.activity_level),
    updated_at     = now()
  WHERE t.user_id = uid AND t.effective_from = v_from
  RETURNING t.* INTO v_row;

  RETURN to_jsonb(v_row);
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'INVALID_INPUT: %', SQLERRM;
END;
$$;

-- ---------- grants ----------
REVOKE ALL ON FUNCTION public.nutrition_for_grams(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nutrition_for_grams(uuid, numeric) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sum_nutrition(jsonb[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sum_nutrition(jsonb[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.scale_nutrition(jsonb, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scale_nutrition(jsonb, numeric, numeric) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.ingest_foods(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_foods(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.upsert_user_food(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_user_food(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.recipe_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recipe_totals(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.recipe_nutrition_per_serving(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recipe_nutrition_per_serving(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_recipe(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_recipe(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.search_foods(text, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_foods(text, int, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.meal_payload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_payload(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.log_meal(uuid, date, int, text, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_meal(uuid, date, int, text, jsonb, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_meal_item(uuid, numeric, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_meal_item(uuid, numeric, uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.duplicate_meal(uuid, uuid, date, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_meal(uuid, uuid, date, int, text) TO authenticated;
REVOKE ALL ON FUNCTION public.daily_nutrition_totals(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_nutrition_totals(date, date) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_nutrition_targets(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_nutrition_targets(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
