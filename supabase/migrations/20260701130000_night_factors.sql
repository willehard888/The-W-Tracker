-- Per-night factor tagging (alcohol / late meal / stress / travel / sick …) so
-- the coach's causal inference gets ground-truth confirmation and learns which
-- factors actually wreck THIS user's sleep. Idempotent.

ALTER TABLE public.health_night_metrics ADD COLUMN IF NOT EXISTS factors text[];

-- Set/replace the factors the user attributes to a given night. Creates the row
-- if HealthKit hasn't synced it yet (so tagging works even without a device).
CREATE OR REPLACE FUNCTION public.set_night_factors(p_night_date date, p_factors text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO health_night_metrics (user_id, night_date, factors, updated_at)
    VALUES (uid, p_night_date, p_factors, now())
  ON CONFLICT (user_id, night_date) DO UPDATE SET factors = EXCLUDED.factors, updated_at = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.set_night_factors(date, text[]) TO authenticated;
