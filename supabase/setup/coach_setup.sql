-- ============================================================================
--  W TRACKER  ·  AI COACH BACKEND SETUP (idempotent, single-paste)
-- ============================================================================
--  Paste this entire file into Supabase → SQL Editor → "New query" and Run.
--  Safe to run multiple times — every object uses IF NOT EXISTS / OR REPLACE /
--  DROP IF EXISTS guards, and ALTER TABLE additions are guarded too.
--
--  What it creates (16 objects + 11 RPCs):
--    Tables:
--      coach_athlete_profile, coach_preference_signals, coach_chat_memory,
--      coach_goals, coach_programs, coach_program_logs,
--      coach_daily_plans, coach_mission_logs,
--      coach_reflections, coach_weekly_reviews, coach_performance_snapshots,
--      coach_life_os_briefs, weekly_briefings, coach_nudges,
--      user_habits, user_habit_logs
--    RPCs:
--      upsert_athlete_profile, get_active_coach_program,
--      complete_coach_mission, upsert_daily_plan,
--      log_habit, add_user_habit,
--      log_preference_signal, add_chat_memory, delete_chat_memory,
--      upsert_goal, update_goal_progress,
--      upsert_reflection, upsert_weekly_review, upsert_performance_snapshot,
--      append_chat_memory_batch,
--      enforce_chat_memory_cap (trigger fn)
--
--  Prerequisites already present in your DB (created by earlier non-coach
--  migrations): public.profiles, public.has_premium(uuid),
--  public.update_updated_at_column(). We add tiny safety stubs below in case
--  they aren't present yet.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Safety stubs for shared helpers (no-ops if they already exist)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE $f$
      CREATE FUNCTION public.update_updated_at_column()
      RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN NEW.updated_at = now(); RETURN NEW; END;
      $body$;
    $f$;
  END IF;

  -- Fallback has_premium: returns false. Replace once your billing layer
  -- defines the real function. Avoids policy creation errors on fresh DBs.
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_premium' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE $f$
      CREATE FUNCTION public.has_premium(_uid uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $body$
        SELECT false;
      $body$;
    $f$;
  END IF;
END $$;


-- ============================================================================
-- A. coach_athlete_profile  (+ holistic columns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_athlete_profile (
  user_id uuid PRIMARY KEY,
  age int CHECK (age IS NULL OR (age BETWEEN 13 AND 120)),
  sex text CHECK (sex IN ('male','female','other','prefer_not_say')),
  height_cm numeric CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 260)),
  weight_kg numeric CHECK (weight_kg IS NULL OR (weight_kg BETWEEN 30 AND 300)),
  body_fat_pct numeric CHECK (body_fat_pct IS NULL OR (body_fat_pct BETWEEN 3 AND 60)),
  primary_goal text,
  secondary_goal text,
  target_horizon_weeks int CHECK (target_horizon_weeks IS NULL OR (target_horizon_weeks BETWEEN 1 AND 104)),
  timezone text NOT NULL DEFAULT 'UTC',
  wake_time time NOT NULL DEFAULT '07:00',
  sleep_time time NOT NULL DEFAULT '23:00',
  training_days_pref int[] NOT NULL DEFAULT '{1,2,4,5}'::int[],
  busy_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  injuries text[] NOT NULL DEFAULT '{}',
  dietary text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  no_go_protocols text[] NOT NULL DEFAULT '{}',
  language_pref text NOT NULL DEFAULT 'en',
  tone_pref text NOT NULL DEFAULT 'calm_mentor'
    CHECK (tone_pref IN ('drill_sergeant','calm_mentor','scientist','hype')),
  preferred_session_length_min int NOT NULL DEFAULT 45
    CHECK (preferred_session_length_min BETWEEN 10 AND 240),
  i_am text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Holistic columns
ALTER TABLE public.coach_athlete_profile
  ADD COLUMN IF NOT EXISTS hobbies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS life_context text,
  ADD COLUMN IF NOT EXISTS stress_baseline int
    CHECK (stress_baseline IS NULL OR stress_baseline BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS mood_baseline int
    CHECK (mood_baseline IS NULL OR mood_baseline BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS mental_health_focus text[] NOT NULL DEFAULT '{}';

-- Refresh goal CHECKs to include 'all' + 'focus'
ALTER TABLE public.coach_athlete_profile DROP CONSTRAINT IF EXISTS coach_athlete_profile_primary_goal_check;
ALTER TABLE public.coach_athlete_profile DROP CONSTRAINT IF EXISTS coach_athlete_profile_secondary_goal_check;
ALTER TABLE public.coach_athlete_profile ADD CONSTRAINT coach_athlete_profile_primary_goal_check
  CHECK (primary_goal IS NULL OR primary_goal = ANY (ARRAY['all','strength','hypertrophy','endurance','fat_loss','longevity','focus']));
ALTER TABLE public.coach_athlete_profile ADD CONSTRAINT coach_athlete_profile_secondary_goal_check
  CHECK (secondary_goal IS NULL OR secondary_goal = ANY (ARRAY['all','strength','hypertrophy','endurance','fat_loss','longevity','focus']));

ALTER TABLE public.coach_athlete_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own athlete profile"   ON public.coach_athlete_profile;
DROP POLICY IF EXISTS "Users insert own athlete profile" ON public.coach_athlete_profile;
DROP POLICY IF EXISTS "Users update own athlete profile" ON public.coach_athlete_profile;
DROP POLICY IF EXISTS "Users delete own athlete profile" ON public.coach_athlete_profile;

CREATE POLICY "Users view own athlete profile"
  ON public.coach_athlete_profile FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own athlete profile"
  ON public.coach_athlete_profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own athlete profile"
  ON public.coach_athlete_profile FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own athlete profile"
  ON public.coach_athlete_profile FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS coach_athlete_profile_set_updated_at ON public.coach_athlete_profile;
CREATE TRIGGER coach_athlete_profile_set_updated_at
  BEFORE UPDATE ON public.coach_athlete_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- B. coach_preference_signals
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_preference_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN (
    'skipped_protocol','completed_protocol','tone_feedback',
    'language_used','preferred_time_of_day','manual_blacklist','manual_whitelist'
  )),
  protocol_id text,
  value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pref_signals_user_type
  ON public.coach_preference_signals(user_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pref_signals_user_protocol
  ON public.coach_preference_signals(user_id, protocol_id) WHERE protocol_id IS NOT NULL;

ALTER TABLE public.coach_preference_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own preference signals"   ON public.coach_preference_signals;
DROP POLICY IF EXISTS "Users insert own preference signals" ON public.coach_preference_signals;

CREATE POLICY "Users view own preference signals"
  ON public.coach_preference_signals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own preference signals"
  ON public.coach_preference_signals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- C. coach_chat_memory
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_chat_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fact text NOT NULL CHECK (length(fact) BETWEEN 3 AND 280),
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat','reflection','manual','system','chat-extract')),
  confidence numeric NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_memory_user
  ON public.coach_chat_memory(user_id, created_at DESC);

ALTER TABLE public.coach_chat_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own chat memory"   ON public.coach_chat_memory;
DROP POLICY IF EXISTS "Users insert own chat memory" ON public.coach_chat_memory;
DROP POLICY IF EXISTS "Users delete own chat memory" ON public.coach_chat_memory;

CREATE POLICY "Users view own chat memory"
  ON public.coach_chat_memory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chat memory"
  ON public.coach_chat_memory FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own chat memory"
  ON public.coach_chat_memory FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_chat_memory_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.coach_chat_memory
  WHERE id IN (
    SELECT id FROM public.coach_chat_memory
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 30
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_chat_memory_cap ON public.coach_chat_memory;
CREATE TRIGGER coach_chat_memory_cap
  AFTER INSERT ON public.coach_chat_memory
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_memory_cap();


-- ============================================================================
-- D. coach_goals
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 2 AND 100),
  metric text NOT NULL,
  unit text NOT NULL DEFAULT '',
  baseline_value numeric,
  current_value numeric,
  target_value numeric NOT NULL,
  deadline date,
  weekly_milestone numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','achieved','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_goals_user_status
  ON public.coach_goals(user_id, status);

ALTER TABLE public.coach_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own goals"   ON public.coach_goals;
DROP POLICY IF EXISTS "Users insert own goals" ON public.coach_goals;
DROP POLICY IF EXISTS "Users update own goals" ON public.coach_goals;
DROP POLICY IF EXISTS "Users delete own goals" ON public.coach_goals;

CREATE POLICY "Users view own goals"   ON public.coach_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own goals" ON public.coach_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goals" ON public.coach_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own goals" ON public.coach_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS coach_goals_set_updated_at ON public.coach_goals;
CREATE TRIGGER coach_goals_set_updated_at
  BEFORE UPDATE ON public.coach_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- E. coach_programs + coach_program_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  goal text NOT NULL,
  experience text NOT NULL,
  days_per_week int NOT NULL DEFAULT 4,
  equipment text,
  body_focus text[] NOT NULL DEFAULT '{}',
  constraints text,
  weeks int NOT NULL DEFAULT 4,
  plan_json jsonb NOT NULL,
  ai_summary text,
  generated_with text NOT NULL DEFAULT 'openai/gpt-5',
  started_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_programs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_coach_programs_user_active
  ON public.coach_programs (user_id, status, created_at DESC);

DROP POLICY IF EXISTS "Premium users can create own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Users can view own programs"           ON public.coach_programs;
DROP POLICY IF EXISTS "Users can update own programs"         ON public.coach_programs;
DROP POLICY IF EXISTS "Users can delete own programs"         ON public.coach_programs;

CREATE POLICY "Premium users can create own programs"
  ON public.coach_programs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_premium(auth.uid()));
CREATE POLICY "Users can view own programs"
  ON public.coach_programs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own programs"
  ON public.coach_programs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own programs"
  ON public.coach_programs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_coach_programs_updated_at ON public.coach_programs;
CREATE TRIGGER trg_coach_programs_updated_at
  BEFORE UPDATE ON public.coach_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.coach_program_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES public.coach_programs(id) ON DELETE CASCADE,
  week int NOT NULL,
  day_index int NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  completed boolean NOT NULL DEFAULT true,
  perceived_rpe int CHECK (perceived_rpe BETWEEN 1 AND 10),
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, week, day_index)
);

