-- ============================================================
-- Nutrition engine (2/6) — the food catalog.
--
-- food_sources         licences + priority (barcode conflict resolution, rank)
-- nutrient_definitions the canonical ~50 nutrient keys + per-source mapping
-- foods                one row per food from any source; custom foods carry owner_id
-- food_servings        household portions ("1 slice" = 30 g)
-- food_nutrients       amount per 100 g, keyed by nutrient id
-- food_barcodes        normalised EAN-8/13 → one food (PK = barcode)
-- food_barcode_misses  7-day negative cache for the lookup edge function
-- ============================================================

-- ---------- food_sources ----------
CREATE TABLE IF NOT EXISTS public.food_sources (
  code             text PRIMARY KEY,
  name             text NOT NULL,
  licence          text NOT NULL,
  attribution_text text NOT NULL,
  attribution_url  text,
  licence_url      text,
  priority         smallint NOT NULL CHECK (priority BETWEEN 1 AND 12),
  default_quality  smallint NOT NULL CHECK (default_quality BETWEEN 1 AND 5),
  version          text
);

INSERT INTO public.food_sources (code, name, licence, attribution_text, attribution_url, licence_url, priority, default_quality) VALUES
  ('fineli', 'Fineli (THL)', 'CC BY 4.0',
   'Lähde: Terveyden ja hyvinvoinnin laitos, Fineli (CC BY 4.0). Units converted; kcal derived from kJ.',
   'https://fineli.fi', 'https://creativecommons.org/licenses/by/4.0/', 10, 1),
  ('usda_foundation', 'USDA FoodData Central — Foundation Foods', 'CC0 1.0',
   'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, fdc.nal.usda.gov.',
   'https://fdc.nal.usda.gov', 'https://creativecommons.org/publicdomain/zero/1.0/', 9, 1),
  ('usda_sr_legacy', 'USDA FoodData Central — SR Legacy', 'CC0 1.0',
   'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, fdc.nal.usda.gov.',
   'https://fdc.nal.usda.gov', 'https://creativecommons.org/publicdomain/zero/1.0/', 8, 1),
  ('usda_branded', 'USDA FoodData Central — Branded Foods', 'CC0 1.0',
   'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, fdc.nal.usda.gov.',
   'https://fdc.nal.usda.gov', 'https://creativecommons.org/publicdomain/zero/1.0/', 6, 3),
  ('off', 'Open Food Facts', 'ODbL 1.0',
   '© Open Food Facts contributors, Open Database License (ODbL).',
   'https://world.openfoodfacts.org', 'https://opendatacommons.org/licenses/odbl/1-0/', 5, 3),
  ('user', 'My foods', 'user', 'Entered by the user.', NULL, NULL, 12, 4)
ON CONFLICT (code) DO NOTHING;

-- ---------- nutrient_definitions ----------
-- Canonical unit per key; *_factor converts the SOURCE unit into it.
--   Fineli: component values in the unit of component.csv (ENERC kJ, most g/mg/ug;
--           the four named fatty acids and NACL are mg → ×0.001).
--   USDA:   nutrient ids already in canonical units → factor 1. carbs_g = 1005 − 1079
--           is done by the ingestion script (1005 includes fibre).
--   OFF:    <off_key>_100g is grams for every mass nutrient → mg ×1000, ug ×1e6;
--           alcohol_100g is % vol → ×0.789 g/100 ml. energy-kj fallback is script-side.
CREATE TABLE IF NOT EXISTS public.nutrient_definitions (
  id               smallint PRIMARY KEY,
  key              text NOT NULL UNIQUE,
  name_en          text NOT NULL,
  name_fi          text NOT NULL,
  unit             text NOT NULL CHECK (unit IN ('kcal','g','mg','ug')),
  category         text NOT NULL CHECK (category IN ('energy','macro','carb','fat','vitamin','mineral','other')),
  sort_order       smallint NOT NULL,
  fineli_code      text,
  fineli_factor    numeric(16,8),
  usda_nutrient_id int,
  usda_factor      numeric(16,8),
  off_key          text,
  off_factor       numeric(16,8)
);

