-- ============================================================
-- PILOT SETUP — run once in the Supabase SQL editor, AFTER the pilot
-- migrations have been applied: 20260901130000_pilot_access_codes and
-- 20260929090000_pilot_observation. Both were deployed on 29 September.
--
-- Run it in sections, top to bottom. Section 1 only looks; sections 2 and 3
-- change data. Nothing here is idempotent by accident — read each section's
-- note before running it.
--
-- Why the SQL editor and not the app: create_pilot_code() checks
-- has_role(auth.uid(), 'admin'), and auth.uid() is NULL in the SQL editor, so
-- the RPC would refuse. The editor runs with privileges that bypass RLS, so
-- the direct INSERT in section 3 is the intended path for seeding the first
-- code. Testers still redeem through the app's guarded RPC.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1) REVIEW — which accounts are cluttering the leaderboard?
--    Look before you delete. Everything with season points shows on the
--    Ranks board; everything else is already hidden by the client filter.
-- ─────────────────────────────────────────────────────────────
SELECT
  p.username,
  p.xp,
  p.level,
  p.streak,
  p.created_at,
  u.email,
  u.last_sign_in_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
ORDER BY p.xp DESC;


-- ─────────────────────────────────────────────────────────────
-- 2) DELETE test accounts.  ⚠️ DESTRUCTIVE AND PERMANENT.
--
--    profiles.user_id references auth.users(id) ON DELETE CASCADE, so
--    removing the auth user removes the profile, check-ins, posts, badges
--    and every other owned row with it. There is no undo.
--
--    EDIT THE LIST FIRST. It is deliberately not a pattern match — a
--    LIKE '%test%' would eventually catch a real member called "testosterone".
--    Verify each name against section 1 before running.
-- ─────────────────────────────────────────────────────────────
-- DELETE FROM auth.users
-- WHERE id IN (
--   SELECT user_id FROM public.profiles
--   WHERE username IN (
--     'qa_zombie_ly96',
--     'demo_user',
--     'r8n657yf2r',
--     'moi'
--   )
-- );


-- ─────────────────────────────────────────────────────────────
-- 3) CREATE the pilot code.
--
--    grant_days      how long free access lasts from the moment a tester
--                    redeems (not from today) — 90 covers a long pilot.
--    max_redemptions the whole pilot group can share ONE code; each person
--                    may redeem it once (enforced by a unique constraint).
--    expires_at      after this the code stops working even if slots remain.
--                    Set it so a leaked code can't be redeemed next year.
--
--    Change the code string before running. It goes out to testers as-is and
--    is compared case-insensitively.
-- ─────────────────────────────────────────────────────────────
-- Set cohort and observe_days HERE. Nothing in the app can set them
-- afterwards: pilot_codes carries a "No direct update" policy that refuses
-- every caller, so the only other route is a hand-written UPDATE in this
-- editor (preflight §5). A NULL cohort means the admin page cannot slice
-- the feedback it collects.
INSERT INTO public.pilot_codes
  (code, grant_days, max_redemptions, expires_at, note, cohort, observe_days, created_by)
SELECT
  'WHEALTH-PILOT',                     -- ← the code you hand to testers
  90,                                  -- ← days of free access per tester
  50,                                  -- ← how many testers may redeem it
  now() + interval '60 days',          -- ← code itself stops working then
  'Pilot group 1',
  'pilotti-1',                         -- ← cohort: how the admin page slices
  14,                                  -- ← days the pilot watches for
  p.user_id
FROM public.profiles p
WHERE p.username = 'willehard'
-- The unique index is on lower(code), deliberately — a column-level UNIQUE
-- would happily hold both 'Alpha' and 'alpha'. ON CONFLICT has to name the
-- same expression or Postgres refuses the statement outright.
ON CONFLICT (lower(code)) DO NOTHING;

-- If that inserted nothing, the username above does not exist. created_by is
-- NOT NULL, so a missing profile fails with a constraint error that names
-- the column and not the cause — check first:
--   SELECT username FROM public.profiles WHERE username ILIKE '%willehard%';


-- ─────────────────────────────────────────────────────────────
-- 4) VERIFY — the code exists, and who has redeemed it so far.
--    Re-run section 4 any time during the pilot to see uptake.
-- ─────────────────────────────────────────────────────────────
SELECT
  c.code,
  c.cohort,                            -- NULL here means the admin page is blind
  c.observe_days,
  c.grant_days,
  c.max_redemptions,
  c.expires_at,
  count(r.id) AS redeemed,
  c.max_redemptions - count(r.id) AS slots_left
FROM public.pilot_codes c
LEFT JOIN public.pilot_code_redemptions r ON r.code_id = c.id
GROUP BY c.id
ORDER BY c.created_at DESC;