ALTER TABLE public.coach_program_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_coach_program_logs_user
  ON public.coach_program_logs (user_id, logged_at DESC);

DROP POLICY IF EXISTS "Users can view own logs"          ON public.coach_program_logs;
DROP POLICY IF EXISTS "Premium users can insert own logs" ON public.coach_program_logs;
DROP POLICY IF EXISTS "Users can delete own logs"        ON public.coach_program_logs;

CREATE POLICY "Users can view own logs"
  ON public.coach_program_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Premium users can insert own logs"
  ON public.coach_program_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_premium(auth.uid()));
CREATE POLICY "Users can delete own logs"
  ON public.coach_program_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- F. coach_daily_plans + coach_mission_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_date date NOT NULL,
  readiness_score integer NOT NULL DEFAULT 70,
  readiness_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  adjustment text NOT NULL DEFAULT 'hold',
  headline text,
  missions jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_with text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

ALTER TABLE public.coach_daily_plans
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS framework_version text NOT NULL DEFAULT '1.0';

CREATE INDEX IF NOT EXISTS idx_coach_daily_plans_user_date
  ON public.coach_daily_plans(user_id, plan_date DESC);

ALTER TABLE public.coach_daily_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily plans"   ON public.coach_daily_plans;
DROP POLICY IF EXISTS "No direct daily plan insert"      ON public.coach_daily_plans;
DROP POLICY IF EXISTS "No direct daily plan update"      ON public.coach_daily_plans;
DROP POLICY IF EXISTS "Users can delete own daily plans" ON public.coach_daily_plans;

