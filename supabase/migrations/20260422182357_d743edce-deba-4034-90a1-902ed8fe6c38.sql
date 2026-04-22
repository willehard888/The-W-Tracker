-- ============================================================
-- 1. Insert 15 new badges (idempotent)
-- ============================================================
INSERT INTO public.badges (name, description, icon, rarity, requirement_type, requirement_value, category) VALUES
  ('Spark Brother',     'Your tribe burned together for 7 days straight',     '🔥', 'common',    'tribe_collective_streak', 7,   'tribe'),
  ('Tribe Ember',       'Tribe collective streak hit 30 days',                '🪵', 'rare',      'tribe_collective_streak', 30,  'tribe'),
  ('Tribe Inferno',     'Tribe collective streak hit 90 days',                '🌋', 'epic',      'tribe_collective_streak', 90,  'tribe'),
  ('Eternal Pyre',      'Tribe collective streak reached 180 days',           '☄️', 'legendary', 'tribe_collective_streak', 180, 'tribe'),
  ('Tribe Founder',     'A tribe you founded reached collective streak 30',   '👑', 'epic',      'tribe_founder_streak',    30,  'tribe'),
  ('First Tribe Blood', 'Won your first tribe battle',                        '⚔️', 'common',    'tribe_battles_won', 1,  'tribe'),
  ('War Chief',         'Won 5 tribe battles',                                '🛡️', 'rare',      'tribe_battles_won', 5,  'tribe'),
  ('Tribe Conqueror',   'Won 15 tribe battles',                               '🏆', 'epic',      'tribe_battles_won', 15, 'tribe'),
  ('Apex Reached',      'Reached the Apex tier',                              '💎', 'epic',      'apex_reached',     1,  'tier'),
  ('Apex Stronghold',   'Held Apex tier for 14 days',                         '🏔️', 'epic',      'apex_held_days',   14, 'tier'),
  ('Founding Apex',     'Joined Apex through paid Instant subscription',      '✨', 'legendary', 'apex_founding',    1,  'tier'),
  ('Legend Ascendant',  'Reached the Legend tier',                            '🌟', 'legendary', 'legend_reached',   1,  'tier'),
  ('Eternal Legend',    'Held Legend tier for 30 days',                       '👁️', 'legendary', 'legend_held_days', 30, 'tier'),
  ('Inferno Personal',  'Reached a personal streak of 100 days',              '🔥', 'epic',      'personal_streak',  100, 'streak'),
  ('Phoenix',           'Rebuilt to a 30+ streak after losing one',           '🦅', 'rare',      'phoenix_recovery', 1,   'streak')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. Extend award_badge_if_earned to validate new types
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_badge_if_earned(p_user_id uuid, p_badge_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  badge_rec RECORD;
  stat_value numeric;
  profile_rec RECORD;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id) THEN
    RETURN false;
  END IF;

  SELECT * INTO badge_rec FROM badges WHERE id = p_badge_id;
  IF NOT FOUND OR badge_rec.requirement_type IS NULL OR badge_rec.requirement_value IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO profile_rec FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

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

    -- ============ NEW TYPES ============
    WHEN 'personal_streak' THEN
      stat_value := profile_rec.longest_streak;

    WHEN 'phoenix_recovery' THEN
      IF profile_rec.longest_streak >= 30
         AND profile_rec.streak >= 30
         AND profile_rec.longest_streak > profile_rec.streak THEN
        stat_value := 1;
      ELSE
        stat_value := 0;
      END IF;

    WHEN 'apex_reached' THEN
      stat_value := CASE WHEN profile_rec.status_tier IN ('apex','legend') THEN 1 ELSE 0 END;

    WHEN 'legend_reached' THEN
      stat_value := CASE WHEN profile_rec.status_tier = 'legend' OR profile_rec.legend_pinned THEN 1 ELSE 0 END;

    WHEN 'apex_founding' THEN
      stat_value := CASE
        WHEN profile_rec.is_apex_subscriber = true
         AND profile_rec.apex_subscription_started_at IS NOT NULL THEN 1
        ELSE 0
      END;

    WHEN 'apex_held_days' THEN
      IF profile_rec.status_tier IN ('apex','legend')
         AND profile_rec.apex_subscription_started_at IS NOT NULL THEN
        stat_value := EXTRACT(EPOCH FROM (now() - profile_rec.apex_subscription_started_at)) / 86400;
      ELSE
        stat_value := 0;
      END IF;

    WHEN 'legend_held_days' THEN
      IF (profile_rec.status_tier = 'legend' OR profile_rec.legend_pinned)
         AND profile_rec.apex_subscription_started_at IS NOT NULL THEN
        stat_value := EXTRACT(EPOCH FROM (now() - profile_rec.apex_subscription_started_at)) / 86400;
      ELSE
        stat_value := 0;
      END IF;

    WHEN 'tribe_battles_won' THEN
      SELECT count(DISTINCT tb.id) INTO stat_value
      FROM tribe_battles tb
      JOIN tribe_members tm ON tm.tribe_id = tb.winner_tribe_id
      WHERE tb.status = 'completed'
        AND tb.winner_tribe_id IS NOT NULL
        AND tm.user_id = p_user_id
        AND tm.status = 'active';

    WHEN 'tribe_collective_streak' THEN
      SELECT COALESCE(MAX(min_streak), 0) INTO stat_value
      FROM (
        SELECT tm_outer.tribe_id,
               MIN(p.streak) AS min_streak
        FROM tribe_members tm_outer
        JOIN tribe_members tm_all ON tm_all.tribe_id = tm_outer.tribe_id AND tm_all.status = 'active'
        JOIN profiles p ON p.user_id = tm_all.user_id
        WHERE tm_outer.user_id = p_user_id AND tm_outer.status = 'active'
        GROUP BY tm_outer.tribe_id
      ) sub;

    WHEN 'tribe_founder_streak' THEN
      SELECT COALESCE(MAX(min_streak), 0) INTO stat_value
      FROM (
        SELECT t.id AS tribe_id,
               MIN(p.streak) AS min_streak
        FROM tribes t
        JOIN tribe_members tm ON tm.tribe_id = t.id AND tm.status = 'active'
        JOIN profiles p ON p.user_id = tm.user_id
        WHERE t.owner_id = p_user_id
        GROUP BY t.id
      ) sub;

    ELSE
      RETURN false;
  END CASE;

  IF stat_value >= badge_rec.requirement_value THEN
    INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, p_badge_id)
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;