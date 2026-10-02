-- Weekly review: the three questions the athlete would ask about it.
--
-- The review is read on the Coach page Mon–Wed and the way to talk to the
-- coach is a tap on a ready question, not a typed sentence. The model writes
-- three grounded questions (one of the review's own numbers or names in
-- each) alongside the review; they are stored with it so the card never
-- regenerates them.
--
-- upsert_weekly_review gains the eleventh argument with a default; the
-- ten-arg function is dropped so PostgREST never has two candidates.

ALTER TABLE public.coach_weekly_reviews
  ADD COLUMN IF NOT EXISTS suggested_questions jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP FUNCTION IF EXISTS public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text,jsonb,text);

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
  _lifts_note text DEFAULT NULL,
  _suggested_questions jsonb DEFAULT '[]'::jsonb
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
    next_week_focus, program_tweak, generated_with, lifts, lifts_note, suggested_questions
  ) VALUES (
    uid, _week_starts_on, GREATEST(0, LEAST(100, _performance_score)), _driver_of_week,
    COALESCE(_wins, '[]'::jsonb), COALESCE(_frictions, '[]'::jsonb),
    _next_week_focus, _program_tweak, COALESCE(_generated_with, 'google/gemini-2.5-flash'),
    COALESCE(_lifts, '[]'::jsonb), left(_lifts_note, 240), COALESCE(_suggested_questions, '[]'::jsonb)
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
    lifts_note = EXCLUDED.lifts_note,
    suggested_questions = EXCLUDED.suggested_questions
  RETURNING id INTO rid;
  RETURN rid;
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text,jsonb,text,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text,jsonb,text,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