CREATE POLICY "Users can view own daily plans"
  ON public.coach_daily_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "No direct daily plan insert"
  ON public.coach_daily_plans FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY "No direct daily plan update"
  ON public.coach_daily_plans FOR UPDATE TO authenticated
  USING (false);
CREATE POLICY "Users can delete own daily plans"
  ON public.coach_daily_plans FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_coach_daily_plans_updated_at ON public.coach_daily_plans;
CREATE TRIGGER update_coach_daily_plans_updated_at
  BEFORE UPDATE ON public.coach_daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.coach_mission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  daily_plan_id uuid NOT NULL REFERENCES public.coach_daily_plans(id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (daily_plan_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_mission_logs_user
  ON public.coach_mission_logs(user_id, completed_at DESC);

ALTER TABLE public.coach_mission_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own mission logs"  ON public.coach_mission_logs;
DROP POLICY IF EXISTS "No direct mission log insert"     ON public.coach_mission_logs;

CREATE POLICY "Users can view own mission logs"
  ON public.coach_mission_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "No direct mission log insert"
  ON public.coach_mission_logs FOR INSERT TO authenticated
  WITH CHECK (false);


-- ============================================================================
-- G. coach_reflections + coach_weekly_reviews + coach_performance_snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reflection_date date NOT NULL,
  energy_1to5 int NOT NULL CHECK (energy_1to5 BETWEEN 1 AND 5),
  rpe_1to10 int CHECK (rpe_1to10 BETWEEN 1 AND 10),
  sleep_quality_1to5 int CHECK (sleep_quality_1to5 BETWEEN 1 AND 5),
  mood_1to5 int CHECK (mood_1to5 BETWEEN 1 AND 5),
  win text,
  friction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date)
);
ALTER TABLE public.coach_reflections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coach_reflections_user_date
  ON public.coach_reflections(user_id, reflection_date DESC);

DROP POLICY IF EXISTS "Users view own reflections"    ON public.coach_reflections;
DROP POLICY IF EXISTS "Users delete own reflections"  ON public.coach_reflections;
DROP POLICY IF EXISTS "No direct reflection insert"   ON public.coach_reflections;
DROP POLICY IF EXISTS "No direct reflection update"   ON public.coach_reflections;

CREATE POLICY "Users view own reflections"   ON public.coach_reflections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reflections" ON public.coach_reflections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No direct reflection insert"  ON public.coach_reflections FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct reflection update"  ON public.coach_reflections FOR UPDATE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.coach_weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_starts_on date NOT NULL,
  performance_score int NOT NULL DEFAULT 0,
  driver_of_week text,
  wins jsonb NOT NULL DEFAULT '[]'::jsonb,
  frictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_week_focus text,
  program_tweak text,
  generated_with text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  UNIQUE (user_id, week_starts_on)
);
ALTER TABLE public.coach_weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coach_weekly_reviews_user_week
  ON public.coach_weekly_reviews(user_id, week_starts_on DESC);

DROP POLICY IF EXISTS "Users view own weekly reviews"       ON public.coach_weekly_reviews;
DROP POLICY IF EXISTS "Users mark own weekly reviews seen"  ON public.coach_weekly_reviews;
DROP POLICY IF EXISTS "Users delete own weekly reviews"     ON public.coach_weekly_reviews;
DROP POLICY IF EXISTS "No direct weekly review insert"      ON public.coach_weekly_reviews;

