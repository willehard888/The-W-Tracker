-- ============================================================
-- Audit lockdown (2026-09-17). Every item was verified against the live
-- catalog before it was written.
--
-- Lesson that produced half of this file: Supabase's default privileges
-- grant EXECUTE on every new public function to anon AND authenticated, and
-- a SECURITY DEFINER function runs as its owner, past RLS and past the
-- profile column guard. A definer function that takes a user id must either
-- check it against auth.uid() or not be callable by clients at all.
-- ============================================================

-- ---------- 1. Definer functions clients never need ----------
-- get_active_coach_program(uuid) returned ANY member's program (goal,
-- injuries in constraints, the whole plan) to anyone holding the anon key.
-- No client or edge function calls it.
REVOKE ALL ON FUNCTION public.get_active_coach_program(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_coach_program(uuid) TO service_role;

-- dispatch_social_push sent a push to any member, as any actor, for anyone
-- holding the anon key. Its only callers are definer triggers and the cron
-- resolver, which run as the owner and keep working.
REVOKE ALL ON FUNCTION public.dispatch_social_push(text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_social_push(text, uuid, uuid, uuid) TO service_role;

-- ---------- 2. Definer functions a member may call for themselves ----------
-- The app refreshes the member's own tier after a check-in (builds in the
-- field do too), so these stay callable, guarded. Bodies are the live ones.
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
  -- Callable by members for THEMSELVES only. Triggers (a battle settling the
  -- opponent's tier), cron and the service role pass: inside SECURITY DEFINER
  -- current_user is the owner, so the caller is read from the JWT role.
  IF pg_trigger_depth() = 0 AND auth.role() IN ('anon', 'authenticated') AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
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
  -- Callable by members for THEMSELVES only. Triggers (a battle settling the
  -- opponent's tier), cron and the service role pass: inside SECURITY DEFINER
  -- current_user is the owner, so the caller is read from the JWT role.
  IF pg_trigger_depth() = 0 AND auth.role() IN ('anon', 'authenticated') AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
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

REVOKE ALL ON FUNCTION public.update_status_tier(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calculate_rank_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_status_tier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_rank_score(uuid) TO authenticated, service_role;

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
  ) FROM public.daily_checkins WHERE user_id = _user_id AND checked_in_at >= now() - INTERVAL '14 days'
    -- a member reads their own; the service role reads anyone's
    AND (_user_id = auth.uid() OR COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated'));
$function$;

REVOKE ALL ON FUNCTION public.user_verified_performer_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_verified_performer_stats(uuid) TO authenticated, service_role;

-- ---------- 3. An author cannot approve their own blocked post ----------
-- "Users can update own posts" lets an author write every column, and the
-- only moderation trigger fires AFTER INSERT. Keep the two moderation
-- columns where they were for anyone who is not an admin; a caption edit
-- still saves. Not SECURITY DEFINER on purpose: current_user must be the
-- caller's role here. The report triggers and the moderator run as the owner
-- or the service role and pass.
CREATE OR REPLACE FUNCTION public.tg_protect_moderation_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.moderation_status := OLD.moderation_status;
    NEW.reported := OLD.reported;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS feed_posts_protect_moderation ON public.feed_posts;
CREATE TRIGGER feed_posts_protect_moderation BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_moderation_columns();
DROP TRIGGER IF EXISTS tribe_posts_protect_moderation ON public.tribe_posts;
CREATE TRIGGER tribe_posts_protect_moderation BEFORE UPDATE ON public.tribe_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_moderation_columns();

-- ---------- 4. Proof photos are private unless shared ----------
-- The old policy let every signed-in member list and sign every other
-- member's check-in photos. Now: the owner, an admin, or someone the photo
-- was actually shown to (an approved feed post, a post in a tribe they
-- belong to, a battle they are in). Stored values end in
-- '/proof-photos/<object name>'.
-- ponytail: a scan of three small tables per signed URL; add a path column
-- with an index if the feed grows past a few thousand posts.
CREATE OR REPLACE FUNCTION public.proof_photo_shared_with(p_name text, p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
      SELECT 1 FROM feed_posts f
       WHERE f.moderation_status = 'approved'
         AND strpos(COALESCE(f.image_url, ''), '/proof-photos/' || p_name) > 0)
    OR EXISTS (
      SELECT 1 FROM tribe_posts t
        JOIN tribe_members m ON m.tribe_id = t.tribe_id AND m.user_id = p_uid AND m.status = 'active'
       WHERE t.moderation_status = 'approved'
         AND strpos(COALESCE(t.image_url, ''), '/proof-photos/' || p_name) > 0)
    OR EXISTS (
      SELECT 1 FROM battles b
       WHERE p_uid IN (b.challenger_id, b.opponent_id)
         AND (strpos(COALESCE(b.challenger_proof_url, ''), '/proof-photos/' || p_name) > 0
           OR strpos(COALESCE(b.opponent_proof_url, ''), '/proof-photos/' || p_name) > 0))
$$;
REVOKE ALL ON FUNCTION public.proof_photo_shared_with(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proof_photo_shared_with(text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members can view proof photos" ON storage.objects;
DROP POLICY IF EXISTS "Proof photos: owner, admin or shared with" ON storage.objects;
CREATE POLICY "Proof photos: owner, admin or shared with" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'proof-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
      OR public.proof_photo_shared_with(name, auth.uid())
    )
  );

-- ---------- 5. coach_programs: the edit path is a member feature ----------
-- INSERT was gated on has_active_access; UPDATE was not, and the client now
-- writes plan_json and status directly, so a lapsed account could flip an
-- old row back to active and keep building forever. plan_json strings reach
-- the coach's prompts, so it is bounded too (largest live plan: 13 kB).
DROP POLICY IF EXISTS "Users can update own programs" ON public.coach_programs;
CREATE POLICY "Users can update own programs" ON public.coach_programs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.has_active_access(auth.uid()));

ALTER TABLE public.coach_programs DROP CONSTRAINT IF EXISTS coach_programs_status_known;
ALTER TABLE public.coach_programs ADD CONSTRAINT coach_programs_status_known
  CHECK (status IN ('active', 'superseded', 'archived', 'session'));
ALTER TABLE public.coach_programs DROP CONSTRAINT IF EXISTS coach_programs_plan_size;
ALTER TABLE public.coach_programs ADD CONSTRAINT coach_programs_plan_size
  CHECK (pg_column_size(plan_json) < 262144);

-- ---------- 6. A logged set belongs to the athlete's own day ----------
-- logged_on was the UTC date: after midnight in Helsinki a set was dated
-- yesterday (today's sets became their own "previous best", so PRs never
-- fired), and an evening session west of UTC was dated tomorrow (dropped from
-- the balance read). The app now sends its local day; the server accepts it
-- within a day of its own. Dropped first: a second overload would make
-- PostgREST refuse the old nine-argument call as ambiguous.
DROP FUNCTION IF EXISTS public.log_workout_set(uuid, int, int, text, text, numeric, int, numeric, int);
CREATE OR REPLACE FUNCTION public.log_workout_set(
  p_program uuid, p_week integer, p_day integer, p_slug text, p_name text,
  p_weight numeric, p_reps integer, p_rpe numeric DEFAULT NULL, p_set_index integer DEFAULT 1,
  p_logged_on date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v_id uuid;
  v_set int := GREATEST(1, LEAST(COALESCE(p_set_index, 1), 50));
  v_day date := CASE WHEN p_logged_on IS NOT NULL AND abs(p_logged_on - (now() AT TIME ZONE 'utc')::date) <= 1
                     THEN p_logged_on ELSE (now() AT TIME ZONE 'utc')::date END;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF length(trim(coalesce(p_name,''))) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;

  IF p_program IS NOT NULL AND p_slug IS NOT NULL THEN
    UPDATE workout_set_logs
       SET weight = p_weight, reps = p_reps, rpe = p_rpe,
           exercise_name = COALESCE(p_name, exercise_name),
           logged_on = v_day, updated_at = now()
     WHERE user_id = uid AND program_id = p_program AND week = p_week
       AND day_index = p_day AND exercise_slug = p_slug AND set_index = v_set
     RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  INSERT INTO workout_set_logs
    (user_id, program_id, week, day_index, exercise_slug, exercise_name, weight, reps, rpe, set_index, logged_on)
    VALUES (uid, p_program, p_week, p_day, p_slug, p_name, p_weight, p_reps, p_rpe, v_set, v_day)
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.log_workout_set(uuid, int, int, text, text, numeric, int, numeric, int, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_workout_set(uuid, int, int, text, text, numeric, int, numeric, int, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
