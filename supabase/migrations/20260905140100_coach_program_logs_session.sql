-- Sessions on coach_program_logs: when it started, how long it took, and what
-- actually happened to it.
--
-- WHY
--
-- The table has recorded exactly one fact since it was created: a row exists,
-- therefore the session was completed. `completed` is `NOT NULL DEFAULT true`
-- and the only client write inserts it as `true`, so there has never been a way
-- to express "skipped", "moved to tomorrow", or "started but abandoned".
--
-- That single boolean is why the program cannot respond to a missed week. A
-- missing row means "not done", but it cannot distinguish a rest day from an
-- illness from a user who quietly stopped — and the app has to tell those
-- apart to offer the right way back in.
--
-- Duration matters for a different reason: the plan advertises "~52 min" from
-- `plan_json.duration_min`, which is an estimate the model wrote. Recording
-- what sessions actually take is the only way that estimate ever gets honest.

ALTER TABLE public.coach_program_logs
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_sec int,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

ALTER TABLE public.coach_program_logs
  DROP CONSTRAINT IF EXISTS coach_program_logs_status_check;
ALTER TABLE public.coach_program_logs
  ADD CONSTRAINT coach_program_logs_status_check
  CHECK (status IN ('completed', 'skipped', 'moved', 'in_progress'));

ALTER TABLE public.coach_program_logs
  DROP CONSTRAINT IF EXISTS coach_program_logs_duration_check;
ALTER TABLE public.coach_program_logs
  ADD CONSTRAINT coach_program_logs_duration_check
  CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 43200);

-- Every row that already exists was written by `markDone`, which only ever
-- meant "completed". The default matches that, so the backfill is a no-op —
-- stated explicitly rather than left to be inferred.
UPDATE public.coach_program_logs SET status = 'completed' WHERE status IS NULL;

COMMENT ON COLUMN public.coach_program_logs.status IS
  'completed | skipped | moved | in_progress. `completed` stays in sync with the legacy `completed` boolean; older rows all predate this column and are completed.';
COMMENT ON COLUMN public.coach_program_logs.started_at IS
  'When the athlete started the session in the runner. NULL for sessions marked done without running one.';
COMMENT ON COLUMN public.coach_program_logs.duration_sec IS
  'Measured session length. NULL when unknown — never guessed from plan_json.';

-- The `notes` column has existed since the table was created and no client has
-- ever read or written it. Left in place: the session summary is the natural
-- place for a note, and dropping a column to re-add it later is worse.

NOTIFY pgrst, 'reload schema';