CREATE POLICY "Users view own weekly reviews"      ON public.coach_weekly_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own weekly reviews seen" ON public.coach_weekly_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own weekly reviews"    ON public.coach_weekly_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No direct weekly review insert"     ON public.coach_weekly_reviews FOR INSERT TO authenticated WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.coach_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  performance_score int NOT NULL DEFAULT 0,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);
ALTER TABLE public.coach_performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coach_perf_snapshots_user_date
  ON public.coach_performance_snapshots(user_id, snapshot_date DESC);

DROP POLICY IF EXISTS "Users view own snapshots"      ON public.coach_performance_snapshots;
DROP POLICY IF EXISTS "No direct snapshot insert"     ON public.coach_performance_snapshots;
DROP POLICY IF EXISTS "No direct snapshot update"     ON public.coach_performance_snapshots;

CREATE POLICY "Users view own snapshots"  ON public.coach_performance_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No direct snapshot insert" ON public.coach_performance_snapshots FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct snapshot update" ON public.coach_performance_snapshots FOR UPDATE TO authenticated USING (false);


-- ============================================================================
-- H. coach_life_os_briefs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_life_os_briefs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  brief_date   date NOT NULL,
  focus        text NOT NULL,
  why          text,
  body         jsonb NOT NULL DEFAULT '{}'::jsonb,
  recovery     jsonb NOT NULL DEFAULT '{}'::jsonb,
  fuel         jsonb NOT NULL DEFAULT '{}'::jsonb,
  mind         jsonb NOT NULL DEFAULT '{}'::jsonb,
  adjustment   jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);
CREATE INDEX IF NOT EXISTS coach_life_os_briefs_user_date_idx
  ON public.coach_life_os_briefs (user_id, brief_date DESC);

ALTER TABLE public.coach_life_os_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_life_os_briefs" ON public.coach_life_os_briefs;
DROP POLICY IF EXISTS "users_upsert_own_life_os_briefs" ON public.coach_life_os_briefs;
DROP POLICY IF EXISTS "users_update_own_life_os_briefs" ON public.coach_life_os_briefs;

CREATE POLICY "users_select_own_life_os_briefs"
  ON public.coach_life_os_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_upsert_own_life_os_briefs"
  ON public.coach_life_os_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_life_os_briefs"
  ON public.coach_life_os_briefs FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================================
-- I. weekly_briefings + coach_nudges
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  headline TEXT NOT NULL,
  summary_md TEXT NOT NULL,
  key_insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_week_protocol JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  UNIQUE (user_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_briefings_user_generated
  ON public.weekly_briefings (user_id, generated_at DESC);
ALTER TABLE public.weekly_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own briefings"          ON public.weekly_briefings;
DROP POLICY IF EXISTS "Users can mark own briefings viewed"   ON public.weekly_briefings;

CREATE POLICY "Users can view own briefings"
  ON public.weekly_briefings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can mark own briefings viewed"
  ON public.weekly_briefings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.coach_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  headline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coach_nudges_user_created
  ON public.coach_nudges (user_id, created_at DESC);
ALTER TABLE public.coach_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own nudges"        ON public.coach_nudges;
DROP POLICY IF EXISTS "Users can mark own nudges seen"   ON public.coach_nudges;

CREATE POLICY "Users can view own nudges"
  ON public.coach_nudges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can mark own nudges seen"
  ON public.coach_nudges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- J. user_habits + user_habit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  protocol_id text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  last_logged_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_habits_active_unique
  ON public.user_habits(user_id, protocol_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS user_habits_user_idx ON public.user_habits(user_id);
ALTER TABLE public.user_habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own habits"      ON public.user_habits;
DROP POLICY IF EXISTS "Premium users can add own habits" ON public.user_habits;
DROP POLICY IF EXISTS "Users can update own habits"    ON public.user_habits;
DROP POLICY IF EXISTS "Users can delete own habits"    ON public.user_habits;

CREATE POLICY "Users can view own habits"      ON public.user_habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Premium users can add own habits" ON public.user_habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_premium(auth.uid()));
CREATE POLICY "Users can update own habits"    ON public.user_habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits"    ON public.user_habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_habits_updated_at ON public.user_habits;
CREATE TRIGGER user_habits_updated_at
  BEFORE UPDATE ON public.user_habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.user_habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  logged_on date NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, logged_on)
);
CREATE INDEX IF NOT EXISTS user_habit_logs_user_date_idx
  ON public.user_habit_logs(user_id, logged_on DESC);
ALTER TABLE public.user_habit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own habit logs"   ON public.user_habit_logs;
DROP POLICY IF EXISTS "No direct habit log insert"      ON public.user_habit_logs;
DROP POLICY IF EXISTS "No direct habit log update"      ON public.user_habit_logs;

CREATE POLICY "Users can view own habit logs" ON public.user_habit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No direct habit log insert"    ON public.user_habit_logs FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct habit log update"    ON public.user_habit_logs FOR UPDATE TO authenticated USING (false);


