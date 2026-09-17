-- LOCAL DRY RUNS ONLY. Minimal stand-ins for the objects the audit lockdown
-- migration (20260919100000) touches, on top of scripts/nutrition/local-stubs.sql:
--   psql -h /tmp -p 5499 -U postgres -c 'DROP DATABASE IF EXISTS wf_audit' -c 'CREATE DATABASE wf_audit'
--   for f in scripts/nutrition/local-stubs.sql scripts/audit/lockdown-fixture.sql \
--            supabase/migrations/20260919100000_audit_lockdown.sql scripts/audit/lockdown-check.sql; do
--     psql -h /tmp -p 5499 -U postgres -d wf_audit -v ON_ERROR_STOP=1 -q -f "" || break; done
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.status_tier AS ENUM ('recruit', 'operator', 'elite', 'apex', 'legend');
CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
DROP FUNCTION IF EXISTS public.has_role(uuid, text);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE TABLE public.active_members (user_id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM active_members WHERE user_id = _user_id) $$;

-- profiles and daily_checkins come from the shared stubs; add what these functions read.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legend_pinned boolean, ADD COLUMN IF NOT EXISTS status_tier public.status_tier,
  ADD COLUMN IF NOT EXISTS tier_division smallint;
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS verified_at timestamptz, ADD COLUMN IF NOT EXISTS checked_in_at timestamptz DEFAULT now();
CREATE TABLE public.feed_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, content text, image_url text, video_url text,
  moderation_status text DEFAULT 'pending', reported boolean DEFAULT false);
CREATE TABLE public.tribe_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tribe_id uuid, user_id uuid, content text, image_url text, video_url text,
  moderation_status text DEFAULT 'pending', reported boolean DEFAULT false);
CREATE TABLE public.tribe_members (id uuid DEFAULT gen_random_uuid(), tribe_id uuid, user_id uuid, role text, status text, joined_at timestamptz);
CREATE TABLE public.battles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenger_id uuid, opponent_id uuid, challenger_proof_url text, opponent_proof_url text);
CREATE TABLE public.coach_programs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, status text NOT NULL DEFAULT 'active', plan_json jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.workout_set_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, program_id uuid, week int, day_index int,
  exercise_slug text, exercise_name text, weight numeric, reps int, rpe numeric, set_index int DEFAULT 1,
  logged_on date DEFAULT ((now() AT TIME ZONE 'utc'))::date, updated_at timestamptz DEFAULT now());

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tribe_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON public.feed_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own posts" ON public.feed_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any post" ON public.feed_posts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read" ON public.tribe_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own tribe post" ON public.tribe_posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own programs" ON public.coach_programs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own programs" ON public.coach_programs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can view proof photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'proof-photos');

