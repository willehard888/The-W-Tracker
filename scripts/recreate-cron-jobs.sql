-- ───────────────────────────────────────────────────────────────────────
-- recreate-cron-jobs.sql — every scheduled job this app has, as it runs.
--
-- Generated from the live `cron.job` table, and the place to update when a
-- schedule changes. Nothing pages when a cron stops: a job that silently
-- vanished is the failure mode this file exists to make recoverable.
--
-- Prerequisites on the destination project:
--   1. Extensions `pg_cron` and `pg_net` enabled.
--   2. A vault secret named `service_role_key` holding the service-role key.
--      Every HTTP job reads it from the vault rather than carrying a copy —
--      rotating the key then means updating one secret, not fifteen jobs.
--
-- Run it in the SQL editor. `cron.schedule` is idempotent by job name: the
-- same name updates the schedule instead of creating a duplicate.
-- ───────────────────────────────────────────────────────────────────────

-- Retired jobs. `daily-reminder` was replaced 2026-09-02 by the client-side
-- local notification (exact streak count, works offline); the server push
-- would have doubled every banner. `founder-digest-weekly` became daily.
DO $do$ BEGIN
  PERFORM cron.unschedule('daily-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;
DO $do$ BEGIN
  PERFORM cron.unschedule('founder-digest-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;


-- Approves posts left pending by the moderation gate so nothing is stuck invisible.
SELECT cron.schedule(
  'moderation-sweeper',
  '*/5 * * * *',
  $$ SELECT public.approve_stale_pending_posts() $$
);

-- Scores and decides finished 1v1 battles, awards the XP.
SELECT cron.schedule(
  'resolve-battles',
  '*/15 * * * *',
  $$ SELECT public.resolve_expired_battles() $$
);

-- Same for tribe battles.
SELECT cron.schedule(
  'tribe-battles-resolve',
  '*/30 * * * *',
  $$ SELECT public.auto_resolve_expired_tribe_battles() $$
);

-- Trigger-ladder outreach: the coach reaches out when the data says to.
SELECT cron.schedule(
  'coach-proactive-hourly',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/coach-proactive',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Event reminders (T-24h, T-1h) and the evening fire-at-risk nudge.
SELECT cron.schedule(
  'tribe-nudges-hourly',
  '5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/tribe-nudges',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Streak decay, honouring banked shields. Without it streaks never break.
SELECT cron.schedule(
  'sync-streaks',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/sync-streaks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- The nightly Whealth Index synthesis. Its newest row is also the app's cron heartbeat.
SELECT cron.schedule(
  'coach-insights-nightly',
  '15 3 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/coach-insights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Recomputes every tribe's fire tier from the week's activity.
SELECT cron.schedule(
  'tribe-fire-refresh',
  '20 3 * * *',
  $$ SELECT public.refresh_tribe_fire() $$
);

-- Analytics are kept 180 days and no longer.
SELECT cron.schedule(
  'analytics-retention',
  '30 4 * * *',
  $$ DELETE FROM public.analytics_events WHERE created_at < now() - interval '180 days' $$
);

-- Meal photos and their estimates are cached 30 days.
SELECT cron.schedule(
  'meal-scan-cache-retention',
  '40 4 * * *',
  $$ DELETE FROM public.meal_scan_cache WHERE created_at < now() - interval '30 days' $$
);

-- A deleted account can be restored for 30 days; after that the archive is only retained personal data.
SELECT cron.schedule(
  'archives-retention',
  '50 4 * * *',
  $$ DELETE FROM public.deleted_account_archives WHERE archived_at < now() - interval '30 days' $$
);

-- The morning numbers, plus the three silent-failure checks (money, push, cron).
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

-- The Sunday Briefing, delivered Monday morning.
SELECT cron.schedule(
  'weekly-briefing-generate',
  '0 6 * * 1',
  $$
    SELECT net.http_post(
      url     := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/weekly-briefing-generate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Closes the week's tribe challenges and books the results.
SELECT cron.schedule(
  'tribe-challenges-close',
  '10 0 * * 1',
  $$ SELECT public.close_tribe_challenges() $$
);

-- Tiered win-back pushes at 3, 7 and 14 days of silence.
SELECT cron.schedule(
  'winback-lapsed',
  '0 16 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/winback-lapsed',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);


-- Check the result:
--   SELECT jobname, schedule FROM cron.job ORDER BY jobname;
-- and the last runs:
--   SELECT jobname, status, return_message, start_time
--     FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
