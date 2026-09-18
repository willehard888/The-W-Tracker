-- Recovery sessions — what was recommended, what was done, and how the two
-- differed. The pilot's question is whether a finished workout turns into a
-- finished recovery session, and analytics_events answers that at the funnel
-- level; this table is the detail underneath it: which movements, for which
-- areas, planned against actual.
--
-- One row per attempt, not per athlete-day. Somebody who opens recovery twice
-- in an evening has done two things, and collapsing them would hide the one
-- that got abandoned — which is the row worth reading.
--
-- NO HEALTH DATA. Areas are muscle names. Sleep, resting heart rate and
-- soreness are deliberately absent: P0 makes no claim that rests on them, so
-- storing them here would be collecting for its own sake.
--
-- NOTHING WRITES TO THIS YET, and that is on purpose. src/integrations/
-- supabase/types.ts is generated from the live schema, so a client insert
-- against a table that is not deployed needs an `as any` — which the type-debt
-- ratchet fails, correctly. The order is: run this migration, regenerate the
-- types, then add the insert. Until then the recovery funnel is measured
-- through analytics_events (recovery_offered → opened → started → completed,
-- with dismissed and skipped), which already answers the pilot's question at
-- the rate level; this table is the per-session detail underneath it.

CREATE TABLE IF NOT EXISTS public.recovery_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Where the session was offered from.
  source text NOT NULL CHECK (source IN ('post_workout', 'rest_day', 'manual')),

  -- The workout that triggered it, when there was one. SET NULL rather than
  -- CASCADE: a deleted program should not take the record of the recovery
  -- somebody actually did with it.
  program_id uuid REFERENCES public.coach_programs(id) ON DELETE SET NULL,
  week int,
  day_index int,

  -- What the model decided, kept so a later change to the model can be told
  -- apart from a change in behaviour.
  areas text[] NOT NULL DEFAULT '{}',
  movement_ids text[] NOT NULL DEFAULT '{}',
  -- True when no trained area could be resolved and the session was general.
  was_general boolean NOT NULL DEFAULT false,
  length text NOT NULL DEFAULT 'standard' CHECK (length IN ('quick', 'standard', 'deep')),

  planned_sec int NOT NULL DEFAULT 0 CHECK (planned_sec >= 0),
  -- Filled in when the session ends, either way.
  actual_sec int CHECK (actual_sec >= 0),
  -- 'started' until it resolves. An abandoned session keeps 'started', which is
  -- the honest record: the app cannot know whether they finished off-screen.
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'abandoned')),
  -- How far they got when they left, so a session abandoned at movement 7 of 8
  -- reads differently from one abandoned at movement 1.
  completed_movements int NOT NULL DEFAULT 0 CHECK (completed_movements >= 0),

  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

-- "This athlete's recent recovery" — the only read pattern the app has.
CREATE INDEX IF NOT EXISTS idx_recovery_sessions_user_started
  ON public.recovery_sessions (user_id, started_at DESC);

ALTER TABLE public.recovery_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recovery_sessions own select" ON public.recovery_sessions;
DROP POLICY IF EXISTS "recovery_sessions own insert" ON public.recovery_sessions;
DROP POLICY IF EXISTS "recovery_sessions own update" ON public.recovery_sessions;
DROP POLICY IF EXISTS "recovery_sessions own delete" ON public.recovery_sessions;
CREATE POLICY "recovery_sessions own select" ON public.recovery_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recovery_sessions own insert" ON public.recovery_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recovery_sessions own update" ON public.recovery_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recovery_sessions own delete" ON public.recovery_sessions FOR DELETE USING (auth.uid() = user_id);
