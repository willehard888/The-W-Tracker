
-- ============================================================
-- A. coach_athlete_profile
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_athlete_profile (
  user_id uuid PRIMARY KEY,
  -- body
  age int CHECK (age IS NULL OR (age BETWEEN 13 AND 120)),
  sex text CHECK (sex IN ('male','female','other','prefer_not_say')),
  height_cm numeric CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 260)),
  weight_kg numeric CHECK (weight_kg IS NULL OR (weight_kg BETWEEN 30 AND 300)),
  body_fat_pct numeric CHECK (body_fat_pct IS NULL OR (body_fat_pct BETWEEN 3 AND 60)),
  -- goals
  primary_goal text CHECK (primary_goal IN ('strength','hypertrophy','endurance','fat_loss','longevity','focus')),
  secondary_goal text CHECK (secondary_goal IS NULL OR secondary_goal IN ('strength','hypertrophy','endurance','fat_loss','longevity','focus')),
  target_horizon_weeks int CHECK (target_horizon_weeks IS NULL OR (target_horizon_weeks BETWEEN 1 AND 104)),
  -- schedule
  timezone text NOT NULL DEFAULT 'UTC',
  wake_time time NOT NULL DEFAULT '07:00',
  sleep_time time NOT NULL DEFAULT '23:00',
  training_days_pref int[] NOT NULL DEFAULT '{1,2,4,5}'::int[], -- 0=Sun..6=Sat
  busy_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- constraints
  injuries text[] NOT NULL DEFAULT '{}',
  dietary text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  no_go_protocols text[] NOT NULL DEFAULT '{}',
  -- style
  language_pref text NOT NULL DEFAULT 'en',
  tone_pref text NOT NULL DEFAULT 'calm_mentor' CHECK (tone_pref IN ('drill_sergeant','calm_mentor','scientist','hype')),
  preferred_session_length_min int NOT NULL DEFAULT 45 CHECK (preferred_session_length_min BETWEEN 10 AND 240),
  -- identity
  i_am text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_athlete_profile ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER coach_athlete_profile_set_updated_at
  BEFORE UPDATE ON public.coach_athlete_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- B. coach_preference_signals
-- ============================================================
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

CREATE INDEX idx_pref_signals_user_type ON public.coach_preference_signals(user_id, signal_type, created_at DESC);
CREATE INDEX idx_pref_signals_user_protocol ON public.coach_preference_signals(user_id, protocol_id) WHERE protocol_id IS NOT NULL;

ALTER TABLE public.coach_preference_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own preference signals"
  ON public.coach_preference_signals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own preference signals"
  ON public.coach_preference_signals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- C. coach_chat_memory
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coach_chat_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fact text NOT NULL CHECK (length(fact) BETWEEN 3 AND 280),
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat','reflection','manual','system')),
  confidence numeric NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_memory_user ON public.coach_chat_memory(user_id, created_at DESC);

ALTER TABLE public.coach_chat_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own chat memory"
  ON public.coach_chat_memory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chat memory"
  ON public.coach_chat_memory FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own chat memory"
  ON public.coach_chat_memory FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Cap at 30 rows per user (FIFO) via trigger
CREATE OR REPLACE FUNCTION public.enforce_chat_memory_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE TRIGGER coach_chat_memory_cap
  AFTER INSERT ON public.coach_chat_memory
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_memory_cap();

-- ============================================================
-- D. coach_goals
-- ============================================================
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

CREATE INDEX idx_coach_goals_user_status ON public.coach_goals(user_id, status);

ALTER TABLE public.coach_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own goals"
  ON public.coach_goals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own goals"
  ON public.coach_goals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goals"
  ON public.coach_goals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own goals"
  ON public.coach_goals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER coach_goals_set_updated_at
  BEFORE UPDATE ON public.coach_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RPCs (SECURITY DEFINER)
-- ============================================================

-- upsert_athlete_profile: partial upsert; only writes fields the caller passes.
CREATE OR REPLACE FUNCTION public.upsert_athlete_profile(_patch jsonb)
RETURNS public.coach_athlete_profile
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.coach_athlete_profile;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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
    updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

-- log_preference_signal
CREATE OR REPLACE FUNCTION public.log_preference_signal(
  _signal_type text,
  _protocol_id text DEFAULT NULL,
  _value text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.coach_preference_signals (user_id, signal_type, protocol_id, value, metadata)
  VALUES (uid, _signal_type, _protocol_id, _value, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- add_chat_memory (also dedupes near-identical recent facts)
CREATE OR REPLACE FUNCTION public.add_chat_memory(
  _fact text,
  _source text DEFAULT 'chat',
  _confidence numeric DEFAULT 0.7
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- skip if identical fact already exists in last 60 days
  IF EXISTS (
    SELECT 1 FROM public.coach_chat_memory
    WHERE user_id = uid
      AND lower(fact) = lower(_fact)
      AND created_at > now() - interval '60 days'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.coach_chat_memory (user_id, fact, source, confidence)
  VALUES (uid, _fact, COALESCE(_source,'chat'), COALESCE(_confidence, 0.7))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- delete_chat_memory
CREATE OR REPLACE FUNCTION public.delete_chat_memory(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.coach_chat_memory WHERE id = _id AND user_id = uid;
  RETURN FOUND;
END;
$$;

-- upsert_goal
CREATE OR REPLACE FUNCTION public.upsert_goal(_patch jsonb)
RETURNS public.coach_goals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

-- update_goal_progress: quick path to bump current_value
CREATE OR REPLACE FUNCTION public.update_goal_progress(_goal_id uuid, _new_value numeric)
RETURNS public.coach_goals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;
