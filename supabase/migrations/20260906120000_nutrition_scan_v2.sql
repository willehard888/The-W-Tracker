-- ============================================================
-- Nutrition scan v2 — portion estimator support.
--
-- profiles.nutrition_prefs  jsonb twin of notification_prefs: {plate_cm}.
--                           Writable by the owner through the plain own-row
--                           UPDATE policy ("Users can update own profile",
--                           auth.uid() = user_id); protect_profile_columns
--                           (20260529120000 / 20260603210000) lists only the
--                           XP/streak/tier/membership columns and never this one.
-- meal_scan_reviews         what the user changed after a scan: the model's
--                           guess vs the saved value, per item. Members read
--                           their own rows; writes go through record_scan_review
--                           so a row can never be forged for another user.
-- record_scan_review        SECURITY DEFINER insert, ≤ 24 rows per scan, scan
--                           ownership checked against meal_scan_cache.
-- scan_user_priors          the caller's median grams per food over the last
--                           60 days (RLS-scoped) — portion hints for the model,
--                           never identification.
-- meal-scan-cache-retention pg_cron: drop cache rows older than 30 days.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nutrition_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.meal_scan_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id        uuid NOT NULL,
  image_sha256   text,
  model          text,
  prompt_version smallint,
  item_index     smallint NOT NULL,
  model_name     text,
  model_grams    numeric,
  model_food_id  uuid,
  final_food_id  uuid,
  final_grams    numeric,
  action         text NOT NULL CHECK (action IN ('kept','grams_edited','recandidated','removed','added')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_scan_reviews_user_created ON public.meal_scan_reviews (user_id, created_at DESC);

ALTER TABLE public.meal_scan_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meal_scan_reviews own select" ON public.meal_scan_reviews;
CREATE POLICY "meal_scan_reviews own select" ON public.meal_scan_reviews FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Default privileges GRANT ALL to anon / authenticated; writes are RPC-only.
REVOKE INSERT, UPDATE, DELETE ON public.meal_scan_reviews FROM anon, authenticated;
GRANT SELECT ON public.meal_scan_reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.record_scan_review(p_scan_id uuid, p_rows jsonb)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_sha    text;
  v_model  text;
  v_n      int := 0;
  v_row    jsonb;
  v_action text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_scan_id IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'BAD_INPUT'; END IF;
  IF jsonb_array_length(p_rows) > 24 THEN RAISE EXCEPTION 'TOO_MANY_ROWS'; END IF;

  SELECT c.user_id, c.image_sha256, c.model INTO v_owner, v_sha, v_model
  FROM meal_scan_cache c WHERE c.id = p_scan_id;
  IF v_owner IS NOT NULL AND v_owner <> v_uid THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF jsonb_typeof(v_row) <> 'object' THEN RAISE EXCEPTION 'BAD_INPUT'; END IF;
    v_action := v_row->>'action';
    IF v_action IS NULL OR v_action NOT IN ('kept','grams_edited','recandidated','removed','added') THEN
      RAISE EXCEPTION 'BAD_ACTION';
    END IF;
    INSERT INTO meal_scan_reviews
      (user_id, scan_id, image_sha256, model, prompt_version, item_index, model_name, model_grams, model_food_id, final_food_id, final_grams, action)
    VALUES
      (v_uid, p_scan_id, v_sha, v_model,
       (v_row->>'prompt_version')::smallint,
       COALESCE((v_row->>'item_index')::smallint, v_n::smallint),
       left(v_row->>'model_name', 80),
       (v_row->>'model_grams')::numeric,
       (v_row->>'model_food_id')::uuid,
       (v_row->>'final_food_id')::uuid,
       (v_row->>'final_grams')::numeric,
       v_action);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.record_scan_review(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_scan_review(uuid, jsonb) TO authenticated;

-- SECURITY INVOKER: meal_log_items / meal_logs RLS scopes this to the caller.
CREATE OR REPLACE FUNCTION public.scan_user_priors()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('food_id', t.food_id, 'name', t.name, 'median_g', t.median_g, 'n', t.n) ORDER BY t.n DESC),
    '[]'::jsonb)
  FROM (
    SELECT i.food_id,
           min(i.display_name) AS name,
           round((percentile_cont(0.5) WITHIN GROUP (ORDER BY i.grams))::numeric) AS median_g,
           count(*) AS n
    FROM meal_log_items i
    JOIN meal_logs m ON m.id = i.meal_log_id
    WHERE i.kind = 'food' AND i.food_id IS NOT NULL
      AND m.log_date >= current_date - 60
    GROUP BY i.food_id
    HAVING count(*) >= 2
    ORDER BY n DESC
    LIMIT 20
  ) t;
$$;
REVOKE ALL ON FUNCTION public.scan_user_priors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_user_priors() TO authenticated, service_role;

-- Cache retention (the edge function already ignores rows older than 30 days).
DO $$
BEGIN
  PERFORM cron.schedule(
    'meal-scan-cache-retention',
    '40 4 * * *',
    $job$ DELETE FROM public.meal_scan_cache WHERE created_at < now() - interval '30 days' $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule meal-scan-cache-retention manually';
END $$;

NOTIFY pgrst, 'reload schema';
