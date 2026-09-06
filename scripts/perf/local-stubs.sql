-- ============================================================
-- LOCAL DRY RUNS ONLY — never run this against a Supabase project.
--
-- Stand-ins for the tables/columns 20260907100000_perf_rpcs.sql reads that
-- scripts/nutrition/local-stubs.sql does not already provide. Column types are
-- copied from the original migrations; only the columns the two RPCs touch.
-- SELECT policies mirror prod (own-row on private tables, USING (true) on
-- profiles / leaderboard_season_baselines) so SECURITY INVOKER is exercised
-- for real. Write policies are omitted — the check script seeds as postgres.
--
-- Run AFTER scripts/nutrition/local-stubs.sql + the 2026090[56]* migrations:
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -q -f scripts/perf/local-stubs.sql
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -q -f supabase/migrations/20260907100000_perf_rpcs.sql
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -q -f scripts/perf/rpc-check.sql
-- ============================================================

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE public.status_tier AS ENUM ('normal','rising','high_performer','elite','recruit','operator','performer','apex','legend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.friendship_status AS ENUM ('pending','accepted','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.leaderboard_season_status AS ENUM ('active','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- profiles (nutrition stub has user_id/xp/level only) ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_tier public.status_tier NOT NULL DEFAULT 'normal';
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- ---------- daily_checkins ----------
ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS healthy_food boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hydration_liters numeric(3,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_phone_morning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_phone_evening boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS journal_entry text,
  ADD COLUMN IF NOT EXISTS habits jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own checkins" ON public.daily_checkins;
CREATE POLICY "Users can view own checkins" ON public.daily_checkins FOR SELECT USING (auth.uid() = user_id);

-- ---------- health_sync_snapshots ----------
ALTER TABLE public.health_sync_snapshots ADD COLUMN IF NOT EXISTS active_kcal int;
ALTER TABLE public.health_sync_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own health snapshots" ON public.health_sync_snapshots;
CREATE POLICY "Users can view own health snapshots" ON public.health_sync_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- health_night_metrics ----------
CREATE TABLE IF NOT EXISTS public.health_night_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  night_date date NOT NULL,
  resting_hr numeric, hrv_sdnn numeric, respiratory_rate numeric,
  sleep_total_min int, sleep_deep_min int, sleep_rem_min int,
  sleep_start timestamptz,
  UNIQUE (user_id, night_date)
);
ALTER TABLE public.health_night_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "night_metrics own select" ON public.health_night_metrics;
CREATE POLICY "night_metrics own select" ON public.health_night_metrics FOR SELECT USING (auth.uid() = user_id);

-- ---------- coach_reflections ----------
CREATE TABLE IF NOT EXISTS public.coach_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reflection_date date NOT NULL,
  energy_1to5 int NOT NULL CHECK (energy_1to5 BETWEEN 1 AND 5),
  mood_1to5 int CHECK (mood_1to5 BETWEEN 1 AND 5),
  win text, friction text,
  UNIQUE (user_id, reflection_date)
);
ALTER TABLE public.coach_reflections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own reflections" ON public.coach_reflections;
CREATE POLICY "Users view own reflections" ON public.coach_reflections FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- vault (articles gated by has_active_access — stubbed to true by the nutrition stubs) ----------
CREATE TABLE IF NOT EXISTS public.vault_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL
);
ALTER TABLE public.vault_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members and trialists can read vault articles" ON public.vault_articles;
CREATE POLICY "Members and trialists can read vault articles" ON public.vault_articles FOR SELECT TO authenticated USING (has_active_access(auth.uid()));

CREATE TABLE IF NOT EXISTS public.vault_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES public.vault_articles(id) ON DELETE CASCADE,
  quiz_score int,
  UNIQUE (user_id, article_id)
);
ALTER TABLE public.vault_lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own lesson progress" ON public.vault_lesson_progress;
CREATE POLICY "Users read own lesson progress" ON public.vault_lesson_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- workout_set_logs (no coach_programs FK locally) ----------
CREATE TABLE IF NOT EXISTS public.workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_slug text,
  exercise_name text NOT NULL,
  weight numeric, reps int,
  logged_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_set_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workout_set_logs own select" ON public.workout_set_logs;
CREATE POLICY "workout_set_logs own select" ON public.workout_set_logs FOR SELECT USING (auth.uid() = user_id);

-- ---------- tribes / tribe_members ----------
CREATE TABLE IF NOT EXISTS public.tribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  visibility text NOT NULL DEFAULT 'public'
);
CREATE TABLE IF NOT EXISTS public.tribe_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','banned')),
  UNIQUE (tribe_id, user_id)
);
CREATE OR REPLACE FUNCTION public.is_tribe_member(_tribe_id uuid, _user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tribe_members WHERE tribe_id = _tribe_id AND user_id = _user_id AND status = 'active')
$$;
ALTER TABLE public.tribe_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members rows visible to authed" ON public.tribe_members;
CREATE POLICY "Members rows visible to authed" ON public.tribe_members FOR SELECT TO authenticated
USING (
  is_tribe_member(tribe_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.tribes t WHERE t.id = tribe_id AND t.visibility = 'public')
  OR user_id = auth.uid()
);

-- ---------- friendships ----------
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  UNIQUE (requester_id, addressee_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ---------- coach_athlete_profile ----------
CREATE TABLE IF NOT EXISTS public.coach_athlete_profile (
  user_id uuid PRIMARY KEY,
  i_am text
);
ALTER TABLE public.coach_athlete_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own athlete profile" ON public.coach_athlete_profile;
CREATE POLICY "Users view own athlete profile" ON public.coach_athlete_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- leaderboard seasons + baselines ----------
CREATE TABLE IF NOT EXISTS public.leaderboard_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.leaderboard_season_status NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS public.leaderboard_season_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  baseline_xp int NOT NULL DEFAULT 0,
  UNIQUE (season_id, user_id)
);
ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_season_baselines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leaderboard seasons viewable by everyone" ON public.leaderboard_seasons;
CREATE POLICY "Leaderboard seasons viewable by everyone" ON public.leaderboard_seasons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Leaderboard baselines viewable by everyone" ON public.leaderboard_season_baselines;
CREATE POLICY "Leaderboard baselines viewable by everyone" ON public.leaderboard_season_baselines FOR SELECT USING (true);

-- Supabase's default grants (mirrored by the nutrition stubs via ALTER DEFAULT
-- PRIVILEGES) apply to tables created after that statement — these are, but
-- make it explicit for the pre-existing ones we only altered.
GRANT SELECT ON public.profiles, public.daily_checkins, public.health_sync_snapshots TO anon, authenticated;
