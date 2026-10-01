-- Weekly review: the week's lifts, computed, not generated.
--
-- The review read sleep, check-ins, reflections and Health workouts and never
-- a single set. It now stores `lifts`: one row per movement the athlete loaded
-- in the window, with the load the app's own overload rule says next (the same
-- number the set row seeds — see supabase/functions/_shared/overload.ts). The
-- rows are computed in the function and stored as data, so they survive a
-- missing key, a declined consent and the daily quota; the model only adds a
-- one-sentence verdict (lifts_note).
--
-- upsert_weekly_review gains the ninth argument with a default; the eight-arg
-- function is dropped so PostgREST never has two candidates for the same keys.

ALTER TABLE public.coach_weekly_reviews
  ADD COLUMN IF NOT EXISTS lifts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lifts_note text;

DROP FUNCTION IF EXISTS public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text);

CREATE OR REPLACE FUNCTION public.upsert_weekly_review(
  _week_starts_on date,
  _performance_score int,
  _driver_of_week text,
  _wins jsonb,
  _frictions jsonb,
  _next_week_focus text,
  _program_tweak text,
  _generated_with text,
  _lifts jsonb DEFAULT '[]'::jsonb,
  _lifts_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.coach_weekly_reviews (
    user_id, week_starts_on, performance_score, driver_of_week, wins, frictions,
    next_week_focus, program_tweak, generated_with, lifts, lifts_note
  ) VALUES (
    uid, _week_starts_on, GREATEST(0, LEAST(100, _performance_score)), _driver_of_week,
    COALESCE(_wins, '[]'::jsonb), COALESCE(_frictions, '[]'::jsonb),
    _next_week_focus, _program_tweak, COALESCE(_generated_with, 'google/gemini-2.5-flash'),
    COALESCE(_lifts, '[]'::jsonb), left(_lifts_note, 240)
  )
  ON CONFLICT (user_id, week_starts_on) DO UPDATE SET
    performance_score = EXCLUDED.performance_score,
    driver_of_week = EXCLUDED.driver_of_week,
    wins = EXCLUDED.wins,
    frictions = EXCLUDED.frictions,
    next_week_focus = EXCLUDED.next_week_focus,
    program_tweak = EXCLUDED.program_tweak,
    generated_with = EXCLUDED.generated_with,
    lifts = EXCLUDED.lifts,
    lifts_note = EXCLUDED.lifts_note
  RETURNING id INTO rid;
  RETURN rid;
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text,jsonb,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text,jsonb,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
