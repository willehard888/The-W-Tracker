-- 1. Extend coach_daily_plans
ALTER TABLE public.coach_daily_plans
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS framework_version text NOT NULL DEFAULT '1.0';

-- 2. user_habits table
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
  ON public.user_habits(user_id, protocol_id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS user_habits_user_idx ON public.user_habits(user_id);

ALTER TABLE public.user_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habits"
  ON public.user_habits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Premium users can add own habits"
  ON public.user_habits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_premium(auth.uid()));

CREATE POLICY "Users can update own habits"
  ON public.user_habits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits"
  ON public.user_habits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER user_habits_updated_at
  BEFORE UPDATE ON public.user_habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. user_habit_logs table
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

CREATE POLICY "Users can view own habit logs"
  ON public.user_habit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No direct habit log insert"
  ON public.user_habit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct habit log update"
  ON public.user_habit_logs FOR UPDATE
  TO authenticated
  USING (false);

-- 4. SECURITY DEFINER RPC: log_habit
CREATE OR REPLACE FUNCTION public.log_habit(_habit_id uuid, _date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF NOT public.has_premium(v_user) THEN
    RETURN jsonb_build_object('error', 'premium_required');
  END IF;

  SELECT * INTO v_habit FROM public.user_habits
   WHERE id = _habit_id AND user_id = v_user AND archived_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'habit_not_found');
  END IF;

  SELECT id INTO v_already FROM public.user_habit_logs
   WHERE habit_id = _habit_id AND logged_on = v_logged_on;
  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_logged');
  END IF;

  -- Streak logic: consecutive days
  IF v_habit.last_logged_on IS NULL THEN
    v_new_streak := 1;
  ELSIF v_habit.last_logged_on = v_logged_on - INTERVAL '1 day' THEN
    v_new_streak := v_habit.current_streak + 1;
  ELSIF v_habit.last_logged_on = v_logged_on THEN
    v_new_streak := v_habit.current_streak;
  ELSE
    -- Missed day(s) — drop one level (min 1) but keep some streak credit
    v_new_streak := 1;
  END IF;

  -- Level rules
  v_new_level := CASE
    WHEN v_new_streak >= 120 THEN 5
    WHEN v_new_streak >= 60  THEN 4
    WHEN v_new_streak >= 21  THEN 3
    WHEN v_new_streak >= 7   THEN 2
    ELSE 1
  END;

  v_level_mult := CASE v_new_level
    WHEN 1 THEN 1.0
    WHEN 2 THEN 1.25
    WHEN 3 THEN 1.5
    WHEN 4 THEN 1.75
    WHEN 5 THEN 2.0
  END;

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
     SET xp = xp + v_xp,
         updated_at = now()
   WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'xp_awarded', v_xp,
    'streak', v_new_streak,
    'level', v_new_level
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_habit(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_habit(uuid, date) TO authenticated;

-- 5. RPC: add_user_habit (enforces 5 active cap)
CREATE OR REPLACE FUNCTION public.add_user_habit(_protocol_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_active_count int;
  v_existing uuid;
  v_new_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF NOT public.has_premium(v_user) THEN RETURN jsonb_build_object('error', 'premium_required'); END IF;
  IF _protocol_id IS NULL OR length(_protocol_id) = 0 OR length(_protocol_id) > 80 THEN
    RETURN jsonb_build_object('error', 'invalid_protocol');
  END IF;

  SELECT id INTO v_existing FROM public.user_habits
   WHERE user_id = v_user AND protocol_id = _protocol_id AND archived_at IS NULL;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_active', 'habit_id', v_existing);
  END IF;

  SELECT count(*) INTO v_active_count FROM public.user_habits
   WHERE user_id = v_user AND archived_at IS NULL;
  IF v_active_count >= 8 THEN
    RETURN jsonb_build_object('error', 'cap_reached');
  END IF;

  INSERT INTO public.user_habits (user_id, protocol_id)
  VALUES (v_user, _protocol_id)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'habit_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_habit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_user_habit(text) TO authenticated;