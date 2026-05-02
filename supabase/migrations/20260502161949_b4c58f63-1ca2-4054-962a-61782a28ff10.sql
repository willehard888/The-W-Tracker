CREATE OR REPLACE FUNCTION public.upsert_daily_plan(
  _plan_date date,
  _readiness_score integer,
  _readiness_breakdown jsonb,
  _adjustment text,
  _headline text,
  _missions jsonb,
  _generated_with text,
  _rationale text DEFAULT NULL,
  _framework_version text DEFAULT '1.0'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.coach_daily_plans(
    user_id, plan_date, readiness_score, readiness_breakdown,
    adjustment, headline, missions, generated_with, rationale, framework_version
  ) VALUES (
    v_user, _plan_date, _readiness_score, _readiness_breakdown,
    _adjustment, _headline, _missions, _generated_with, _rationale, COALESCE(_framework_version, '1.0')
  )
  ON CONFLICT (user_id, plan_date)
  DO UPDATE SET
    readiness_score = EXCLUDED.readiness_score,
    readiness_breakdown = EXCLUDED.readiness_breakdown,
    adjustment = EXCLUDED.adjustment,
    headline = EXCLUDED.headline,
    missions = EXCLUDED.missions,
    generated_with = EXCLUDED.generated_with,
    rationale = EXCLUDED.rationale,
    framework_version = EXCLUDED.framework_version,
    generated_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_daily_plan(date, integer, jsonb, text, text, jsonb, text, text, text) TO authenticated;