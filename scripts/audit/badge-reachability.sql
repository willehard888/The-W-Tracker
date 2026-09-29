-- Badge reachability (read-only). Every badge in the catalogue must name a
-- key that badge_stats() produces, or nobody can ever earn it — which is how
-- Top 1/5/10 % sat in the vault for six months with no producer.
--   supabase db query --linked -f scripts/audit/badge-reachability.sql
-- Raises on the first failure; prints one row per check otherwise.
DO $$
DECLARE missing text; s jsonb; dup text;
BEGIN
  s := public.badge_stats((SELECT user_id FROM profiles ORDER BY created_at LIMIT 1));
  ASSERT s IS NOT NULL, 'badge_stats returned NULL';

  -- 1. every requirement_type is a key of badge_stats (vault_master:* included)
  SELECT string_agg(DISTINCT b.requirement_type, ', ') INTO missing
    FROM badges b
   WHERE b.requirement_type IS NOT NULL AND NOT (s ? b.requirement_type);
  ASSERT missing IS NULL, 'unreachable requirement_type: ' || missing;

  -- 2. no alias spellings survive
  SELECT string_agg(DISTINCT requirement_type, ', ') INTO dup
    FROM badges WHERE requirement_type IN ('streak', 'personal_streak', 'cold_showers', 'total_xp', 'percentile', 'combat_workouts', 'run_workouts');
  ASSERT dup IS NULL, 'alias requirement_type still in the catalogue: ' || dup;

  -- 3. a value for every earnable badge
  ASSERT NOT EXISTS (SELECT 1 FROM badges WHERE requirement_type IS NOT NULL AND requirement_value IS NULL),
    'a badge names a requirement_type without a value';

  -- 4. grants: members read their own stats, nobody awards anyone else
  ASSERT NOT has_function_privilege('anon', 'public.badge_stats(uuid)', 'EXECUTE'), 'anon can read badge_stats';
  ASSERT has_function_privilege('authenticated', 'public.award_earned_badges()', 'EXECUTE'), 'members cannot run the award pass';
  ASSERT NOT has_function_privilege('authenticated', 'public.award_earned_badges_for(uuid)', 'EXECUTE'), 'members can award anyone';
  ASSERT NOT has_function_privilege('anon', 'public.award_earned_badges_for(uuid)', 'EXECUTE'), 'anon can award';

  -- 5. the bell trigger exists, the viral one is gone
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_badges_notify' AND tgrelid = 'public.user_badges'::regclass), 'no bell trigger on user_badges';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_check_viral_badge'), 'viral trigger still there';
END $$;

SELECT 'badges' AS what, count(*)::text AS value FROM badges
UNION ALL SELECT 'requirement_types', count(DISTINCT requirement_type)::text FROM badges
UNION ALL SELECT 'manual (no type)', count(*)::text FROM badges WHERE requirement_type IS NULL
UNION ALL SELECT 'stats keys', count(*)::text FROM jsonb_object_keys(public.badge_stats((SELECT user_id FROM profiles ORDER BY created_at LIMIT 1)));
