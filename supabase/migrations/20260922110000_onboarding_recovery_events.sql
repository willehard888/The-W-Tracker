-- Recovery guidance events.
--
-- Same reason as 20260906100100, restated because it is the failure that costs
-- nothing to make and is invisible afterwards: `onboarding_valid_event` is a
-- hardcoded allowlist, and the four RPCs that write onboarding state all check
-- it. An id that exists in TypeScript but not here is silently dropped on
-- write — the card shows, the athlete dismisses it, nothing persists, and it
-- shows again on the next launch, forever.
--
-- Two events for the whole feature. RECOVERY_INTRO chains off
-- WORKOUT_COMPLETE_INTRO, so the pair costs ONE of the two cards a launch is
-- allowed: finishing a first workout is a single beat, not two interruptions.
-- RECOVERY_REST_DAY_INTRO fires on its own, on a different day, for the thing
-- a rest day cannot say about itself.
--
-- Nothing else is taught with a card, because the session already says it. It
-- names the areas it was built for and prints one line about where they came
-- from; a sheet explaining that would be reading the screen aloud.

CREATE OR REPLACE FUNCTION public.onboarding_valid_event(_event_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _event_id = ANY (ARRAY[
    'TODAY_INTRO','CHECKIN_INTRO','XP_INTRO','STREAK_INTRO',
    'STREAK_SHIELD_INTRO','PROGRESSION_INTRO','AI_COACH_INTRO',
    'COACH_MISSION_INTRO','SQUAD_INTRO','RANKS_INTRO',
    'BADGES_INTRO','BATTLES_INTRO','VAULT_INTRO',
    -- Training (20260906100100):
    'TRAINING_PROGRAM_READY','FIRST_WORKOUT_INTRO','WORKOUT_LOGGING_INTRO',
    'WORKOUT_COMPLETE_INTRO','PROGRAM_ADAPTS_INTRO',
    -- Recovery (this migration):
    'RECOVERY_INTRO','RECOVERY_REST_DAY_INTRO'
  ]);
$$;

NOTIFY pgrst, 'reload schema';
