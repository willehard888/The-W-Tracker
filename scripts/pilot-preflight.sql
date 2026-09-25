-- PILOT PREFLIGHT — run this in the Supabase SQL editor before handing out a
-- single code. Every section answers one question that, answered wrongly on the
-- day, looks to a tester like a broken app rather than a missing deploy.
--
-- Read-only except section 5, which is the one deliberate write.
--
-- Companion to scripts/pilot-setup.sql, which seeds the code itself. That file
-- explains why seeding happens here and not in the app: create_pilot_code()
-- checks has_role(auth.uid(), 'admin'), and auth.uid() is NULL in the SQL
-- editor, so the RPC would refuse. The editor bypasses RLS, so a direct INSERT
-- is the intended path for the first code. Testers still redeem through the
-- app's guarded RPC.


-- ── 1. Is everything actually deployed? ─────────────────────────────────────
--
-- The app fails open on all of these, which is what you want in production and
-- exactly what makes them invisible: a missing migration produces silence, not
-- an error. Every row below must say true.

SELECT
  to_regprocedure('public.pilot_context()')            IS NOT NULL AS pilot_context_exists,
  to_regprocedure('public.pilot_submit_feedback(text, text, smallint, text, text, jsonb, text)')
                                                       IS NOT NULL AS submit_feedback_exists,
  to_regclass('public.pilot_feedback')                 IS NOT NULL AS feedback_table_exists,
  to_regclass('public.pilot_prompt_log')               IS NOT NULL AS prompt_log_exists,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pilot_codes' AND column_name = 'observe_days')  AS observe_days_exists;


-- ── 2. The one that bites hardest: the onboarding allowlist ────────────────
--
-- `onboarding_valid_event` is a hardcoded list and all four write RPCs check
-- it. An event id that exists in TypeScript but not here is dropped SILENTLY:
-- the card shows, the tester dismisses it, nothing persists, and it comes back
-- on every single launch, forever. A tester would report that as the app being
-- broken, and they would be right.
--
-- Both must be true. If they are not, migration 20260922110000 has not run.

SELECT
  public.onboarding_valid_event('RECOVERY_INTRO')          AS recovery_intro_ok,
  public.onboarding_valid_event('RECOVERY_REST_DAY_INTRO') AS recovery_rest_day_ok,
  public.onboarding_valid_event('TRAINING_PROGRAM_READY')  AS training_ready_ok;


-- ── 3. Are the testers' accounts grandfathered? ────────────────────────────
--
-- Migration 20260831130000 stamped grandfathered=true on every profile that
-- existed when contextual onboarding shipped. For those accounts isEligible()
-- returns false for EVERY event and all four RPCs refuse to write — so they see
-- no teaching cards at all, including any added later.
--
-- It only matters for testers given an EXISTING account. A tester who signs up
-- fresh is fine.
--
-- Replace the usernames. Expect grandfathered = false for anybody who should be
-- taught the app.

SELECT
  p.username,
  p.created_at::date                                          AS signed_up,
  COALESCE(p.onboarding_state->>'grandfathered', 'false')     AS grandfathered,
  p.onboarded_at IS NOT NULL                                  AS finished_onboarding,
  COALESCE(p.timezone, '(null → UTC)')                        AS timezone
FROM public.profiles p
WHERE p.username IN ('replace-me', 'and-me')
ORDER BY p.created_at;

-- To un-grandfather a tester so they DO get the teaching cards — only for an
-- account that has genuinely not seen them:
--
-- UPDATE public.profiles
-- SET onboarding_state = onboarding_state || jsonb_build_object('grandfathered', false, 'status', 'not_started')
-- WHERE username IN ('replace-me');
--
-- Note mergeStates() in src/lib/onboarding/state.ts treats grandfathered as
-- sticky (local || incoming), so a device that has already synced the true
-- value keeps it until that install is cleared. Do this BEFORE the tester
-- installs, not after.


