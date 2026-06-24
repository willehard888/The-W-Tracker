-- Workout set logging — the athlete records what they actually lifted (weight ×
-- reps, optional RPE) per exercise per session, so progression is tracked and
-- the AI coach can see it and progress the next block. One row per exercise per
-- program-day slot (upserted). Idempotent.

CREATE TABLE IF NOT EXISTS public.workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.coach_programs(id) ON DELETE SET NULL,
  week int,
  day_index int,
  exercise_slug text,
  exercise_name text NOT NULL,
  weight numeric,           -- kg (top working set)
  reps int,
  rpe numeric,
  logged_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One log per exercise per program-day slot (so re-logging updates in place).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workout_set_logs_slot
  ON public.workout_set_logs (user_id, program_id, week, day_index, exercise_slug)
  WHERE program_id IS NOT NULL AND exercise_slug IS NOT NULL;

-- Fast "history for this exercise" lookups (progression chart, last-time hint).
CREATE INDEX IF NOT EXISTS idx_workout_set_logs_user_slug
  ON public.workout_set_logs (user_id, exercise_slug, logged_on DESC);

ALTER TABLE public.workout_set_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workout_set_logs own select" ON public.workout_set_logs;
DROP POLICY IF EXISTS "workout_set_logs own insert" ON public.workout_set_logs;
DROP POLICY IF EXISTS "workout_set_logs own update" ON public.workout_set_logs;
DROP POLICY IF EXISTS "workout_set_logs own delete" ON public.workout_set_logs;
CREATE POLICY "workout_set_logs own select" ON public.workout_set_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "workout_set_logs own insert" ON public.workout_set_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workout_set_logs own update" ON public.workout_set_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "workout_set_logs own delete" ON public.workout_set_logs FOR DELETE USING (auth.uid() = user_id);

-- Upsert a set log for a program-day slot. Updates in place if it exists.
CREATE OR REPLACE FUNCTION public.log_workout_set(
  p_program uuid, p_week int, p_day int,
  p_slug text, p_name text, p_weight numeric, p_reps int, p_rpe numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF length(trim(coalesce(p_name,''))) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;

  IF p_program IS NOT NULL AND p_slug IS NOT NULL THEN
    UPDATE workout_set_logs
       SET weight = p_weight, reps = p_reps, rpe = p_rpe,
           exercise_name = COALESCE(p_name, exercise_name),
           logged_on = (now() AT TIME ZONE 'utc')::date, updated_at = now()
     WHERE user_id = uid AND program_id = p_program AND week = p_week
       AND day_index = p_day AND exercise_slug = p_slug
     RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  INSERT INTO workout_set_logs (user_id, program_id, week, day_index, exercise_slug, exercise_name, weight, reps, rpe)
    VALUES (uid, p_program, p_week, p_day, p_slug, p_name, p_weight, p_reps, p_rpe)
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.log_workout_set(uuid,int,int,text,text,numeric,int,numeric) TO authenticated;

-- Recent logs for the AI coach (last N across all exercises) — used to read
-- progression. Returns newest first.
CREATE OR REPLACE FUNCTION public.recent_workout_logs(p_limit int DEFAULT 40)
RETURNS SETOF public.workout_set_logs
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM workout_set_logs
  WHERE user_id = auth.uid()
  ORDER BY logged_on DESC, updated_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.recent_workout_logs(int) TO authenticated;
