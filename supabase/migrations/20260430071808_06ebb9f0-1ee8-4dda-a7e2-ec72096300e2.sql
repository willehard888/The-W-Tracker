CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
  user_score numeric;
  is_pinned_legend boolean;
  is_apex_sub boolean;
  apex_credits timestamptz;
BEGIN
  SELECT legend_pinned, is_apex_subscriber, apex_credits_until
    INTO is_pinned_legend, is_apex_sub, apex_credits
    FROM profiles WHERE user_id = target_user_id;

  IF COALESCE(is_pinned_legend, false) THEN
    UPDATE profiles SET status_tier = 'legend' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  PERFORM calculate_rank_score(target_user_id);
  SELECT rank_score INTO user_score FROM profiles WHERE user_id = target_user_id;

  IF COALESCE(is_apex_sub, false) OR (apex_credits IS NOT NULL AND apex_credits > now()) THEN
    UPDATE profiles SET status_tier = 'apex' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  IF user_score IS NULL OR user_score <= 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT rn INTO user_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles WHERE rank_score > 0
  ) r WHERE r.user_id = target_user_id;

  percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';

  SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = target_user_id;

  IF percentile >= 99.9 AND activity_days >= 30 AND user_streak >= 30 THEN
    new_tier := 'legend';
  ELSIF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN
    new_tier := 'apex';
  ELSIF percentile >= 80 OR (activity_days >= 20 AND user_streak >= 21) THEN
    new_tier := 'elite';
  ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14) THEN
    new_tier := 'high_performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN
    new_tier := 'performer';
  ELSIF percentile >= 25 AND activity_days >= 5 THEN
    new_tier := 'operator';
  ELSE
    new_tier := 'recruit';
  END IF;

  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_all_status_tiers()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_users integer;
  r RECORD;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
BEGIN
  FOR r IN SELECT user_id FROM profiles LOOP
    PERFORM calculate_rank_score(r.user_id);
  END LOOP;

  UPDATE profiles SET status_tier = 'legend' WHERE legend_pinned = true;

  UPDATE profiles SET status_tier = 'apex'
  WHERE legend_pinned = false
    AND (
      is_apex_subscriber = true
      OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
    );

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles
      SET status_tier = 'recruit'
      WHERE rank_score = 0
        AND legend_pinned = false
        AND is_apex_subscriber = false
        AND (apex_credits_until IS NULL OR apex_credits_until <= now());
    RETURN;
  END IF;

  FOR r IN
    SELECT user_id, rank_score, ROW_NUMBER() OVER (ORDER BY rank_score DESC) as rn
    FROM profiles
    WHERE rank_score > 0
      AND legend_pinned = false
      AND is_apex_subscriber = false
      AND (apex_credits_until IS NULL OR apex_credits_until <= now())
  LOOP
    percentile := ((total_users - r.rn)::numeric / total_users::numeric) * 100;

    SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
    FROM daily_checkins
    WHERE user_id = r.user_id AND checked_in_at >= now() - interval '30 days';

    SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = r.user_id;

    IF percentile >= 99.9 AND activity_days >= 30 AND user_streak >= 30 THEN
      new_tier := 'legend';
    ELSIF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN
      new_tier := 'apex';
    ELSIF percentile >= 80 OR (activity_days >= 20 AND user_streak >= 21) THEN
      new_tier := 'elite';
    ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14) THEN
      new_tier := 'high_performer';
    ELSIF percentile >= 50 AND activity_days >= 7 THEN
      new_tier := 'performer';
    ELSIF percentile >= 25 AND activity_days >= 5 THEN
      new_tier := 'operator';
    ELSE
      new_tier := 'recruit';
    END IF;

    UPDATE profiles SET status_tier = new_tier WHERE user_id = r.user_id;
  END LOOP;

  UPDATE profiles
    SET status_tier = 'recruit'
    WHERE rank_score = 0
      AND legend_pinned = false
      AND is_apex_subscriber = false
      AND (apex_credits_until IS NULL OR apex_credits_until <= now());
END;
$function$;

SELECT public.update_all_status_tiers();