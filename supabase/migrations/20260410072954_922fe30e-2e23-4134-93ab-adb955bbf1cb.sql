
-- Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rank_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_multiplier numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS rank_score_updated_at timestamptz NOT NULL DEFAULT now();

-- Rank score calculation
CREATE OR REPLACE FUNCTION public.calculate_rank_score(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  xp_score numeric := 0;
  streak_score numeric := 0;
  consistency_score numeric := 0;
  trust numeric := 1.0;
  total_score numeric;
  avg_xp_7d numeric;
  max_xp_7d numeric;
  completed_30 integer;
  current_streak integer;
  p_trust numeric;
BEGIN
  SELECT streak, profiles.trust_multiplier INTO current_streak, p_trust
  FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  trust := COALESCE(p_trust, 1.0);

  SELECT COALESCE(AVG(xp_earned), 0) INTO avg_xp_7d
  FROM daily_checkins
  WHERE user_id = p_user_id AND checked_in_at >= now() - interval '7 days';
  
  SELECT COALESCE(MAX(sub.avg_xp), 1) INTO max_xp_7d
  FROM (
    SELECT AVG(xp_earned) as avg_xp
    FROM daily_checkins
    WHERE checked_in_at >= now() - interval '7 days'
    GROUP BY user_id
  ) sub;
  
  xp_score := LEAST(100, (avg_xp_7d / GREATEST(max_xp_7d, 1)) * 100);
  streak_score := LEAST(100, 25 * ln(current_streak + 1));

  SELECT count(DISTINCT date(checked_in_at)) INTO completed_30
  FROM daily_checkins
  WHERE user_id = p_user_id AND checked_in_at >= now() - interval '30 days';
  
  consistency_score := (completed_30::numeric / 30.0) * 100;
  total_score := (0.25 * xp_score + 0.20 * streak_score + 0.55 * consistency_score) * trust;
  
  UPDATE profiles
  SET rank_score = ROUND(total_score, 2), rank_score_updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN ROUND(total_score, 2);
END;
$$;

-- Batch recalculate all tiers
CREATE OR REPLACE FUNCTION public.update_all_status_tiers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_users integer;
  r RECORD;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
BEGIN
  FOR r IN SELECT user_id FROM profiles LOOP
    PERFORM calculate_rank_score(r.user_id);
  END LOOP;

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN RETURN; END IF;

  FOR r IN
    SELECT user_id, rank_score, ROW_NUMBER() OVER (ORDER BY rank_score DESC) as rn
    FROM profiles WHERE rank_score > 0
  LOOP
    percentile := ((total_users - r.rn)::numeric / total_users::numeric) * 100;
    
    SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
    FROM daily_checkins
    WHERE user_id = r.user_id AND checked_in_at >= now() - interval '30 days';

    IF percentile >= 99.9 AND activity_days >= 30 THEN new_tier := 'legend';
    ELSIF percentile >= 99 AND activity_days >= 30 THEN new_tier := 'apex';
    ELSIF percentile >= 95 AND activity_days >= 14 THEN new_tier := 'elite';
    ELSIF percentile >= 90 AND activity_days >= 14 THEN new_tier := 'high_performer';
    ELSIF percentile >= 75 AND activity_days >= 7 THEN new_tier := 'performer';
    ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'operator';
    ELSE new_tier := 'recruit';
    END IF;

    UPDATE profiles SET status_tier = new_tier WHERE user_id = r.user_id;
  END LOOP;
  
  UPDATE profiles SET status_tier = 'recruit' WHERE rank_score = 0;
END;
$$;

-- Individual tier recalc
CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
BEGIN
  PERFORM calculate_rank_score(target_user_id);

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  SELECT count(*) INTO user_rank FROM profiles
  WHERE rank_score > (SELECT rank_score FROM profiles WHERE user_id = target_user_id);
  
  IF total_users <= 1 THEN percentile := 100;
  ELSE percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;
  END IF;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';
  
  IF percentile >= 99.9 AND activity_days >= 30 THEN new_tier := 'legend';
  ELSIF percentile >= 99 AND activity_days >= 30 THEN new_tier := 'apex';
  ELSIF percentile >= 95 AND activity_days >= 14 THEN new_tier := 'elite';
  ELSIF percentile >= 90 AND activity_days >= 14 THEN new_tier := 'high_performer';
  ELSIF percentile >= 75 AND activity_days >= 7 THEN new_tier := 'performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'operator';
  ELSE new_tier := 'recruit';
  END IF;
  
  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$$;

-- Migrate existing data
UPDATE profiles SET status_tier = 'recruit' WHERE status_tier = 'normal';
UPDATE profiles SET status_tier = 'operator' WHERE status_tier = 'rising';
