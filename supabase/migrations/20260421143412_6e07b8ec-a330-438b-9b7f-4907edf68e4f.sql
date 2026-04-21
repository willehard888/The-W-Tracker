-- 1) Trial: 9 -> 7 days
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_elite = true
        OR trial_started_at > now() - interval '7 days'
      )
  );
$function$;

-- 2) Stricter Elite criteria — add streak floors
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

  SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = target_user_id;

  IF percentile >= 99.9 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'legend';
  ELSIF percentile >= 99 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'apex';
  ELSIF percentile >= 95 AND activity_days >= 14 AND user_streak >= 30 THEN new_tier := 'elite';
  ELSIF percentile >= 90 AND activity_days >= 14 AND user_streak >= 14 THEN new_tier := 'high_performer';
  ELSIF percentile >= 75 AND activity_days >= 7 THEN new_tier := 'performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'operator';
  ELSE new_tier := 'recruit';
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

    SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = r.user_id;

    IF percentile >= 99.9 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'legend';
    ELSIF percentile >= 99 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'apex';
    ELSIF percentile >= 95 AND activity_days >= 14 AND user_streak >= 30 THEN new_tier := 'elite';
    ELSIF percentile >= 90 AND activity_days >= 14 AND user_streak >= 14 THEN new_tier := 'high_performer';
    ELSIF percentile >= 75 AND activity_days >= 7 THEN new_tier := 'performer';
    ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'operator';
    ELSE new_tier := 'recruit';
    END IF;

    UPDATE profiles SET status_tier = new_tier WHERE user_id = r.user_id;
  END LOOP;

  UPDATE profiles SET status_tier = 'recruit' WHERE rank_score = 0;
END;
$function$;

-- 3) Elite Feed posting: gate on earned status_tier OR active subscription (transitional)
DROP POLICY IF EXISTS "Elite users can post" ON public.feed_posts;
CREATE POLICY "Elite users can post"
ON public.feed_posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.status_tier IN ('elite','apex','legend')
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  )
);