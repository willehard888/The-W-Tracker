-- Growth Engine: weekly founder digest. Monday 06:00 UTC (≈09:00 Helsinki)
-- push of the week's headline numbers (WAU Δ, signups, purchases, trials,
-- D7 of the latest mature cohort) to every admin's devices, deep-linking to
-- /admin/metrics. Same vault-secret invocation pattern as coach-insights.
DO $$
BEGIN
  PERFORM cron.unschedule('founder-digest-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'founder-digest-weekly',
    '0 6 * * 1',
    $job$
  select net.http_post(
    url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/founder-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule founder-digest-weekly manually';
END $$;
