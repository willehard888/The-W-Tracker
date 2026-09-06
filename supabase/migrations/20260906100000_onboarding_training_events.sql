-- Training guidance events.
--
-- `onboarding_valid_event` is a hardcoded allowlist, and the four RPCs that
-- write onboarding state all check it. An event id that exists in TypeScript
-- but not here is silently dropped on write: the card shows, the athlete
-- dismisses it, nothing persists, and it shows again on the next launch. So
-- the id list has to be added in both places, and this is the other place.
--
-- Five events, not the fourteen the feature could justify. The provider caps
-- trigger-initiated cards at two per app launch, and everything else an
-- athlete needs to learn is taught inline by the runner itself — the line
-- under "3 × 8", the rest timer's own label, the progress bar. A card is for
-- what a surface cannot say about itself.
--
-- FIRST_WORKOUT_INTRO chains to WORKOUT_LOGGING_INTRO, and a chain counts as
-- one teaching moment against that cap: starting a first workout is a single
-- beat, not two interruptions.

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
    -- Training (this migration):
    'TRAINING_PROGRAM_READY','FIRST_WORKOUT_INTRO','WORKOUT_LOGGING_INTRO',
    'WORKOUT_COMPLETE_INTRO','PROGRAM_ADAPTS_INTRO'
  ]);
$$;

-- Existing athletes are already grandfathered by 20260831130000's backfill, so
-- nobody who has been training for weeks is about to be told what a set is.
-- Stated rather than assumed: `isEligible` refuses every event for a profile
-- carrying `grandfathered: true`, and that flag is untouched here.

NOTIFY pgrst, 'reload schema';
