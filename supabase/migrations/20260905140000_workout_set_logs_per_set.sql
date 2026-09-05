-- Per-set logging for workout_set_logs.
--
-- WHY
--
-- The table has carried a unique index on
-- (user_id, program_id, week, day_index, exercise_slug) since it was created,
-- which allows exactly ONE row per exercise per program-day. A program that
-- prescribes "3 × 8" could only ever record a single number, so the app could
-- not say "set 2 of 3 done", could not show which set failed, and could not
-- tell a heavy top set from three easy ones. The active-workout runner needs
-- all three.
--
-- MIGRATION SAFETY
--
-- `set_index` defaults to 1, so every existing row becomes "set 1" and no data
-- is lost or reinterpreted. The old unique index is replaced by one that
-- includes the set, so previously-conflicting inserts now co-exist.

ALTER TABLE public.workout_set_logs
  ADD COLUMN IF NOT EXISTS set_index int NOT NULL DEFAULT 1;

ALTER TABLE public.workout_set_logs
  DROP CONSTRAINT IF EXISTS workout_set_logs_set_index_check;
ALTER TABLE public.workout_set_logs
  ADD CONSTRAINT workout_set_logs_set_index_check CHECK (set_index BETWEEN 1 AND 50);

DROP INDEX IF EXISTS uniq_workout_set_logs_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_workout_set_logs_slot
  ON public.workout_set_logs (user_id, program_id, week, day_index, exercise_slug, set_index)
  WHERE program_id IS NOT NULL AND exercise_slug IS NOT NULL;

COMMENT ON COLUMN public.workout_set_logs.set_index IS
  'Which working set within the exercise, 1-based. Rows written before per-set logging existed are all set 1.';

-- ============================================================
-- log_workout_set: same function, one more argument.
--
-- The old 8-argument signature must be DROPPED rather than replaced. Adding a
-- defaulted parameter creates a NEW signature, and Postgres would then see two
-- candidates for an 8-argument call and refuse it as ambiguous. Dropping first
-- means existing 8-argument callers keep working and land on set 1.
-- ============================================================
DROP FUNCTION IF EXISTS public.log_workout_set(uuid, int, int, text, text, numeric, int, numeric);

CREATE OR REPLACE FUNCTION public.log_workout_set(
  p_program uuid, p_week int, p_day int,
  p_slug text, p_name text, p_weight numeric, p_reps int, p_rpe numeric DEFAULT NULL,
  p_set_index int DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid; v_set int := GREATEST(1, LEAST(COALESCE(p_set_index, 1), 50));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF length(trim(coalesce(p_name,''))) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;

  IF p_program IS NOT NULL AND p_slug IS NOT NULL THEN
    UPDATE workout_set_logs
       SET weight = p_weight, reps = p_reps, rpe = p_rpe,
           exercise_name = COALESCE(p_name, exercise_name),
           logged_on = (now() AT TIME ZONE 'utc')::date, updated_at = now()
     WHERE user_id = uid AND program_id = p_program AND week = p_week
       AND day_index = p_day AND exercise_slug = p_slug AND set_index = v_set
     RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  INSERT INTO workout_set_logs
    (user_id, program_id, week, day_index, exercise_slug, exercise_name, weight, reps, rpe, set_index)
    VALUES (uid, p_program, p_week, p_day, p_slug, p_name, p_weight, p_reps, p_rpe, v_set)
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.log_workout_set(uuid,int,int,text,text,numeric,int,numeric,int) TO authenticated;

-- ============================================================
-- recent_workout_logs: keep the OLD meaning under the new shape.
--
-- Three consumers read this to compute strength progression:
--   src/hooks/use-live-whealth-index.ts   (Whealth Index movement pillar)
--   supabase/functions/_shared/progression.ts  (AI chat + morning brief)
--   supabase/functions/coach-generate-program  (progresses the next block)
--
-- They all treat one row as "what this exercise did that day" and compute an
-- Epley e1RM from it. With per-set rows a plain `LIMIT 120` would return three
-- sets of forty exercises instead of a hundred and twenty exercise-days, so
-- the progression window would silently shrink to a third without any error.
--
-- So this now returns the HEAVIEST set per exercise per day — the top working
-- set, which is exactly what those e1RM calculations always meant to read.
-- Ties break on the higher rep count, then the later write.
-- ============================================================
CREATE OR REPLACE FUNCTION public.recent_workout_logs(p_limit int DEFAULT 40)
RETURNS SETOF public.workout_set_logs
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM (
    SELECT DISTINCT ON (exercise_slug, logged_on) *
      FROM workout_set_logs
     WHERE user_id = auth.uid()
     ORDER BY exercise_slug, logged_on DESC,
              weight DESC NULLS LAST, reps DESC NULLS LAST, updated_at DESC
  ) top_sets
  ORDER BY logged_on DESC, updated_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.recent_workout_logs(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
