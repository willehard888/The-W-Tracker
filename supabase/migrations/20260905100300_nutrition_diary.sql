-- ============================================================
-- Nutrition engine (4/6) — the diary.
--
-- meal_logs        one row per meal; kcal/protein_g/carbs_g/fat_g are DERIVED
--                  from item snapshots by trigger — coach / W-Index / verify_checkin
--                  read these columns and never re-derive from foods.
-- meal_log_items   each logged line carries `snapshot` = nutrition_for_grams at
--                  write time. A later change to the food row (re-ingest, user
--                  edit) never rewrites history — an edit is a new measurement.
-- nutrition_targets  effective-dated targets (one row per change).
-- food_favorites   the ★ chip in search.
-- meal_scan_cache  per-user AI scan result cache (service role writes).
--
-- Grants are deliberately narrow: INSERT/UPDATE on meal_logs / meal_log_items /
-- nutrition_targets only through the SECURITY DEFINER RPCs, because
-- meal_logs.protein_g feeds an XP bonus in verify_checkin.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_logs (
  id                uuid PRIMARY KEY,                       -- client-generated (offline replay)
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date          date NOT NULL,
  tz_offset_minutes int NOT NULL DEFAULT 0 CHECK (tz_offset_minutes BETWEEN -840 AND 720),
  meal_slot         text NOT NULL CHECK (meal_slot IN ('breakfast','lunch','dinner','snack')),
  logged_at         timestamptz NOT NULL DEFAULT now(),
  source            text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','barcode','scan','recipe','quick','duplicate')),
  note              text CHECK (note IS NULL OR length(note) <= 500),
  photo_path        text,
  kcal              numeric NOT NULL DEFAULT 0,
  protein_g         numeric NOT NULL DEFAULT 0,
  carbs_g           numeric NOT NULL DEFAULT 0,
  fat_g             numeric NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date ON public.meal_logs (user_id, log_date DESC);

CREATE TABLE IF NOT EXISTS public.meal_log_items (
  id               uuid PRIMARY KEY,                        -- client-generated
  meal_log_id      uuid NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('food','recipe','quick')),
  food_id          uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  recipe_id        uuid REFERENCES public.nutrition_recipes(id) ON DELETE SET NULL,
  grams            numeric(10,3) NOT NULL CHECK (grams > 0 AND grams <= 5000),
  serving_id       uuid REFERENCES public.food_servings(id) ON DELETE SET NULL,
  serving_qty      numeric(8,3) CHECK (serving_qty IS NULL OR serving_qty > 0),
  display_name     text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  snapshot         jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_version smallint NOT NULL DEFAULT 1,
  sort_order       smallint NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- ids may become NULL via ON DELETE SET NULL, so only the cross-kind id is forbidden.
  CONSTRAINT meal_log_items_kind_ids CHECK (
    (kind = 'quick'  AND food_id IS NULL AND recipe_id IS NULL) OR
    (kind = 'food'   AND recipe_id IS NULL) OR
    (kind = 'recipe' AND food_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_meal_log_items_meal ON public.meal_log_items (meal_log_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_meal_log_items_user_created ON public.meal_log_items (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT current_date,
  kcal           int     CHECK (kcal IS NULL OR kcal BETWEEN 500 AND 10000),
  protein_g      numeric CHECK (protein_g IS NULL OR protein_g BETWEEN 0 AND 1000),
  carbs_g        numeric CHECK (carbs_g IS NULL OR carbs_g BETWEEN 0 AND 2000),
  fat_g          numeric CHECK (fat_g IS NULL OR fat_g BETWEEN 0 AND 1000),
  fiber_g        numeric CHECK (fiber_g IS NULL OR fiber_g BETWEEN 0 AND 200),
  water_ml       int     CHECK (water_ml IS NULL OR water_ml BETWEEN 0 AND 20000),
  micro_targets  jsonb NOT NULL DEFAULT '{}'::jsonb,
  method         text NOT NULL DEFAULT 'manual' CHECK (method IN ('manual','mifflin','katch','coach')),
  activity_level text CHECK (activity_level IS NULL OR activity_level IN ('sedentary','light','moderate','active','very_active')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nutrition_targets_user_from ON public.nutrition_targets (user_id, effective_from);

CREATE TABLE IF NOT EXISTS public.food_favorites (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id    uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, food_id)
);

CREATE TABLE IF NOT EXISTS public.meal_scan_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_sha256 text NOT NULL CHECK (image_sha256 ~ '^[0-9a-f]{64}$'),
  model        text NOT NULL,
  result       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_meal_scan_cache ON public.meal_scan_cache (user_id, image_sha256);

-- ---------- derived meal totals ----------
-- SECURITY DEFINER: a user deleting an item under RLS has no UPDATE grant on
-- meal_logs' derived columns, but the parent must still be recomputed.
CREATE OR REPLACE FUNCTION public.meal_log_items_totals()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- CASE keeps NEW/OLD from being touched when they do not apply to TG_OP.
  v_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.meal_log_id END,
      CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.meal_log_id END
    ]) AS x WHERE x IS NOT NULL
  );

  UPDATE meal_logs m SET
    kcal       = COALESCE(s.kcal, 0),
    protein_g  = COALESCE(s.protein_g, 0),
    carbs_g    = COALESCE(s.carbs_g, 0),
    fat_g      = COALESCE(s.fat_g, 0),
    updated_at = now()
  FROM unnest(v_ids) AS u(id)
  LEFT JOIN LATERAL (
    SELECT sum((i.snapshot->>'kcal')::numeric)      AS kcal,
           sum((i.snapshot->>'protein_g')::numeric) AS protein_g,
           sum((i.snapshot->>'carbs_g')::numeric)   AS carbs_g,
           sum((i.snapshot->>'fat_g')::numeric)     AS fat_g
    FROM meal_log_items i WHERE i.meal_log_id = u.id
  ) s ON true
  WHERE m.id = u.id;

  RETURN NULL; -- AFTER trigger; result ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_meal_log_items_totals ON public.meal_log_items;
CREATE TRIGGER trg_meal_log_items_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.meal_log_items
  FOR EACH ROW EXECUTE FUNCTION public.meal_log_items_totals();

-- ---------- RLS ----------
ALTER TABLE public.meal_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_log_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_favorites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_scan_cache   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_logs own select" ON public.meal_logs;
DROP POLICY IF EXISTS "meal_logs own update" ON public.meal_logs;
DROP POLICY IF EXISTS "meal_logs own delete" ON public.meal_logs;
CREATE POLICY "meal_logs own select" ON public.meal_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "meal_logs own update" ON public.meal_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "meal_logs own delete" ON public.meal_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "meal_log_items own select" ON public.meal_log_items;
DROP POLICY IF EXISTS "meal_log_items own delete" ON public.meal_log_items;
CREATE POLICY "meal_log_items own select" ON public.meal_log_items FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "meal_log_items own delete" ON public.meal_log_items FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "nutrition_targets own select" ON public.nutrition_targets;
DROP POLICY IF EXISTS "nutrition_targets own delete" ON public.nutrition_targets;
CREATE POLICY "nutrition_targets own select" ON public.nutrition_targets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "nutrition_targets own delete" ON public.nutrition_targets FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "food_favorites own select" ON public.food_favorites;
DROP POLICY IF EXISTS "food_favorites own insert" ON public.food_favorites;
DROP POLICY IF EXISTS "food_favorites own delete" ON public.food_favorites;
CREATE POLICY "food_favorites own select" ON public.food_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "food_favorites own insert" ON public.food_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "food_favorites own delete" ON public.food_favorites FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "meal_scan_cache own select" ON public.meal_scan_cache;
CREATE POLICY "meal_scan_cache own select" ON public.meal_scan_cache FOR SELECT TO authenticated USING (user_id = auth.uid());
-- meal_scan_cache writes: service role only (nutrition-scan edge function).

-- ---------- grants ----------
-- Supabase's default privileges GRANT ALL on every new public table to anon /
-- authenticated, and "meal_logs own update" would then let a member write the
-- derived kcal/protein_g directly (protein_g feeds verify_checkin XP). Revoke the
-- table-level INSERT/UPDATE first — a table-level REVOKE also clears column grants,
-- so the column grant must come after it.
REVOKE INSERT, UPDATE ON public.meal_logs FROM anon, authenticated;
GRANT SELECT, DELETE ON public.meal_logs TO authenticated;
GRANT UPDATE (note, photo_path) ON public.meal_logs TO authenticated; -- derived columns stay RPC/trigger-only
GRANT SELECT, DELETE ON public.meal_log_items TO authenticated;
GRANT SELECT, DELETE ON public.nutrition_targets TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.food_favorites TO authenticated;
GRANT SELECT ON public.meal_scan_cache TO authenticated;
