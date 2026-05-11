-- Holistic well-being columns for coach_athlete_profile.
--
-- The Coach intake previously captured only physical signals (age, height,
-- weight, sex), goals, equipment, dietary constraints, and a "tone" preference.
-- For real holistic (physical + mental + emotional) coaching we need:
--
--   hobbies              — what the user does for joy / identity / community
--   life_context         — free-text life situation (family/work/season)
--   stress_baseline      — 1..5 chronic-stress self-report
--   mood_baseline        — 1..5 baseline-mood self-report
--   mental_health_focus  — voluntary tags (anxiety / low mood / focus / sleep
--                          / burnout / none) so the coach knows what to weight
--
-- The accompanying onboarding step ("Mind & life") writes these via the same
-- upsert_athlete_profile RPC. Edge functions (ai-coach, coach-generate-program,
-- life-os-brief) already `select *` from this table, so the new columns flow
-- into AI prompts automatically — no edge-function changes required.

-- 1. Columns
ALTER TABLE public.coach_athlete_profile
  ADD COLUMN IF NOT EXISTS hobbies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS life_context text,
  ADD COLUMN IF NOT EXISTS stress_baseline int
    CHECK (stress_baseline IS NULL OR stress_baseline BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS mood_baseline int
    CHECK (mood_baseline IS NULL OR mood_baseline BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS mental_health_focus text[] NOT NULL DEFAULT '{}';

-- 2. RPC: extend upsert_athlete_profile to COALESCE the 5 new fields.
-- Mirrors the existing pattern in 20260502164736_*.sql exactly so the function
-- body stays consistent. Only the five new field assignments are added.
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
    -- New holistic fields (this migration):
    hobbies = COALESCE(
      CASE WHEN _patch ? 'hobbies'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'hobbies'))
      END, hobbies),
    life_context = COALESCE(_patch->>'life_context', life_context),
    stress_baseline = COALESCE((_patch->>'stress_baseline')::int, stress_baseline),
    mood_baseline = COALESCE((_patch->>'mood_baseline')::int, mood_baseline),
    mental_health_focus = COALESCE(
      CASE WHEN _patch ? 'mental_health_focus'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'mental_health_focus'))
      END, mental_health_focus),
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;
