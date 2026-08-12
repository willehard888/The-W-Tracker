-- Vault vs trial coherence: the header sells trial users "Full access · Nd"
-- and the AI Coach already honors it (has_active_access includes the 7/14-day
-- trial) — but vault_articles RLS used has_premium (paid only), so a trial
-- user tapping the Vault got silently bounced to the paywall. Align the Vault
-- with the same access function the rest of the paid app uses.
-- vault_lesson_progress policies are per-user rows and stay unchanged.

DROP POLICY "Premium members can read vault articles" ON public.vault_articles;

CREATE POLICY "Members and trialists can read vault articles"
  ON public.vault_articles
  FOR SELECT
  TO authenticated
  USING (has_active_access(auth.uid()));
