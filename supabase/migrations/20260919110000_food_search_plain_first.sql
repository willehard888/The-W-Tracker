-- Food search: the plain food first.
-- Typing "banana" listed banana peppers, banana chips and a banana melon above
-- "Bananas, raw": the fuzzy branch scores 1.0 for any row that contains the
-- exact word, which beat the 0.9 given to a name that STARTS with the query.
-- Two changes to the ranking, nothing else (body is the live definition):
-- the fuzzy score is capped under the prefix tier, and a generic food gets a
-- small edge over a branded product at the same score.

-- Load pg_trgm first (see 20260906100000): the SET clause below is validated at
-- creation time, and in a fresh session the parameter is still a placeholder
-- the db push role may not set (SQLSTATE 42501).
SELECT extensions.similarity('trgm', 'trgm');

CREATE OR REPLACE FUNCTION public.search_foods(p_query text, p_limit integer DEFAULT 25, p_country text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, kind text, name text, brand text, source text, country text, data_quality smallint, default_serving_label text, default_serving_grams numeric, kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, is_favorite boolean, use_count integer, rank real, match_score real)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions'
 SET "pg_trgm.word_similarity_threshold" TO '0.3'
AS $function$
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
      WHERE b.barcode = v_code
        AND f.is_active AND (f.owner_id IS NULL OR f.owner_id = v_uid));
  ELSE
    v_q := public.f_unaccent(lower(btrim(COALESCE(p_query, ''))));
    IF length(v_q) < 2 THEN RETURN; END IF;
    IF length(v_q) < 3 THEN
      v_ids := ARRAY(
        SELECT f.id FROM foods f
        WHERE f.is_active AND (f.owner_id IS NULL OR f.owner_id = v_uid)
          AND f.search_text LIKE v_q || '%'
        ORDER BY (f.food_type <> 'branded') DESC, length(f.search_text) LIMIT 300);
    ELSE
      -- `<%` = word_similarity ≥ threshold (GIN-supported). Whole-string `%` would
      -- never let a typo through: search_text is name+name_fi+name_en+brand, so
      -- similarity('brolieri', 'broileri chicken breast') ≈ 0.17 while its best
      -- word extent scores ≈ 0.39.
      -- The cut is per food_type partition: one shared LIMIT would fill up with
      -- branded "Maito juoma …" products before any generic Fineli row.
      v_ids := ARRAY(
        SELECT c.id FROM (
          SELECT f.id,
                 row_number() OVER (
                   PARTITION BY (f.food_type = 'branded')
                   ORDER BY (v_country IS NOT NULL AND f.country = v_country) DESC,
                            greatest(similarity(f.search_text, v_q), word_similarity(v_q, f.search_text)) DESC,
                            length(f.search_text)
                 ) AS rn
          FROM foods f
          WHERE f.is_active AND (f.owner_id IS NULL OR f.owner_id = v_uid)
            AND (v_q <% f.search_text OR f.search_text ILIKE '%' || v_q || '%')
        ) c
        WHERE c.rn <= 200);
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
             ms.score
             + CASE WHEN fav.food_id IS NOT NULL THEN 0.30 ELSE 0 END
             + 0.02 * least(COALESCE(u.n, 0), 10)
             + CASE WHEN v_country IS NOT NULL AND f.country = v_country THEN 0.05 ELSE 0 END
             + 0.01 * fs.priority / 12.0
             + CASE WHEN f.owner_id = v_uid THEN 0.05 ELSE 0 END
             -- The plain food before the products named after it: "Bananas, raw"
             -- before "Banana Cake".
             + CASE WHEN f.food_type <> 'branded' THEN 0.04 ELSE 0 END
           )::real AS rank,
           ms.score AS match_score
    FROM unnest(v_ids) AS c(id)
    JOIN foods f ON f.id = c.id
    JOIN food_sources fs ON fs.code = f.source
    LEFT JOIN food_favorites fav ON fav.food_id = f.id AND fav.user_id = v_uid
    LEFT JOIN recent_use u ON u.food_id = f.id
    CROSS JOIN LATERAL (
      SELECT (CASE
                WHEN v_code IS NOT NULL THEN 1.0
                WHEN public.f_unaccent(lower(f.name)) = v_q THEN 1.0
                WHEN public.f_unaccent(lower(f.name)) LIKE v_q || '%' THEN 0.9
                -- Capped under the prefix tier. word_similarity is 1.0 for ANY row
                -- holding the exact word, so "banana" ranked "Peppers, banana or
                -- Hungarian wax" (1.0) above "Bananas, raw" (prefix, 0.9).
                ELSE least(0.85, greatest(similarity(f.search_text, v_q), word_similarity(v_q, f.search_text)))
              END)::real AS score
    ) ms
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
           (ms.score + 0.06)::real AS rank,
           ms.score AS match_score
    FROM nutrition_recipes r
    CROSS JOIN LATERAL (SELECT public.recipe_nutrition_per_serving(r.id) AS v) ps
    CROSS JOIN LATERAL (SELECT COALESCE(sum(i.grams), 0) AS total FROM nutrition_recipe_items i WHERE i.recipe_id = r.id) tg
    CROSS JOIN LATERAL (
      SELECT (CASE
                WHEN public.f_unaccent(lower(r.name)) = v_q THEN 1.0
                WHEN public.f_unaccent(lower(r.name)) LIKE v_q || '%' THEN 0.9
                ELSE greatest(similarity(public.f_unaccent(lower(r.name)), v_q), word_similarity(v_q, public.f_unaccent(lower(r.name))))
              END)::real AS score
    ) ms
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
$function$;

NOTIFY pgrst, 'reload schema';
