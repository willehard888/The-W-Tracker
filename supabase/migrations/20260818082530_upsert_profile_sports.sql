-- ============================================================
-- upsert_athlete_profile: accept the new `sports` field
-- ============================================================
-- 20260818082050 added coach_athlete_profile.sports text[] (the coach's
-- standing sport context — separate from hobbies, which steer recovery
-- framing). The upsert RPC whitelists columns, so without this the
-- onboarding's sports chips would silently no-op.
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
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

NOTIFY pgrst, 'reload schema';
