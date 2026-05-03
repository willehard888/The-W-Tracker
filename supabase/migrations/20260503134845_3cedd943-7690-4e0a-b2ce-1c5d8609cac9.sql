ALTER TABLE public.coach_athlete_profile DROP CONSTRAINT IF EXISTS coach_athlete_profile_primary_goal_check;
ALTER TABLE public.coach_athlete_profile DROP CONSTRAINT IF EXISTS coach_athlete_profile_secondary_goal_check;
ALTER TABLE public.coach_athlete_profile ADD CONSTRAINT coach_athlete_profile_primary_goal_check
  CHECK (primary_goal = ANY (ARRAY['all','strength','hypertrophy','endurance','fat_loss','longevity','focus']));
ALTER TABLE public.coach_athlete_profile ADD CONSTRAINT coach_athlete_profile_secondary_goal_check
  CHECK (secondary_goal IS NULL OR secondary_goal = ANY (ARRAY['all','strength','hypertrophy','endurance','fat_loss','longevity','focus']));