-- ============================================================================
-- K. RPCs
-- ============================================================================

-- upsert_athlete_profile — partial JSON patch upsert (includes holistic fields)
CREATE OR REPLACE FUNCTION public.upsert_athlete_profile(_patch jsonb)
RETURNS public.coach_athlete_profile
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.coach_athlete_profile;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  INSERT INTO public.coach_athlete_profile (user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.coach_athlete_profile SET
    age = COALESCE((_patch->>'age')::int, age),
    sex = COALESCE(_patch->>'sex', sex),
    height_cm = COALESCE((_patch->>'height_cm')::numeric, height_cm),
    weight_kg = COALESCE((_patch->>'weight_kg')::numeric, weight_kg),
    body_fat_pct = COALESCE((_patch->>'body_fat_pct')::numeric, body_fat_pct),
    primary_goal = COALESCE(_patch->>'primary_goal', primary_goal),
    secondary_goal = COALESCE(_patch->>'secondary_goal', secondary_goal),
    target_horizon_weeks = COALESCE((_patch->>'target_horizon_weeks')::int, target_horizon_weeks),
    timezone = COALESCE(_patch->>'timezone', timezone),
    wake_time = COALESCE((_patch->>'wake_time')::time, wake_time),
    sleep_time = COALESCE((_patch->>'sleep_time')::time, sleep_time),
    training_days_pref = COALESCE(
      CASE WHEN _patch ? 'training_days_pref'
           THEN ARRAY(SELECT (jsonb_array_elements_text(_patch->'training_days_pref'))::int)
      END, training_days_pref),
    busy_blocks = COALESCE(_patch->'busy_blocks', busy_blocks),
    injuries = COALESCE(
      CASE WHEN _patch ? 'injuries'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'injuries'))
      END, injuries),
    dietary = COALESCE(
      CASE WHEN _patch ? 'dietary'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'dietary'))
      END, dietary),
    equipment = COALESCE(
      CASE WHEN _patch ? 'equipment'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'equipment'))
      END, equipment),
    no_go_protocols = COALESCE(
      CASE WHEN _patch ? 'no_go_protocols'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'no_go_protocols'))
      END, no_go_protocols),
    language_pref = COALESCE(_patch->>'language_pref', language_pref),
    tone_pref = COALESCE(_patch->>'tone_pref', tone_pref),
    preferred_session_length_min = COALESCE((_patch->>'preferred_session_length_min')::int, preferred_session_length_min),
    i_am = COALESCE(_patch->>'i_am', i_am),
    onboarded = COALESCE((_patch->>'onboarded')::boolean, onboarded),
    hobbies = COALESCE(
      CASE WHEN _patch ? 'hobbies'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'hobbies'))
      END, hobbies),
    life_context = COALESCE(_patch->>'life_context', life_context),
    stress_baseline = COALESCE((_patch->>'stress_baseline')::int, stress_baseline),
    mood_baseline = COALESCE((_patch->>'mood_baseline')::int, mood_baseline),
    mental_health_focus = COALESCE(
      CASE WHEN _patch ? 'mental_health_focus'
           THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'mental_health_focus'))
      END, mental_health_focus),
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row_out;

  RETURN row_out;
END $$;
GRANT EXECUTE ON FUNCTION public.upsert_athlete_profile(jsonb) TO authenticated;

-- get_active_coach_program
CREATE OR REPLACE FUNCTION public.get_active_coach_program(_user_id uuid)
RETURNS SETOF public.coach_programs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.coach_programs
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_coach_program(uuid) TO authenticated;

