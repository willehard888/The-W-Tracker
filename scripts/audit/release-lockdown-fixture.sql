CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''req.uid'', true), '''')::uuid';
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''req.role'', true), '''')';
CREATE TABLE cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
CREATE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE sql AS 'DELETE FROM cron.job WHERE jobname = $1; SELECT true';
CREATE FUNCTION cron.schedule(text, text, text) RETURNS bigint LANGUAGE sql AS 'INSERT INTO cron.job(jobname, schedule, command) VALUES ($1,$2,$3) RETURNING jobid';

CREATE TYPE status_tier AS ENUM ('recruit','operator','performer','high_performer','elite','apex','legend');
CREATE TYPE friendship_status AS ENUM ('pending','accepted','declined');

CREATE TABLE public.profiles (user_id uuid primary key, username text, avatar_url text, status_tier status_tier default 'recruit', streak int default 0, level int default 1, xp int default 0, rank_score numeric default 0);
CREATE TABLE public.friendships (id uuid primary key default gen_random_uuid(), requester_id uuid, addressee_id uuid, status friendship_status default 'pending', created_at timestamptz default now(), unique(requester_id, addressee_id));
CREATE TABLE public.blocked_users (blocker_id uuid, blocked_id uuid);
CREATE TABLE public.moderation_queue (id uuid primary key default gen_random_uuid(), content_type text, content_id uuid, user_id uuid, text_content text, ai_action text, ai_reason text, severity text, status text);
CREATE TABLE public.ai_usage (user_id uuid, day date, kind text, count int, primary key (user_id, day, kind));
CREATE TABLE public.deleted_account_archives (id uuid primary key default gen_random_uuid(), user_id uuid, archived_at timestamptz default now());
CREATE TABLE public.daily_checkins (id uuid primary key default gen_random_uuid(), user_id uuid, checked_in_at timestamptz default now());
CREATE TABLE public.health_sync_snapshots (id uuid primary key default gen_random_uuid(), user_id uuid, snapshot_date date, last_synced_at timestamptz);
CREATE TABLE public.battles (id uuid primary key default gen_random_uuid(), challenger_id uuid, opponent_id uuid, battle_type text, duration_days int, status text);
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_sync_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own checkins" ON public.daily_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own health snapshots" ON public.health_sync_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own health snapshots" ON public.health_sync_snapshots FOR UPDATE USING (auth.uid() = user_id);

CREATE FUNCTION public.debug_net_ping() RETURNS bigint LANGUAGE sql AS 'SELECT 1::bigint';
CREATE FUNCTION public.debug_net_result(p_id bigint) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
CREATE FUNCTION public.is_blocked(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT EXISTS (SELECT 1 FROM public.blocked_users WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a));
$f$;
CREATE FUNCTION public.are_friends(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.requester_id=a AND f.addressee_id=b) OR (f.requester_id=b AND f.addressee_id=a)));
$f$;
CREATE FUNCTION public.list_friends() RETURNS json LANGUAGE sql AS 'SELECT ''[]''::json';
CREATE FUNCTION public.list_friend_requests() RETURNS json LANGUAGE sql AS 'SELECT ''[]''::json';
CREATE FUNCTION public.list_sent_friend_requests() RETURNS json LANGUAGE sql AS 'SELECT ''[]''::json';
CREATE FUNCTION public.pending_friend_request_count() RETURNS integer LANGUAGE sql AS 'SELECT 0';
CREATE FUNCTION public.create_battle(p_opponent uuid, p_battle_type text, p_duration_days integer) RETURNS json LANGUAGE sql AS 'SELECT ''{}''::json';
CREATE FUNCTION public.get_user_rank(p_user_id uuid) RETURNS TABLE(rank int, total_users int, percentile numeric, has_rank boolean) LANGUAGE sql AS 'SELECT 1,1,0::numeric,false';
CREATE FUNCTION public.report_content(p_content_type text, p_content_id uuid, p_reported_user uuid, p_reason text DEFAULT NULL) RETURNS void LANGUAGE sql AS 'SELECT';
CREATE FUNCTION public.bump_ai_usage(p_limit integer, p_kind text DEFAULT 'coach') RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE uid uuid := auth.uid(); v_count int; v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  INSERT INTO ai_usage (user_id, day, kind, count) VALUES (uid, v_today, COALESCE(p_kind,'coach'), 1)
  ON CONFLICT (user_id, day, kind) DO UPDATE SET count = ai_usage.count + 1 RETURNING count INTO v_count;
  RETURN v_count <= GREATEST(1, p_limit);
END $f$;
CREATE ROLE anon; CREATE ROLE authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