-- The functions as they are live today (pg_get_functiondef, 2026-09-17).
CREATE FUNCTION public.get_active_coach_program(_user_id uuid) RETURNS SETOF public.coach_programs
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT * FROM public.coach_programs WHERE user_id = _user_id AND status = 'active' $$;
CREATE FUNCTION public.dispatch_social_push(p_kind text, p_user uuid, p_actor uuid, p_ref uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NULL; END $$;
CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_users integer; user_rank integer; percentile numeric; new_tier status_tier;
  activity_days integer; user_streak integer; user_score numeric;
  v_division smallint; band_lo numeric; band_hi numeric; v_frac numeric;
BEGIN
  -- Founder-Legend-ohitus: legend_pinned asetetaan VAIN käsin (ei maksusta/suosittelusta).
  IF (SELECT COALESCE(legend_pinned, false) FROM profiles WHERE user_id = target_user_id) THEN
    UPDATE profiles SET status_tier = 'legend', tier_division = 0 WHERE user_id = target_user_id; RETURN;
  END IF;

  PERFORM calculate_rank_score(target_user_id);
  SELECT rank_score INTO user_score FROM profiles WHERE user_id = target_user_id;
  IF user_score IS NULL OR user_score <= 0 THEN
    UPDATE profiles SET status_tier = 'recruit', tier_division = 0 WHERE user_id = target_user_id; RETURN;
  END IF;

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles SET status_tier = 'recruit', tier_division = 0 WHERE user_id = target_user_id; RETURN;
  END IF;

  SELECT rn INTO user_rank FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles WHERE rank_score > 0
  ) r WHERE r.user_id = target_user_id;

  percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';
  SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = target_user_id;

  IF    percentile >= 99 AND activity_days >= 30 AND user_streak >= 45 THEN new_tier := 'legend';
  ELSIF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'apex';
  ELSIF percentile >= 80 OR (user_streak >= 30 AND activity_days >= 20)  THEN new_tier := 'elite';
  ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14)  THEN new_tier := 'high_performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'performer';
  ELSIF percentile >= 25 AND activity_days >= 5 THEN new_tier := 'operator';
  ELSE new_tier := 'recruit';
  END IF;

  IF new_tier IN ('recruit', 'legend') THEN
    v_division := 0;
  ELSE
    band_lo := CASE new_tier WHEN 'operator' THEN 25 WHEN 'performer' THEN 50 WHEN 'high_performer' THEN 70
      WHEN 'elite' THEN 80 WHEN 'apex' THEN 90 ELSE 0 END;
    band_hi := CASE new_tier WHEN 'operator' THEN 50 WHEN 'performer' THEN 70 WHEN 'high_performer' THEN 80
      WHEN 'elite' THEN 90 WHEN 'apex' THEN 99 ELSE 100 END;
    v_frac := (percentile - band_lo) / NULLIF(band_hi - band_lo, 0);
    v_frac := LEAST(0.999, GREATEST(0, COALESCE(v_frac, 0)));
    v_division := 1 + floor(v_frac * 3)::int;
  END IF;

  UPDATE profiles SET status_tier = new_tier, tier_division = v_division WHERE user_id = target_user_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.calculate_rank_score(p_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.user_verified_performer_stats(_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'window_days', 14, 'total_checkins', count(*),
    'verified_count', count(*) FILTER (WHERE verified_at IS NOT NULL),
    'verified_pct', CASE WHEN count(*) = 0 THEN 0 ELSE round((count(*) FILTER (WHERE verified_at IS NOT NULL))::numeric * 100 / count(*)) END,
    'is_verified_performer', count(*) >= 7 AND (count(*) FILTER (WHERE verified_at IS NOT NULL))::numeric / GREATEST(count(*), 1) >= 0.70
  ) FROM public.daily_checkins WHERE user_id = _user_id AND checked_in_at >= now() - INTERVAL '14 days';
$function$;
CREATE OR REPLACE FUNCTION public.log_workout_set(p_program uuid, p_week integer, p_day integer, p_slug text, p_name text, p_weight numeric, p_reps integer, p_rpe numeric DEFAULT NULL::numeric, p_set_index integer DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); v_id uuid; v_set int := GREATEST(1, LEAST(COALESCE(p_set_index, 1), 50));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF length(trim(coalesce(p_name,''))) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;

  IF p_program IS NOT NULL AND p_slug IS NOT NULL THEN
    UPDATE workout_set_logs
       SET weight = p_weight, reps = p_reps, rpe = p_rpe,
           exercise_name = COALESCE(p_name, exercise_name),
           logged_on = (now() AT TIME ZONE 'utc')::date, updated_at = now()
     WHERE user_id = uid AND program_id = p_program AND week = p_week
       AND day_index = p_day AND exercise_slug = p_slug AND set_index = v_set
     RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  INSERT INTO workout_set_logs
    (user_id, program_id, week, day_index, exercise_slug, exercise_name, weight, reps, rpe, set_index)
    VALUES (uid, p_program, p_week, p_day, p_slug, p_name, p_weight, p_reps, p_rpe, v_set)
    RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;