-- complete_coach_mission — atomically award mission XP
CREATE OR REPLACE FUNCTION public.complete_coach_mission(_plan_id uuid, _mission_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan record;
  v_mission jsonb;
  v_xp integer := 0;
  v_already boolean;
  v_new_xp integer;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','unauthorized'); END IF;
  SELECT * INTO v_plan FROM public.coach_daily_plans WHERE id = _plan_id;
  IF NOT FOUND OR v_plan.user_id <> v_user THEN
    RETURN jsonb_build_object('error','plan_not_found');
  END IF;

  SELECT m INTO v_mission FROM jsonb_array_elements(v_plan.missions) m
   WHERE m->>'id' = _mission_id LIMIT 1;
  IF v_mission IS NULL THEN RETURN jsonb_build_object('error','mission_not_found'); END IF;

  v_xp := COALESCE((v_mission->>'xp')::int, 15);

  SELECT EXISTS(
    SELECT 1 FROM public.coach_mission_logs
    WHERE daily_plan_id = _plan_id AND mission_id = _mission_id
  ) INTO v_already;
  IF v_already THEN RETURN jsonb_build_object('error','already_completed'); END IF;

  INSERT INTO public.coach_mission_logs(user_id, daily_plan_id, mission_id, xp_awarded)
  VALUES (v_user, _plan_id, _mission_id, v_xp);

  UPDATE public.profiles
     SET xp = xp + v_xp, updated_at = now()
   WHERE user_id = v_user
  RETURNING xp INTO v_new_xp;

  RETURN jsonb_build_object('ok', true, 'xp_awarded', v_xp, 'new_xp', v_new_xp);
END $$;
GRANT EXECUTE ON FUNCTION public.complete_coach_mission(uuid, text) TO authenticated;

-- upsert_daily_plan (full signature incl. rationale + framework_version)
CREATE OR REPLACE FUNCTION public.upsert_daily_plan(
  _plan_date date,
  _readiness_score integer,
  _readiness_breakdown jsonb,
  _adjustment text,
  _headline text,
  _missions jsonb,
  _generated_with text,
  _rationale text DEFAULT NULL,
  _framework_version text DEFAULT '1.0'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.coach_daily_plans(
    user_id, plan_date, readiness_score, readiness_breakdown,
    adjustment, headline, missions, generated_with, rationale, framework_version
  ) VALUES (
    v_user, _plan_date, _readiness_score, _readiness_breakdown,
    _adjustment, _headline, _missions, _generated_with, _rationale, COALESCE(_framework_version, '1.0')
  )
  ON CONFLICT (user_id, plan_date) DO UPDATE SET
    readiness_score = EXCLUDED.readiness_score,
    readiness_breakdown = EXCLUDED.readiness_breakdown,
    adjustment = EXCLUDED.adjustment,
    headline = EXCLUDED.headline,
    missions = EXCLUDED.missions,
    generated_with = EXCLUDED.generated_with,
    rationale = EXCLUDED.rationale,
    framework_version = EXCLUDED.framework_version,
    generated_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.upsert_daily_plan(date, integer, jsonb, text, text, jsonb, text, text, text) TO authenticated;

-- log_preference_signal
CREATE OR REPLACE FUNCTION public.log_preference_signal(
  _signal_type text,
  _protocol_id text DEFAULT NULL,
  _value text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.coach_preference_signals (user_id, signal_type, protocol_id, value, metadata)
  VALUES (uid, _signal_type, _protocol_id, _value, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.log_preference_signal(text, text, text, jsonb) TO authenticated;

-- add_chat_memory (60-day dedupe)
CREATE OR REPLACE FUNCTION public.add_chat_memory(
  _fact text, _source text DEFAULT 'chat', _confidence numeric DEFAULT 0.7
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.coach_chat_memory
    WHERE user_id = uid AND lower(fact) = lower(_fact)
      AND created_at > now() - interval '60 days'
  ) THEN RETURN NULL; END IF;
  INSERT INTO public.coach_chat_memory (user_id, fact, source, confidence)
  VALUES (uid, _fact, COALESCE(_source,'chat'), COALESCE(_confidence, 0.7))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.add_chat_memory(text, text, numeric) TO authenticated;

-- delete_chat_memory
CREATE OR REPLACE FUNCTION public.delete_chat_memory(_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.coach_chat_memory WHERE id = _id AND user_id = uid;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION public.delete_chat_memory(uuid) TO authenticated;

-- upsert_goal
CREATE OR REPLACE FUNCTION public.upsert_goal(_patch jsonb)
RETURNS public.coach_goals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  goal_id uuid;
  row_out public.coach_goals;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  goal_id := NULLIF(_patch->>'id','')::uuid;
  IF goal_id IS NULL THEN
    INSERT INTO public.coach_goals (
      user_id, title, metric, unit,
      baseline_value, current_value, target_value,
      deadline, weekly_milestone, status
    ) VALUES (
      uid,
      COALESCE(_patch->>'title','New goal'),
      COALESCE(_patch->>'metric','custom'),
      COALESCE(_patch->>'unit',''),
      NULLIF(_patch->>'baseline_value','')::numeric,
      NULLIF(_patch->>'current_value','')::numeric,
      COALESCE((_patch->>'target_value')::numeric, 0),
      NULLIF(_patch->>'deadline','')::date,
      NULLIF(_patch->>'weekly_milestone','')::numeric,
      COALESCE(_patch->>'status','active')
    )
    RETURNING * INTO row_out;
  ELSE
    UPDATE public.coach_goals SET
      title = COALESCE(_patch->>'title', title),
      metric = COALESCE(_patch->>'metric', metric),
      unit = COALESCE(_patch->>'unit', unit),
      baseline_value = COALESCE(NULLIF(_patch->>'baseline_value','')::numeric, baseline_value),
      current_value = COALESCE(NULLIF(_patch->>'current_value','')::numeric, current_value),
      target_value = COALESCE(NULLIF(_patch->>'target_value','')::numeric, target_value),
      deadline = COALESCE(NULLIF(_patch->>'deadline','')::date, deadline),
      weekly_milestone = COALESCE(NULLIF(_patch->>'weekly_milestone','')::numeric, weekly_milestone),
      status = COALESCE(_patch->>'status', status),
      updated_at = now()
    WHERE id = goal_id AND user_id = uid
    RETURNING * INTO row_out;
  END IF;
  RETURN row_out;
END $$;
GRANT EXECUTE ON FUNCTION public.upsert_goal(jsonb) TO authenticated;

-- update_goal_progress
CREATE OR REPLACE FUNCTION public.update_goal_progress(_goal_id uuid, _new_value numeric)
RETURNS public.coach_goals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.coach_goals;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.coach_goals
     SET current_value = _new_value,
         status = CASE
           WHEN target_value IS NOT NULL
            AND ((target_value >= COALESCE(baseline_value,0) AND _new_value >= target_value)
              OR (target_value < COALESCE(baseline_value,0) AND _new_value <= target_value))
           THEN 'achieved'
           ELSE status
         END,
         updated_at = now()
   WHERE id = _goal_id AND user_id = uid
   RETURNING * INTO row_out;
  RETURN row_out;
END $$;
GRANT EXECUTE ON FUNCTION public.update_goal_progress(uuid, numeric) TO authenticated;

-- upsert_reflection
CREATE OR REPLACE FUNCTION public.upsert_reflection(
  _reflection_date date,
  _energy_1to5 int,
  _rpe_1to10 int DEFAULT NULL,
  _sleep_quality_1to5 int DEFAULT NULL,
  _mood_1to5 int DEFAULT NULL,
  _win text DEFAULT NULL,
  _friction text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _energy_1to5 < 1 OR _energy_1to5 > 5 THEN RAISE EXCEPTION 'energy out of range'; END IF;
  INSERT INTO public.coach_reflections (
    user_id, reflection_date, energy_1to5, rpe_1to10, sleep_quality_1to5, mood_1to5, win, friction
  ) VALUES (
    uid, _reflection_date, _energy_1to5, _rpe_1to10, _sleep_quality_1to5, _mood_1to5,
    NULLIF(LEFT(COALESCE(_win, ''), 280), ''), NULLIF(LEFT(COALESCE(_friction, ''), 280), '')
  )
  ON CONFLICT (user_id, reflection_date) DO UPDATE SET
    energy_1to5 = EXCLUDED.energy_1to5,
    rpe_1to10 = EXCLUDED.rpe_1to10,
    sleep_quality_1to5 = EXCLUDED.sleep_quality_1to5,
    mood_1to5 = EXCLUDED.mood_1to5,
    win = EXCLUDED.win,
    friction = EXCLUDED.friction
  RETURNING id INTO rid;
  RETURN rid;
END $$;
GRANT EXECUTE ON FUNCTION public.upsert_reflection(date, int, int, int, int, text, text) TO authenticated;

-- upsert_weekly_review
CREATE OR REPLACE FUNCTION public.upsert_weekly_review(
  _week_starts_on date,
  _performance_score int,
  _driver_of_week text,
  _wins jsonb,
  _frictions jsonb,
  _next_week_focus text,
  _program_tweak text,
  _generated_with text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.coach_weekly_reviews (
    user_id, week_starts_on, performance_score, driver_of_week, wins, frictions,
    next_week_focus, program_tweak, generated_with
  ) VALUES (
    uid, _week_starts_on, GREATEST(0, LEAST(100, _performance_score)), _driver_of_week,
    COALESCE(_wins, '[]'::jsonb), COALESCE(_frictions, '[]'::jsonb),
    _next_week_focus, _program_tweak, COALESCE(_generated_with, 'google/gemini-2.5-flash')
  )
  ON CONFLICT (user_id, week_starts_on) DO UPDATE SET
    performance_score = EXCLUDED.performance_score,
    driver_of_week = EXCLUDED.driver_of_week,
    wins = EXCLUDED.wins,
    frictions = EXCLUDED.frictions,
    next_week_focus = EXCLUDED.next_week_focus,
    program_tweak = EXCLUDED.program_tweak,
    generated_with = EXCLUDED.generated_with
  RETURNING id INTO rid;
  RETURN rid;
END $$;
GRANT EXECUTE ON FUNCTION public.upsert_weekly_review(date, int, text, jsonb, jsonb, text, text, text) TO authenticated;

-- upsert_performance_snapshot
CREATE OR REPLACE FUNCTION public.upsert_performance_snapshot(
  _snapshot_date date,
  _performance_score int,
  _components jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.coach_performance_snapshots (user_id, snapshot_date, performance_score, components)
  VALUES (uid, _snapshot_date, GREATEST(0, LEAST(100, _performance_score)), COALESCE(_components, '{}'::jsonb))
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    performance_score = EXCLUDED.performance_score,
    components = EXCLUDED.components
  RETURNING id INTO rid;
  RETURN rid;
END $$;
GRANT EXECUTE ON FUNCTION public.upsert_performance_snapshot(date, int, jsonb) TO authenticated;

-- append_chat_memory_batch (used by coach-extract-memory edge fn)
CREATE OR REPLACE FUNCTION public.append_chat_memory_batch(_facts jsonb)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  inserted int := 0;
  item jsonb;
  fact_text text;
  conf numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF jsonb_typeof(_facts) <> 'array' THEN RETURN 0; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(_facts) LOOP
    fact_text := LEFT(COALESCE(item->>'fact', ''), 240);
    conf := LEAST(1, GREATEST(0, COALESCE((item->>'confidence')::numeric, 0.7)));
    IF length(fact_text) >= 6 THEN
      INSERT INTO public.coach_chat_memory (user_id, fact, confidence, source)
      VALUES (uid, fact_text, conf, 'chat-extract');
      inserted := inserted + 1;
    END IF;
  END LOOP;
  DELETE FROM public.coach_chat_memory
  WHERE user_id = uid
    AND id NOT IN (
      SELECT id FROM public.coach_chat_memory
      WHERE user_id = uid
      ORDER BY created_at DESC
      LIMIT 50
    );
  RETURN inserted;
END $$;
GRANT EXECUTE ON FUNCTION public.append_chat_memory_batch(jsonb) TO authenticated;

-- log_habit (premium-only, streak + XP)
CREATE OR REPLACE FUNCTION public.log_habit(_habit_id uuid, _date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_habit public.user_habits%ROWTYPE;
  v_logged_on date := COALESCE(_date, (now() AT TIME ZONE 'UTC')::date);
  v_already uuid;
  v_base_xp int := 8;
  v_level_mult numeric := 1.0;
  v_xp int;
  v_new_streak int;
  v_new_level int;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','unauthorized'); END IF;
  IF NOT public.has_premium(v_user) THEN RETURN jsonb_build_object('error','premium_required'); END IF;

  SELECT * INTO v_habit FROM public.user_habits
   WHERE id = _habit_id AND user_id = v_user AND archived_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','habit_not_found'); END IF;

  SELECT id INTO v_already FROM public.user_habit_logs
   WHERE habit_id = _habit_id AND logged_on = v_logged_on;
  IF v_already IS NOT NULL THEN RETURN jsonb_build_object('error','already_logged'); END IF;

  IF v_habit.last_logged_on IS NULL THEN
    v_new_streak := 1;
  ELSIF v_habit.last_logged_on = v_logged_on - INTERVAL '1 day' THEN
    v_new_streak := v_habit.current_streak + 1;
  ELSIF v_habit.last_logged_on = v_logged_on THEN
    v_new_streak := v_habit.current_streak;
  ELSE
    v_new_streak := 1;
  END IF;

  v_new_level := CASE
    WHEN v_new_streak >= 120 THEN 5
    WHEN v_new_streak >= 60  THEN 4
    WHEN v_new_streak >= 21  THEN 3
    WHEN v_new_streak >= 7   THEN 2
    ELSE 1 END;
  v_level_mult := CASE v_new_level
    WHEN 1 THEN 1.0 WHEN 2 THEN 1.25 WHEN 3 THEN 1.5 WHEN 4 THEN 1.75 WHEN 5 THEN 2.0 END;
  v_xp := GREATEST(5, ROUND(v_base_xp * v_level_mult));

  INSERT INTO public.user_habit_logs (habit_id, user_id, logged_on, xp_awarded)
  VALUES (_habit_id, v_user, v_logged_on, v_xp);

  UPDATE public.user_habits
     SET current_streak = v_new_streak,
         best_streak = GREATEST(best_streak, v_new_streak),
         level = v_new_level,
         last_logged_on = v_logged_on,
         updated_at = now()
   WHERE id = _habit_id;

  UPDATE public.profiles
     SET xp = xp + v_xp, updated_at = now()
   WHERE user_id = v_user;

  RETURN jsonb_build_object('ok', true, 'xp_awarded', v_xp,
                            'streak', v_new_streak, 'level', v_new_level);
END $$;
REVOKE ALL ON FUNCTION public.log_habit(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_habit(uuid, date) TO authenticated;

-- add_user_habit (premium-only, 5-active cap)
CREATE OR REPLACE FUNCTION public.add_user_habit(_protocol_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_active_count int;
  v_existing uuid;
  v_new_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','unauthorized'); END IF;
  IF NOT public.has_premium(v_user) THEN RETURN jsonb_build_object('error','premium_required'); END IF;
  IF _protocol_id IS NULL OR length(_protocol_id) = 0 OR length(_protocol_id) > 80 THEN
    RETURN jsonb_build_object('error','invalid_protocol');
  END IF;
  SELECT id INTO v_existing FROM public.user_habits
   WHERE user_id = v_user AND protocol_id = _protocol_id AND archived_at IS NULL;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error','already_active','habit_id',v_existing);
  END IF;
  SELECT count(*) INTO v_active_count FROM public.user_habits
   WHERE user_id = v_user AND archived_at IS NULL;
  IF v_active_count >= 5 THEN RETURN jsonb_build_object('error','cap_reached'); END IF;
  INSERT INTO public.user_habits (user_id, protocol_id)
  VALUES (v_user, _protocol_id)
  RETURNING id INTO v_new_id;
  RETURN jsonb_build_object('ok', true, 'habit_id', v_new_id);
END $$;
REVOKE ALL ON FUNCTION public.add_user_habit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_user_habit(text) TO authenticated;

-- ============================================================================
-- DONE.  Verify with:
--   SELECT count(*) FROM public.coach_athlete_profile;
--   SELECT public.upsert_athlete_profile('{"onboarded": false}'::jsonb);
-- ============================================================================
