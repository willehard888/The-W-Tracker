-- Training writes gate on active access, like the generator that creates the
-- program. The two INSERT policies predate the 14-day trial and still asked
-- for has_premium: a trialist could build and run a session but never record
-- that it happened (no completion row → no check-in prefill, no XP bridge).
-- Ownership check unchanged; the gate widens from paid to paid-or-in-trial.

DROP POLICY IF EXISTS "Premium users can create own programs" ON public.coach_programs;
CREATE POLICY "Active members can create own programs"
  ON public.coach_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_active_access(auth.uid()));

DROP POLICY IF EXISTS "Premium users can insert own logs" ON public.coach_program_logs;
CREATE POLICY "Active members can insert own logs"
  ON public.coach_program_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_active_access(auth.uid()));