INSERT INTO public.nutrient_definitions
  (id, key, name_en, name_fi, unit, category, sort_order, fineli_code, fineli_factor, usda_nutrient_id, usda_factor, off_key, off_factor) VALUES
  -- energy + macros
  ( 1, 'kcal',            'Energy',              'Energia',                'kcal','energy',  10, 'ENERC',    0.23900574, 1008, 1, 'energy-kcal',            1),
  ( 2, 'protein_g',       'Protein',             'Proteiini',              'g',  'macro',    20, 'PROT',     1,          1003, 1, 'proteins',               1),
  ( 3, 'fat_g',           'Fat',                 'Rasva',                  'g',  'macro',    30, 'FAT',      1,          1004, 1, 'fat',                    1),
  ( 4, 'carbs_g',         'Carbohydrate (available)', 'Hiilihydraatti (imeytyvä)', 'g','macro', 40, 'CHOAVL', 1,       1005, 1, 'carbohydrates',          1),
  -- carbohydrate detail
  ( 5, 'fiber_g',         'Fibre',               'Kuitu',                  'g',  'carb',     50, 'FIBC',     1,          1079, 1, 'fiber',                  1),
  ( 6, 'sugar_g',         'Sugars',              'Sokerit',                'g',  'carb',     60, 'SUGAR',    1,          2000, 1, 'sugars',                 1),
  ( 7, 'added_sugar_g',   'Added sugars',        'Lisätty sokeri',         'g',  'carb',     70, NULL,       NULL,       1235, 1, 'added-sugars',           1),
  ( 8, 'starch_g',        'Starch',              'Tärkkelys',              'g',  'carb',     80, 'STARCH',   1,          1009, 1, 'starch',                 1),
  ( 9, 'sugar_alcohol_g', 'Sugar alcohols',      'Sokerialkoholit',        'g',  'carb',     90, 'SUGOH',    1,          NULL, NULL, 'polyols',              1),
  -- fat detail
  (10, 'sat_fat_g',       'Saturated fat',       'Tyydyttynyt rasva',      'g',  'fat',     100, 'FASAT',    1,          1258, 1, 'saturated-fat',          1),
  (11, 'mufa_g',          'Monounsaturated fat', 'Kertatyydyttymätön rasva','g', 'fat',     110, 'FAMCIS',   1,          1292, 1, 'monounsaturated-fat',    1),
  (12, 'pufa_g',          'Polyunsaturated fat', 'Monityydyttymätön rasva','g',  'fat',     120, 'FAPU',     1,          1293, 1, 'polyunsaturated-fat',    1),
  (13, 'trans_fat_g',     'Trans fat',           'Transrasva',             'g',  'fat',     130, 'FATRN',    1,          1257, 1, 'trans-fat',              1),
  (14, 'cholesterol_mg',  'Cholesterol',         'Kolesteroli',            'mg', 'fat',     140, 'CHOLE',    1,          1253, 1, 'cholesterol',            1000),
  (15, 'omega3_g',        'Omega-3 fatty acids', 'Omega-3-rasvahapot',     'g',  'fat',     150, 'FAPUN3',   1,          NULL, NULL, 'omega-3-fat',          1),
  (16, 'omega6_g',        'Omega-6 fatty acids', 'Omega-6-rasvahapot',     'g',  'fat',     160, 'FAPUN6',   1,          NULL, NULL, 'omega-6-fat',          1),
  (17, 'ala_g',           'Alpha-linolenic acid (ALA)', 'Alfalinoleenihappo (ALA)', 'g', 'fat', 170, 'F18D3N3', 0.001,  1404, 1, 'alpha-linolenic-acid',   1),
  (18, 'epa_g',           'EPA',                 'EPA',                    'g',  'fat',     180, 'F20D5N3',  0.001,      1278, 1, 'eicosapentaenoic-acid',  1),
  (19, 'dha_g',           'DHA',                 'DHA',                    'g',  'fat',     190, 'F22D6N3',  0.001,      1272, 1, 'docosahexaenoic-acid',   1),
  (20, 'linoleic_g',      'Linoleic acid',       'Linolihappo',            'g',  'fat',     200, 'F18D2CN6', 0.001,      1316, 1, 'linoleic-acid',          1),
  -- vitamins
  (21, 'vit_a_ug',        'Vitamin A (RAE)',     'A-vitamiini (RAE)',      'ug', 'vitamin', 210, 'VITA',     1,          1106, 1, 'vitamin-a',              1000000),
  (22, 'vit_b1_mg',       'Thiamin (B1)',        'Tiamiini (B1)',          'mg', 'vitamin', 220, 'THIA',     1,          1165, 1, 'vitamin-b1',             1000),
  (23, 'vit_b2_mg',       'Riboflavin (B2)',     'Riboflaviini (B2)',      'mg', 'vitamin', 230, 'RIBF',     1,          1166, 1, 'vitamin-b2',             1000),
  (24, 'vit_b3_mg',       'Niacin (B3)',         'Niasiini (B3)',          'mg', 'vitamin', 240, 'NIA',      1,          1167, 1, 'vitamin-pp',             1000),
  (25, 'vit_b5_mg',       'Pantothenic acid (B5)', 'Pantoteenihappo (B5)', 'mg', 'vitamin', 250, NULL,       NULL,       1170, 1, 'pantothenic-acid',       1000),
  (26, 'vit_b6_mg',       'Vitamin B6',          'B6-vitamiini',           'mg', 'vitamin', 260, 'VITPYRID', 1,          1175, 1, 'vitamin-b6',             1000),
  (27, 'vit_b7_ug',       'Biotin (B7)',         'Biotiini (B7)',          'ug', 'vitamin', 270, NULL,       NULL,       1176, 1, 'biotin',                 1000000),
  (28, 'vit_b9_ug',       'Folate (B9)',         'Folaatti (B9)',          'ug', 'vitamin', 280, 'FOL',      1,          1177, 1, 'vitamin-b9',             1000000),
  (29, 'vit_b12_ug',      'Vitamin B12',         'B12-vitamiini',          'ug', 'vitamin', 290, 'VITB12',   1,          1178, 1, 'vitamin-b12',            1000000),
  (30, 'vit_c_mg',        'Vitamin C',           'C-vitamiini',            'mg', 'vitamin', 300, 'VITC',     1,          1162, 1, 'vitamin-c',              1000),
  (31, 'vit_d_ug',        'Vitamin D',           'D-vitamiini',            'ug', 'vitamin', 310, 'VITD',     1,          1114, 1, 'vitamin-d',              1000000),
  (32, 'vit_e_mg',        'Vitamin E',           'E-vitamiini',            'mg', 'vitamin', 320, 'VITE',     1,          1109, 1, 'vitamin-e',              1000),
  (33, 'vit_k_ug',        'Vitamin K',           'K-vitamiini',            'ug', 'vitamin', 330, 'VITK',     1,          1185, 1, 'vitamin-k',              1000000),
  -- minerals
  (34, 'calcium_mg',      'Calcium',             'Kalsium',                'mg', 'mineral', 340, 'CA',       1,          1087, 1, 'calcium',                1000),
  (35, 'iron_mg',         'Iron',                'Rauta',                  'mg', 'mineral', 350, 'FE',       1,          1089, 1, 'iron',                   1000),
  (36, 'magnesium_mg',    'Magnesium',           'Magnesium',              'mg', 'mineral', 360, 'MG',       1,          1090, 1, 'magnesium',              1000),
  (37, 'phosphorus_mg',   'Phosphorus',          'Fosfori',                'mg', 'mineral', 370, 'P',        1,          1091, 1, 'phosphorus',             1000),
  (38, 'potassium_mg',    'Potassium',           'Kalium',                 'mg', 'mineral', 380, 'K',        1,          1092, 1, 'potassium',              1000),
  (39, 'sodium_mg',       'Sodium',              'Natrium',                'mg', 'mineral', 390, 'NA',       1,          1093, 1, 'sodium',                 1000),
  (40, 'zinc_mg',         'Zinc',                'Sinkki',                 'mg', 'mineral', 400, 'ZN',       1,          1095, 1, 'zinc',                   1000),
  (41, 'copper_mg',       'Copper',              'Kupari',                 'mg', 'mineral', 410, NULL,       NULL,       1098, 1, 'copper',                 1000),
  (42, 'manganese_mg',    'Manganese',           'Mangaani',               'mg', 'mineral', 420, NULL,       NULL,       1101, 1, 'manganese',              1000),
  (43, 'selenium_ug',     'Selenium',            'Seleeni',                'ug', 'mineral', 430, 'SE',       1,          1103, 1, 'selenium',               1000000),
  (44, 'iodine_ug',       'Iodine',              'Jodi',                   'ug', 'mineral', 440, 'ID',       1,          1100, 1, 'iodine',                 1000000),
  -- salt: Fineli NACL mg → g; USDA sodium mg × 2.5 / 1000 → g; OFF salt_100g is g
  (45, 'salt_g',          'Salt',                'Suola',                  'g',  'mineral', 450, 'NACL',     0.001,      1093, 0.0025, 'salt',                1),
  -- other
  (46, 'choline_mg',      'Choline',             'Koliini',                'mg', 'other',   460, NULL,       NULL,       1180, 1, 'choline',                1000),
  (47, 'caffeine_mg',     'Caffeine',            'Kofeiini',               'mg', 'other',   470, NULL,       NULL,       1057, 1, 'caffeine',               1000),
  (48, 'alcohol_g',       'Alcohol',             'Alkoholi',               'g',  'other',   480, 'ALC',      1,          1018, 1, 'alcohol',                0.789),
  (49, 'water_g',         'Water',               'Vesi',                   'g',  'other',   490, NULL,       NULL,       1051, 1, 'water',                  1)
