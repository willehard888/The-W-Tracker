-- The founder's digest becomes daily.
--
-- It carries the only alarm this app has. Three things fail silently here —
-- the money path (the RevenueCat webhook stops and nobody's access updates),
-- push delivery (a send that returns non-2xx looks the same as no send), and
-- pg_cron itself (a job that vanishes takes streak decay or the nightly
-- synthesis with it). A weekly digest means finding out on Monday; the checks
-- are in the payload now, so it should arrive every morning.

DO $do$ BEGIN
  PERFORM cron.unschedule('founder-digest-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

SELECT cron.schedule(
  'founder-digest-daily',
  '0 6 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/founder-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
