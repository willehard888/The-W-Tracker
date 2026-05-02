
-- Evening reflections
CREATE TABLE public.coach_reflections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

CREATE POLICY "Users view own reflections" ON public.coach_reflections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reflections" ON public.coach_reflections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No direct reflection insert" ON public.coach_reflections
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct reflection update" ON public.coach_reflections
  FOR UPDATE TO authenticated USING (false);

-- Weekly reviews
CREATE TABLE public.coach_weekly_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

CREATE POLICY "Users view own weekly reviews" ON public.coach_weekly_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own weekly reviews seen" ON public.coach_weekly_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own weekly reviews" ON public.coach_weekly_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No direct weekly review insert" ON public.coach_weekly_reviews
  FOR INSERT TO authenticated WITH CHECK (false);

-- Daily performance snapshots
CREATE TABLE public.coach_performance_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  performance_score int NOT NULL DEFAULT 0,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);
ALTER TABLE public.coach_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own snapshots" ON public.coach_performance_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No direct snapshot insert" ON public.coach_performance_snapshots
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct snapshot update" ON public.coach_performance_snapshots
  FOR UPDATE TO authenticated USING (false);

CREATE INDEX idx_coach_reflections_user_date ON public.coach_reflections(user_id, reflection_date DESC);
CREATE INDEX idx_coach_weekly_reviews_user_week ON public.coach_weekly_reviews(user_id, week_starts_on DESC);
CREATE INDEX idx_coach_perf_snapshots_user_date ON public.coach_performance_snapshots(user_id, snapshot_date DESC);

-- RPCs
CREATE OR REPLACE FUNCTION public.upsert_reflection(
  _reflection_date date,
  _energy_1to5 int,
  _rpe_1to10 int DEFAULT NULL,
  _sleep_quality_1to5 int DEFAULT NULL,
  _mood_1to5 int DEFAULT NULL,
  _win text DEFAULT NULL,
  _friction text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.upsert_performance_snapshot(
  _snapshot_date date,
  _performance_score int,
  _components jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.append_chat_memory_batch(_facts jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Prune to last 50 facts per user
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