ON CONFLICT (id) DO UPDATE SET
  key = EXCLUDED.key, name_en = EXCLUDED.name_en, name_fi = EXCLUDED.name_fi, unit = EXCLUDED.unit,
  category = EXCLUDED.category, sort_order = EXCLUDED.sort_order,
  fineli_code = EXCLUDED.fineli_code, fineli_factor = EXCLUDED.fineli_factor,
  usda_nutrient_id = EXCLUDED.usda_nutrient_id, usda_factor = EXCLUDED.usda_factor,
  off_key = EXCLUDED.off_key, off_factor = EXCLUDED.off_factor;

-- ---------- foods ----------
CREATE TABLE IF NOT EXISTS public.foods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL REFERENCES public.food_sources(code),
  source_id      text NOT NULL,
  owner_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  name_fi        text,
  name_en        text,
  brand          text,
  country        char(2),
  category       text,
  food_type      text NOT NULL DEFAULT 'food' CHECK (food_type IN ('food','dish','branded','custom')),
  data_quality   smallint NOT NULL DEFAULT 3 CHECK (data_quality BETWEEN 1 AND 5),
  image_url      text,
  source_version text,
  fetched_at     timestamptz,
  is_active      boolean NOT NULL DEFAULT true,
  -- `name` is included so a custom food with neither name_fi nor name_en is still
  -- searchable; duplicated tokens do not change trigram-set similarity.
  -- `||` not concat_ws(): concat_ws is only STABLE, and a generated column must be IMMUTABLE.
  search_text    text GENERATED ALWAYS AS (public.f_unaccent(lower(
                   name || ' ' || COALESCE(name_fi, '') || ' ' || COALESCE(name_en, '') || ' ' || COALESCE(brand, '')))) STORED,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT foods_user_owner CHECK ((source = 'user') = (owner_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_foods_source ON public.foods (source, source_id);
CREATE INDEX IF NOT EXISTS idx_foods_search_trgm ON public.foods USING gin (search_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_search_prefix ON public.foods (search_text text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_foods_owner ON public.foods (owner_id) WHERE owner_id IS NOT NULL;

-- ---------- food_servings ----------
CREATE TABLE IF NOT EXISTS public.food_servings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id     uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  grams       numeric(10,3) NOT NULL CHECK (grams > 0 AND grams <= 5000),
  source_unit text,
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  smallint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_food_servings_label ON public.food_servings (food_id, label);

-- ---------- food_nutrients ----------
CREATE TABLE IF NOT EXISTS public.food_nutrients (
  food_id         uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  nutrient_id     smallint NOT NULL REFERENCES public.nutrient_definitions(id),
  amount_per_100g numeric(12,4) NOT NULL CHECK (amount_per_100g >= 0),
  PRIMARY KEY (food_id, nutrient_id)
);

-- ---------- food_barcodes ----------
CREATE TABLE IF NOT EXISTS public.food_barcodes (
  barcode    text PRIMARY KEY CHECK (barcode ~ '^[0-9]{8}$' OR barcode ~ '^[0-9]{13}$'),
  food_id    uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  source     text NOT NULL REFERENCES public.food_sources(code),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_barcodes_food ON public.food_barcodes (food_id);

-- ---------- food_barcode_misses (service role only) ----------
CREATE TABLE IF NOT EXISTS public.food_barcode_misses (
  barcode         text PRIMARY KEY,
  checked_at      timestamptz NOT NULL DEFAULT now(),
  sources_checked text[] NOT NULL DEFAULT '{}',
  attempts        int NOT NULL DEFAULT 1
);

-- ---------- RLS ----------
ALTER TABLE public.food_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrient_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_servings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_nutrients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_barcodes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_barcode_misses  ENABLE ROW LEVEL SECURITY;
-- food_barcode_misses: no policies — written/read only by the service role.

DROP POLICY IF EXISTS "food_sources read" ON public.food_sources;
CREATE POLICY "food_sources read" ON public.food_sources FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "nutrient_definitions read" ON public.nutrient_definitions;
CREATE POLICY "nutrient_definitions read" ON public.nutrient_definitions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "foods read public or own" ON public.foods;
DROP POLICY IF EXISTS "foods insert own" ON public.foods;
DROP POLICY IF EXISTS "foods update own" ON public.foods;
DROP POLICY IF EXISTS "foods delete own" ON public.foods;
CREATE POLICY "foods read public or own" ON public.foods FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "foods insert own" ON public.foods FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND source = 'user');
CREATE POLICY "foods update own" ON public.foods FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND source = 'user')
  WITH CHECK (owner_id = auth.uid() AND source = 'user');
CREATE POLICY "foods delete own" ON public.foods FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND source = 'user');

DROP POLICY IF EXISTS "food_servings read via food" ON public.food_servings;
DROP POLICY IF EXISTS "food_servings insert own food" ON public.food_servings;
DROP POLICY IF EXISTS "food_servings update own food" ON public.food_servings;
DROP POLICY IF EXISTS "food_servings delete own food" ON public.food_servings;
CREATE POLICY "food_servings read via food" ON public.food_servings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND (f.owner_id IS NULL OR f.owner_id = auth.uid())));
CREATE POLICY "food_servings insert own food" ON public.food_servings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'));
CREATE POLICY "food_servings update own food" ON public.food_servings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'));
CREATE POLICY "food_servings delete own food" ON public.food_servings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'));

