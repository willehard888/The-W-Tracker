-- XP v3 invariant (read-only): profiles.xp = Σ daily_checkins.xp_earned
--                              + 15 × Vault practice days.
-- Every other writer of profiles.xp was retired in 20260925100000. A row
-- here is a drift to explain, not to patch by hand.
--   supabase db query -f scripts/audit/xp-invariant.sql   (or psql on :5499)
WITH days AS (
  SELECT user_id, COALESCE(SUM(xp_earned), 0) AS xp FROM public.daily_checkins GROUP BY user_id
), practice AS (
  SELECT user_id, count(DISTINCT practiced_at::date) * 15 AS xp
    FROM public.vault_lesson_progress WHERE practiced_at IS NOT NULL GROUP BY user_id
), expect AS (
  SELECT p.user_id, p.username, p.xp AS have,
         COALESCE(d.xp, 0) + COALESCE(v.xp, 0) AS want,
         p.level AS level_have, floor((COALESCE(d.xp, 0) + COALESCE(v.xp, 0)) / 500) + 1 AS level_want
    FROM public.profiles p
    LEFT JOIN days d ON d.user_id = p.user_id
    LEFT JOIN practice v ON v.user_id = p.user_id
)
SELECT user_id, username, have, want, have - want AS drift, level_have, level_want
  FROM expect
 WHERE have <> want OR level_have <> level_want
 ORDER BY abs(have - want) DESC;
