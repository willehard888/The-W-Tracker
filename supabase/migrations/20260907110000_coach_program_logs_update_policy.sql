-- coach_program_logs had SELECT / INSERT (premium) / DELETE policies only.
-- The training runner writes the session lifecycle as upserts on
-- (program_id, week, day_index) — start() inserts the in_progress row and
-- finish() conflicts with it — and INSERT … ON CONFLICT DO UPDATE needs an
-- UPDATE policy on the conflict path. Without it every finish (and the RPE
-- save, a plain UPDATE) failed with 42501 / updated 0 rows.
CREATE POLICY "Users update own logs" ON public.coach_program_logs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
