-- ============================================================
-- Nutrition engine (3/6) — user recipes built from catalog foods.
--
-- Nutrition per serving is never stored: it is computed on read from the
-- current food rows (recipe_nutrition_per_serving in 5/6). What IS frozen
-- is the diary snapshot taken when a recipe serving is logged.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.nutrition_recipes (
  id          uuid PRIMARY KEY,                      -- client-generated (offline-safe)
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  servings    numeric(6,2) NOT NULL CHECK (servings > 0),
  total_grams numeric(10,3) CHECK (total_grams IS NULL OR total_grams > 0), -- cooked-weight override
  notes       text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_recipes_user ON public.nutrition_recipes (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.nutrition_recipe_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  uuid NOT NULL REFERENCES public.nutrition_recipes(id) ON DELETE CASCADE,
  food_id    uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  grams      numeric(10,3) NOT NULL CHECK (grams > 0 AND grams <= 20000),
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_items_recipe ON public.nutrition_recipe_items (recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_items_food ON public.nutrition_recipe_items (food_id);

ALTER TABLE public.nutrition_recipes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_recipe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutrition_recipes own select" ON public.nutrition_recipes;
DROP POLICY IF EXISTS "nutrition_recipes own insert" ON public.nutrition_recipes;
DROP POLICY IF EXISTS "nutrition_recipes own update" ON public.nutrition_recipes;
DROP POLICY IF EXISTS "nutrition_recipes own delete" ON public.nutrition_recipes;
CREATE POLICY "nutrition_recipes own select" ON public.nutrition_recipes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "nutrition_recipes own insert" ON public.nutrition_recipes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "nutrition_recipes own update" ON public.nutrition_recipes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "nutrition_recipes own delete" ON public.nutrition_recipes FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "nutrition_recipe_items own select" ON public.nutrition_recipe_items;
DROP POLICY IF EXISTS "nutrition_recipe_items own insert" ON public.nutrition_recipe_items;
DROP POLICY IF EXISTS "nutrition_recipe_items own update" ON public.nutrition_recipe_items;
DROP POLICY IF EXISTS "nutrition_recipe_items own delete" ON public.nutrition_recipe_items;
CREATE POLICY "nutrition_recipe_items own select" ON public.nutrition_recipe_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nutrition_recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "nutrition_recipe_items own insert" ON public.nutrition_recipe_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.nutrition_recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "nutrition_recipe_items own update" ON public.nutrition_recipe_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nutrition_recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.nutrition_recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "nutrition_recipe_items own delete" ON public.nutrition_recipe_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nutrition_recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));

-- Writes go through upsert_recipe (one tx); DELETE is a plain RLS delete (cascade).
GRANT SELECT, DELETE ON public.nutrition_recipes TO authenticated;
GRANT SELECT ON public.nutrition_recipe_items TO authenticated;
