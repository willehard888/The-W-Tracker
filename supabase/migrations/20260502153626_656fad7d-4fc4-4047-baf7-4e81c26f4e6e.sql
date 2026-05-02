
-- ========== coach_programs ==========
CREATE TABLE public.coach_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active | superseded | archived
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

CREATE INDEX idx_coach_programs_user_active
  ON public.coach_programs (user_id, status, created_at DESC);

-- Premium-only insert; users can only insert rows for themselves
CREATE POLICY "Premium users can create own programs"
  ON public.coach_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_premium(auth.uid()));

CREATE POLICY "Users can view own programs"
  ON public.coach_programs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own programs"
  ON public.coach_programs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own programs"
  ON public.coach_programs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER trg_coach_programs_updated_at
  BEFORE UPDATE ON public.coach_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== coach_program_logs ==========
CREATE TABLE public.coach_program_logs (
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

CREATE INDEX idx_coach_program_logs_user
  ON public.coach_program_logs (user_id, logged_at DESC);

CREATE POLICY "Users can view own logs"
  ON public.coach_program_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Premium users can insert own logs"
  ON public.coach_program_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_premium(auth.uid()));

CREATE POLICY "Users can delete own logs"
  ON public.coach_program_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ========== Helper RPC: get_active_coach_program ==========
CREATE OR REPLACE FUNCTION public.get_active_coach_program(_user_id uuid)
RETURNS SETOF public.coach_programs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.coach_programs
  WHERE user_id = _user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
$$;
