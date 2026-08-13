-- Whealth OS: nightly synthesis run. Computes the Whealth Index + patterns
-- for every recently-active user and stores a daily row in
-- coach_performance_snapshots (fixes the "trend has one point per manual
-- tap" problem for free). Same vault-secret invocation pattern as
-- coach-proactive-hourly / weekly-briefing-generate.
DO $$
BEGIN
  PERFORM cron.unschedule('coach-insights-nightly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'coach-insights-nightly',
    '15 3 * * *',
    $job$
  select net.http_post(
    url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/coach-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule coach-insights-nightly manually';
END $$;
