-- Causal Health Intelligence — nightly recovery metrics from HealthKit, so the
-- coach can reason about WHY sleep/performance changed (resting HR, sleep stages,
-- respiratory rate, overnight HR, SpO2). One row per night. Idempotent.
-- (hrv_sdnn is reserved for a future custom-native read — @perfood can't map it.)

CREATE TABLE IF NOT EXISTS public.health_night_metrics (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  night_date        date NOT NULL,           -- local morning date the sleep ended on
  resting_hr        numeric,                 -- bpm
  avg_hr            numeric,                 -- avg overnight bpm
  min_hr            numeric,                 -- lowest sleeping bpm
  hrv_sdnn          numeric,                 -- ms (reserved; not populated yet)
  respiratory_rate  numeric,                 -- breaths/min (overnight avg)
  spo2              numeric,                 -- % (overnight avg)
  sleep_total_min   int,
  sleep_deep_min    int,
  sleep_rem_min     int,
  sleep_core_min    int,
  awake_min         int,
  sleep_start       timestamptz,
  sleep_end         timestamptz,
  source            text NOT NULL DEFAULT 'healthkit',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_health_night_metrics
  ON public.health_night_metrics (user_id, night_date);
CREATE INDEX IF NOT EXISTS idx_health_night_metrics_user_date
  ON public.health_night_metrics (user_id, night_date DESC);

ALTER TABLE public.health_night_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "night_metrics own select" ON public.health_night_metrics;
DROP POLICY IF EXISTS "night_metrics own upsert" ON public.health_night_metrics;
DROP POLICY IF EXISTS "night_metrics own update" ON public.health_night_metrics;
CREATE POLICY "night_metrics own select" ON public.health_night_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "night_metrics own upsert" ON public.health_night_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "night_metrics own update" ON public.health_night_metrics FOR UPDATE USING (auth.uid() = user_id);

-- Upsert one night's metrics (called after morning HealthKit sync).
CREATE OR REPLACE FUNCTION public.upsert_night_metrics(
  p_night_date date,
  p_resting_hr numeric DEFAULT NULL,
  p_avg_hr numeric DEFAULT NULL,
  p_min_hr numeric DEFAULT NULL,
  p_hrv_sdnn numeric DEFAULT NULL,
  p_respiratory_rate numeric DEFAULT NULL,
  p_spo2 numeric DEFAULT NULL,
  p_sleep_total_min int DEFAULT NULL,
  p_sleep_deep_min int DEFAULT NULL,
  p_sleep_rem_min int DEFAULT NULL,
  p_sleep_core_min int DEFAULT NULL,
  p_awake_min int DEFAULT NULL,
  p_sleep_start timestamptz DEFAULT NULL,
  p_sleep_end timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO health_night_metrics AS h (
    user_id, night_date, resting_hr, avg_hr, min_hr, hrv_sdnn, respiratory_rate, spo2,
    sleep_total_min, sleep_deep_min, sleep_rem_min, sleep_core_min, awake_min,
    sleep_start, sleep_end, updated_at
  ) VALUES (
    uid, p_night_date, p_resting_hr, p_avg_hr, p_min_hr, p_hrv_sdnn, p_respiratory_rate, p_spo2,
    p_sleep_total_min, p_sleep_deep_min, p_sleep_rem_min, p_sleep_core_min, p_awake_min,
    p_sleep_start, p_sleep_end, now()
  )
  ON CONFLICT (user_id, night_date) DO UPDATE SET
    -- Only overwrite with non-null values (a partial re-sync never wipes data).
    resting_hr       = COALESCE(EXCLUDED.resting_hr, h.resting_hr),
    avg_hr           = COALESCE(EXCLUDED.avg_hr, h.avg_hr),
    min_hr           = COALESCE(EXCLUDED.min_hr, h.min_hr),
    hrv_sdnn         = COALESCE(EXCLUDED.hrv_sdnn, h.hrv_sdnn),
    respiratory_rate = COALESCE(EXCLUDED.respiratory_rate, h.respiratory_rate),
    spo2             = COALESCE(EXCLUDED.spo2, h.spo2),
    sleep_total_min  = COALESCE(EXCLUDED.sleep_total_min, h.sleep_total_min),
    sleep_deep_min   = COALESCE(EXCLUDED.sleep_deep_min, h.sleep_deep_min),
    sleep_rem_min    = COALESCE(EXCLUDED.sleep_rem_min, h.sleep_rem_min),
    sleep_core_min   = COALESCE(EXCLUDED.sleep_core_min, h.sleep_core_min),
    awake_min        = COALESCE(EXCLUDED.awake_min, h.awake_min),
    sleep_start      = COALESCE(EXCLUDED.sleep_start, h.sleep_start),
    sleep_end        = COALESCE(EXCLUDED.sleep_end, h.sleep_end),
    updated_at       = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_night_metrics(date,numeric,numeric,numeric,numeric,numeric,numeric,int,int,int,int,int,timestamptz,timestamptz) TO authenticated;

-- Recent nights (newest first) for the coach + the Recovery card.
CREATE OR REPLACE FUNCTION public.recent_night_metrics(p_days int DEFAULT 30)
RETURNS SETOF public.health_night_metrics
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM health_night_metrics
  WHERE user_id = auth.uid()
  ORDER BY night_date DESC
  LIMIT GREATEST(1, LEAST(p_days, 120));
$$;
GRANT EXECUTE ON FUNCTION public.recent_night_metrics(int) TO authenticated;
