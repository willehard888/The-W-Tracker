
-- Adaptive Coach v2: daily plans + mission logs + RPC for XP awarding

CREATE TABLE public.coach_daily_plans (
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

CREATE INDEX idx_coach_daily_plans_user_date ON public.coach_daily_plans(user_id, plan_date DESC);

ALTER TABLE public.coach_daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily plans"
  ON public.coach_daily_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No direct daily plan insert"
  ON public.coach_daily_plans FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct daily plan update"
  ON public.coach_daily_plans FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Users can delete own daily plans"
  ON public.coach_daily_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Mission logs
CREATE TABLE public.coach_mission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  daily_plan_id uuid NOT NULL REFERENCES public.coach_daily_plans(id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (daily_plan_id, mission_id)
);

CREATE INDEX idx_coach_mission_logs_user ON public.coach_mission_logs(user_id, completed_at DESC);

ALTER TABLE public.coach_mission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mission logs"
  ON public.coach_mission_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No direct mission log insert"
  ON public.coach_mission_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- updated_at trigger for daily plans
CREATE TRIGGER update_coach_daily_plans_updated_at
BEFORE UPDATE ON public.coach_daily_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SECURITY DEFINER: complete a mission, award XP atomically
CREATE OR REPLACE FUNCTION public.complete_coach_mission(
  _plan_id uuid,
  _mission_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan record;
  v_mission jsonb;
  v_xp integer := 0;
  v_already boolean;
  v_new_xp integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_plan FROM public.coach_daily_plans WHERE id = _plan_id;
  IF NOT FOUND OR v_plan.user_id <> v_user THEN
    RETURN jsonb_build_object('error', 'plan_not_found');
  END IF;

  SELECT m INTO v_mission
  FROM jsonb_array_elements(v_plan.missions) m
  WHERE m->>'id' = _mission_id
  LIMIT 1;

  IF v_mission IS NULL THEN
    RETURN jsonb_build_object('error', 'mission_not_found');
  END IF;

  v_xp := COALESCE((v_mission->>'xp')::int, 15);

  SELECT EXISTS(
    SELECT 1 FROM public.coach_mission_logs
    WHERE daily_plan_id = _plan_id AND mission_id = _mission_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  INSERT INTO public.coach_mission_logs(user_id, daily_plan_id, mission_id, xp_awarded)
  VALUES (v_user, _plan_id, _mission_id, v_xp);

  UPDATE public.profiles
  SET xp = xp + v_xp,
      updated_at = now()
  WHERE user_id = v_user
  RETURNING xp INTO v_new_xp;

  RETURN jsonb_build_object(
    'ok', true,
    'xp_awarded', v_xp,
    'new_xp', v_new_xp
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_coach_mission(uuid, text) TO authenticated;

-- Allow service role to insert daily plans (edge functions use service role for batch generation,
-- but our function uses user JWT — so we add a definer wrapper)
CREATE OR REPLACE FUNCTION public.upsert_daily_plan(
  _plan_date date,
  _readiness_score integer,
  _readiness_breakdown jsonb,
  _adjustment text,
  _headline text,
  _missions jsonb,
  _generated_with text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.coach_daily_plans(
    user_id, plan_date, readiness_score, readiness_breakdown,
    adjustment, headline, missions, generated_with
  ) VALUES (
    v_user, _plan_date, _readiness_score, _readiness_breakdown,
    _adjustment, _headline, _missions, _generated_with
  )
  ON CONFLICT (user_id, plan_date)
  DO UPDATE SET
    readiness_score = EXCLUDED.readiness_score,
    readiness_breakdown = EXCLUDED.readiness_breakdown,
    adjustment = EXCLUDED.adjustment,
    headline = EXCLUDED.headline,
    missions = EXCLUDED.missions,
    generated_with = EXCLUDED.generated_with,
    generated_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_daily_plan(date, integer, jsonb, text, text, jsonb, text) TO authenticated;
