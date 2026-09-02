-- ───────────────────────────────────────────────────────────────────────
-- recreate-cron-jobs.sql
--
-- Re-create the scheduled pg_cron jobs that Lovable Cloud's UI set up
-- on the source project. Run this AFTER migrate-from-lovable.sh has
-- moved the schema + data, AND after enabling the pg_cron extension on
-- the destination project (Dashboard → Database → Extensions → enable
-- "pg_cron" + "pg_net").
--
-- Before running, replace these placeholders globally in the file:
--   NEW_REF         → your destination project ref (e.g. gcwuvijcuzhunkcauzom)
--   SERVICE_ROLE_KEY → destination project's service_role key
--                      (Settings → API → "service_role" "secret")
--
-- Then paste the whole file into Dashboard → SQL Editor → Run.
-- pg_cron schedules survive across deploys and are idempotent: re-running
-- with the same job name updates the schedule instead of duplicating.
-- ───────────────────────────────────────────────────────────────────────

-- daily-reminder was RETIRED 2026-09-02: the client-side local notification
-- owns the 20:00 streak warning (exact streak count, works offline), so the
-- server push would have doubled every banner. Unschedule if present.
DO $do$ BEGIN
  PERFORM cron.unschedule('daily-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

-- Lapsed win-back (push) — daily 16:00 UTC. Tiered messages fire once each at
-- 3 / 7 / 14 days of inactivity (exact-day match, no dedup table needed).
SELECT cron.schedule(
  'winback-lapsed',
  '0 16 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://NEW_REF.supabase.co/functions/v1/winback-lapsed',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Sync streaks (recompute streak deadlines, decay missed days) — daily 03:00 UTC
SELECT cron.schedule(
  'sync-streaks',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://NEW_REF.supabase.co/functions/v1/sync-streaks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Resolve battles (finalize finished battles, award winners) — every 15 minutes
SELECT cron.schedule(
  'resolve-battles',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://NEW_REF.supabase.co/functions/v1/resolve-battles',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Coach morning nudge — 07:30 in the user's local TZ; cron fires hourly,
-- the function self-filters which users to ping based on their tz/profile.
SELECT cron.schedule(
  'coach-morning-nudge',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://NEW_REF.supabase.co/functions/v1/coach-morning-nudge',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- NOTE: coach-weekly-review is deliberately NOT cron-scheduled. The function
-- authenticates a USER JWT (auth.getUser), so a service-role cron call 401s —
-- it silently failed every Sunday until removed (2026-08-10). The review is
-- generated on-demand from the client (PerformanceOSDashboard).

-- Coach proactive — hourly; per-user local-time triggers (recovery crash,
-- streak-at-risk evening save, morning intention) with kind-scoped dedup.
SELECT cron.schedule(
  'coach-proactive-hourly',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://NEW_REF.supabase.co/functions/v1/coach-proactive',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Weekly briefing generate — Sundays 18:00 UTC
SELECT cron.schedule(
  'weekly-briefing-generate',
  '0 18 * * 0',
  $$
    SELECT net.http_post(
      url     := 'https://NEW_REF.supabase.co/functions/v1/weekly-briefing-generate',
      headers := jsonb_build_object(
        'Authorization', 'Bearer SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- Sanity check — list every job that's now scheduled.
SELECT jobname, schedule FROM cron.job ORDER BY jobname;