-- ── 4. Timezone, because the day counter depends on it ─────────────────────
--
-- pilot_context() counts days AT TIME ZONE COALESCE(profiles.timezone, 'UTC').
-- A NULL timezone is not fatal — it means their day rolls over at 03:00 local
-- in Finland instead of midnight, so a checkpoint can land a few hours early.
-- touch_activity fills it on the first heartbeat after install, so this is
-- expected to be NULL before anybody has opened the app.

SELECT COALESCE(timezone, '(null)') AS timezone, count(*) AS testers
FROM public.profiles p
WHERE EXISTS (SELECT 1 FROM public.pilot_code_redemptions r WHERE r.user_id = p.user_id)
GROUP BY 1 ORDER BY 2 DESC;


-- ── 5. Name the cohort and set the window ──────────────────────────────────
--
-- THE ONE WRITE IN THIS FILE.
--
-- `grant_days` is how long they get IN (90 by default). `observe_days` is how
-- long we WATCH (14). They are different numbers on purpose: access should not
-- evaporate in the tester's hand the moment we stop looking, and nothing has to
-- be unwound when the pilot ends. The app says so at redemption.

UPDATE public.pilot_codes
SET cohort = 'pilot-1',
    observe_days = 14
WHERE lower(code) = lower('WHEALTH-PILOT');

SELECT code, cohort, grant_days, observe_days, max_redemptions, expires_at
FROM public.pilot_codes
ORDER BY created_at DESC;


-- ── 6. Capacity, and who is in ─────────────────────────────────────────────

SELECT
  c.code,
  c.cohort,
  c.max_redemptions,
  count(r.id)                          AS redeemed,
  c.max_redemptions - count(r.id)      AS slots_left,
  c.expires_at,
  c.expires_at < now()                 AS code_has_expired
FROM public.pilot_codes c
LEFT JOIN public.pilot_code_redemptions r ON r.code_id = c.id
GROUP BY c.id
ORDER BY c.created_at DESC;


-- ── 7. What each tester's app will actually be told ────────────────────────
--
-- pilot_context() reads auth.uid(), which is NULL in the editor, so it cannot
-- be called here. This reproduces its arithmetic for every tester instead — if
-- a day looks wrong, it is wrong in the app too.

SELECT
  p.username,
  c.cohort,
  r.redeemed_at::date AS day_zero,
  GREATEST(0, (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
             - (r.redeemed_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date) AS day,
  c.observe_days,
  GREATEST(0, (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
             - (r.redeemed_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date) <= c.observe_days AS in_window,
  p.membership_credits_until::date AS access_until
FROM public.pilot_code_redemptions r
JOIN public.pilot_codes c ON c.id = r.code_id
JOIN public.profiles p    ON p.user_id = r.user_id
ORDER BY r.redeemed_at DESC;


-- ── 8. Mid-pilot: who needs a message ──────────────────────────────────────
--
-- Not a dashboard. In a twenty-person pilot, "has not opened the app in three
-- days" is a name you message, and "started onboarding and never finished it"
-- is a bug report you have not received yet.

SELECT
  p.username,
  (p.onboarded_at IS NOT NULL)                                   AS finished_onboarding,
  (SELECT max(ae.created_at)::date FROM public.analytics_events ae
    WHERE ae.user_id = p.user_id AND ae.event = 'app_opened')     AS last_open,
  (SELECT count(*) FROM public.daily_checkins dc WHERE dc.user_id = p.user_id)          AS checkins,
  (SELECT count(*) FROM public.coach_program_logs cl
    WHERE cl.user_id = p.user_id AND cl.completed)                                      AS workouts,
  (SELECT count(*) FROM public.pilot_feedback f WHERE f.user_id = p.user_id)            AS feedback_given
FROM public.profiles p
WHERE EXISTS (SELECT 1 FROM public.pilot_code_redemptions r WHERE r.user_id = p.user_id)
ORDER BY last_open NULLS FIRST;
