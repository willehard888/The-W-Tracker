
-- 1. Block direct user inserts on user_badges
DROP POLICY IF EXISTS "System can insert badges" ON public.user_badges;
CREATE POLICY "No direct badge insertion"
ON public.user_badges
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 2. Create SECURITY DEFINER function for badge awarding
CREATE OR REPLACE FUNCTION public.award_badge_if_earned(p_user_id uuid, p_badge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge_rec RECORD;
  stat_value numeric;
  profile_rec RECORD;
BEGIN
  -- Only the user themselves can trigger their own badge check
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Already earned?
  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id) THEN
    RETURN false;
  END IF;

  -- Get badge requirements
  SELECT * INTO badge_rec FROM badges WHERE id = p_badge_id;
  IF NOT FOUND OR badge_rec.requirement_type IS NULL OR badge_rec.requirement_value IS NULL THEN
    RETURN false;
  END IF;

  -- Get profile
  SELECT * INTO profile_rec FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Calculate the stat based on requirement_type
  CASE badge_rec.requirement_type
    WHEN 'checkins' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id;
    WHEN 'workouts', 'combat_workouts', 'run_workouts' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND workout = true;
    WHEN 'cold_shower', 'cold_showers' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND cold_shower = true;
    WHEN 'healthy_food' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND healthy_food = true;
    WHEN 'protein' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND protein_intake = true;
    WHEN 'hydration' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND hydration_liters >= 3;
    WHEN 'no_phone_morning' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND no_phone_morning = true;
    WHEN 'no_phone_evening' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND no_phone_evening = true;
    WHEN 'reading' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND reading = true;
    WHEN 'battles_won' THEN
      SELECT count(*) INTO stat_value FROM battles WHERE winner_id = p_user_id;
    WHEN 'referrals' THEN
      SELECT count(*) INTO stat_value FROM referrals WHERE referrer_id = p_user_id;
    WHEN 'double_workout' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND extra_workout = true;
    WHEN 'meditation', 'meditation_streak' THEN
      SELECT (SELECT count(*) FROM daily_checkins WHERE user_id = p_user_id AND meditation_morning = true)
           + (SELECT count(*) FROM daily_checkins WHERE user_id = p_user_id AND meditation_evening = true)
      INTO stat_value;
    WHEN 'proofs' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins WHERE user_id = p_user_id AND proof_photo_url IS NOT NULL;
    WHEN 'perfect_day' THEN
      SELECT count(*) INTO stat_value FROM daily_checkins
      WHERE user_id = p_user_id AND workout = true AND cold_shower = true
        AND healthy_food = true AND protein_intake = true AND hydration_liters >= 3
        AND reading = true AND no_phone_morning = true AND no_phone_evening = true;
    WHEN 'elite_member' THEN
      stat_value := CASE WHEN profile_rec.is_elite THEN 1 ELSE 0 END;
    WHEN 'xp', 'total_xp' THEN
      stat_value := profile_rec.xp;
    WHEN 'level' THEN
      stat_value := profile_rec.level;
    WHEN 'streak' THEN
      stat_value := profile_rec.longest_streak;
    ELSE
      -- Trigger-based types (total_likes, etc.) - skip
      RETURN false;
  END CASE;

  -- Check if requirement met
  IF stat_value >= badge_rec.requirement_value THEN
    INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, p_badge_id)
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
