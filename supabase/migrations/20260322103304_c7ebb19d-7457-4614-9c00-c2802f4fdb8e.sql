
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
BEGIN
  SELECT count(*) INTO total_users FROM profiles;
  
  SELECT count(*) INTO user_rank
  FROM profiles
  WHERE xp > (SELECT xp FROM profiles WHERE user_id = target_user_id);
  
  IF total_users <= 1 THEN
    percentile := 100;
  ELSE
    percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;
  END IF;
  
  IF percentile >= 99 THEN
    new_tier := 'elite';
  ELSIF percentile >= 90 THEN
    new_tier := 'high_performer';
  ELSIF percentile >= 50 THEN
    new_tier := 'rising';
  ELSE
    new_tier := 'normal';
  END IF;
  
  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$$;