DROP POLICY IF EXISTS "food_nutrients read via food" ON public.food_nutrients;
DROP POLICY IF EXISTS "food_nutrients insert own food" ON public.food_nutrients;
DROP POLICY IF EXISTS "food_nutrients update own food" ON public.food_nutrients;
DROP POLICY IF EXISTS "food_nutrients delete own food" ON public.food_nutrients;
CREATE POLICY "food_nutrients read via food" ON public.food_nutrients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND (f.owner_id IS NULL OR f.owner_id = auth.uid())));
CREATE POLICY "food_nutrients insert own food" ON public.food_nutrients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'));
CREATE POLICY "food_nutrients update own food" ON public.food_nutrients FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'));
CREATE POLICY "food_nutrients delete own food" ON public.food_nutrients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.foods f WHERE f.id = food_id AND f.owner_id = auth.uid() AND f.source = 'user'));

-- Barcode → food is global (the food itself is still filtered by the foods policy).
DROP POLICY IF EXISTS "food_barcodes read" ON public.food_barcodes;
CREATE POLICY "food_barcodes read" ON public.food_barcodes FOR SELECT TO authenticated USING (true);

-- ---------- grants (SECURITY INVOKER search_foods needs table SELECT) ----------
GRANT SELECT ON public.food_sources, public.nutrient_definitions, public.foods,
  public.food_servings, public.food_nutrients, public.food_barcodes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.foods, public.food_servings, public.food_nutrients TO authenticated;
