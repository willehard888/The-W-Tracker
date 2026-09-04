-- Training experience on the athlete profile.
--
-- The coach has always been able to personalise heavily — it reads the profile,
-- 30 days of check-ins, 14 days of reflections, active goals and the athlete's
-- own logged lifts. What it could never know is whether the person had ever set
-- foot in a gym. There was no experience field anywhere on the profile and
-- onboarding never asked, so `coach_programs.experience` was written as the
-- literal string 'auto' on every row since the table was created, and read by
-- nothing.
--
-- Meanwhile the generator's prompt demands 4-6 loaded exercises on every
-- training day and forbids building a program out of bodyweight movements. A
-- complete beginner was handed four to six barbell lifts, four days a week.
--
-- This column is what lets a first-timer be routed to the written 8-week
-- starter path instead.

ALTER TABLE public.coach_athlete_profile
  ADD COLUMN IF NOT EXISTS training_experience text;

-- Nullable on purpose: every existing athlete predates the question, and we
-- must not guess an answer on their behalf. NULL means "never asked", which is
-- treated as experienced — those users already have programs running and must
-- not be dropped onto a beginner path.
ALTER TABLE public.coach_athlete_profile
  DROP CONSTRAINT IF EXISTS coach_athlete_profile_training_experience_check;

ALTER TABLE public.coach_athlete_profile
  ADD CONSTRAINT coach_athlete_profile_training_experience_check
  CHECK (training_experience IS NULL
         OR training_experience IN ('never_trained', 'under_6_months', 'experienced'));

COMMENT ON COLUMN public.coach_athlete_profile.training_experience IS
  'How much gym experience the athlete reported at onboarding. NULL = never asked (pre-existing users); treated as experienced so nobody is moved onto the beginner path behind their back.';

-- ============================================================
-- upsert_athlete_profile must accept the new field.
--
-- The RPC whitelists columns one by one. A previous migration
-- (20260818082530) exists for exactly this reason: without it the sports
-- chips silently no-opped. Adding the column without adding it here would
-- leave onboarding collecting an answer that never reached the database.
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_athlete_profile(_patch jsonb)
RETURNS public.coach_athlete_profile
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.coach_athlete_profile;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.coach_athlete_profile (user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.coach_athlete_profile SET
    age = COALESCE((_patch->>'age')::int, age),
    sex = COALESCE(_patch->>'sex', sex),
    height_cm = COALESCE((_patch->>'height_cm')::numeric, height_cm),
    weight_kg = COALESCE((_patch->>'weight_kg')::numeric, weight_kg),
    body_fat_pct = COALESCE((_patch->>'body_fat_pct')::numeric, body_fat_pct),
    primary_goal = COALESCE(_patch->>'primary_goal', primary_goal),
    secondary_goal = COALESCE(_patch->>'secondary_goal', secondary_goal),
    target_horizon_weeks = COALESCE((_patch->>'target_horizon_weeks')::int, target_horizon_weeks),
    timezone = COALESCE(_patch->>'timezone', timezone),
    wake_time = COALESCE((_patch->>'wake_time')::time, wake_time),
    sleep_time = COALESCE((_patch->>'sleep_time')::time, sleep_time),
    training_days_pref = COALESCE(
      CASE WHEN _patch ? 'training_days_pref'
           THEN ARRAY(SELECT (jsonb_array_elements_text(_patch->'training_days_pref'))::int)
      END, training_days_pref),
    busy_blocks = COALESCE(_patch->'busy_blocks', busy_blocks),
    injuries = COALESCE(
      CASE WHEN _patch ? 'injuries'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'injuries'))
      END, injuries),
    dietary = COALESCE(
      CASE WHEN _patch ? 'dietary'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'dietary'))
      END, dietary),
    equipment = COALESCE(
      CASE WHEN _patch ? 'equipment'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'equipment'))
      END, equipment),
    no_go_protocols = COALESCE(
      CASE WHEN _patch ? 'no_go_protocols'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'no_go_protocols'))
      END, no_go_protocols),
    language_pref = COALESCE(_patch->>'language_pref', language_pref),
    tone_pref = COALESCE(_patch->>'tone_pref', tone_pref),
    preferred_session_length_min = COALESCE((_patch->>'preferred_session_length_min')::int, preferred_session_length_min),
    i_am = COALESCE(_patch->>'i_am', i_am),
    onboarded = COALESCE((_patch->>'onboarded')::boolean, onboarded),
    -- Holistic fields (added by 20260511181220):
    hobbies = COALESCE(
      CASE WHEN _patch ? 'hobbies'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'hobbies'))
      END, hobbies),
    sports = COALESCE(
      CASE WHEN _patch ? 'sports'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'sports'))
      END, sports),
    life_context = COALESCE(_patch->>'life_context', life_context),
    stress_baseline = COALESCE((_patch->>'stress_baseline')::int, stress_baseline),
    mood_baseline = COALESCE((_patch->>'mood_baseline')::int, mood_baseline),
    mental_health_focus = COALESCE(
      CASE WHEN _patch ? 'mental_health_focus'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'mental_health_focus'))
      END, mental_health_focus),
    -- The field this migration adds:
    training_experience = COALESCE(_patch->>'training_experience', training_experience),
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

NOTIFY pgrst, 'reload schema';
