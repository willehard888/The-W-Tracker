-- ============================================================
-- One ranking order everywhere ("Consistency" = rank_score)
-- ============================================================
-- The Ranks page sorted rows by xp while the user's own #N came from
-- get_user_rank (rank_score) — a visible contradiction. Everything below
-- uses ONE window order: rank_score DESC, xp DESC, user_id (deterministic
-- tiebreak), universe rank_score > 0.
--   * get_user_rank — same signature, tiebreak added
--   * get_standings(p_limit) — rows in the identical order, so row #N ≡ RPC #N
--   * get_rank_score_breakdown — read-only copy of calculate_rank_score's
--     math for the in-app "how status works" explainer (never writes)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id uuid)
RETURNS TABLE(rank integer, total_users integer, percentile numeric, has_rank boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
  v_user_score numeric;
  v_rank integer;
  v_percentile numeric;
BEGIN
  SELECT count(*) INTO v_total FROM profiles WHERE rank_score > 0;
  SELECT rank_score INTO v_user_score FROM profiles WHERE user_id = p_user_id;

  IF v_user_score IS NULL OR v_user_score <= 0 OR v_total = 0 THEN
    rank := COALESCE(v_total, 0) + 1;
    total_users := COALESCE(v_total, 0);
    percentile := 0;
    has_rank := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT rn INTO v_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC, xp DESC, user_id) AS rn
    FROM profiles
    WHERE rank_score > 0
  ) r
  WHERE r.user_id = p_user_id;

  v_percentile := ((v_total - v_rank)::numeric / v_total::numeric) * 100;

  rank := v_rank;
  total_users := v_total;
  percentile := ROUND(v_percentile, 2);
  has_rank := true;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_standings(p_limit integer DEFAULT 50)
RETURNS TABLE(
  rank integer,
  user_id uuid,
  username text,
  avatar_url text,
  status_tier text,
  rank_score numeric,
  xp integer,
  streak integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (ROW_NUMBER() OVER (ORDER BY p.rank_score DESC, p.xp DESC, p.user_id))::integer AS rank,
    p.user_id,
    p.username,
    p.avatar_url,
    p.status_tier::text,
    p.rank_score,
    p.xp::integer,
    p.streak::integer
  FROM public.profiles p
  WHERE p.rank_score > 0
  ORDER BY p.rank_score DESC, p.xp DESC, p.user_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.get_standings(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_standings(integer) TO authenticated;

-- Read-only mirror of calculate_rank_score (which UPDATES profiles). Feeds
-- the explainer's "Consistency 71/100 = days active · daily XP · streak".
CREATE OR REPLACE FUNCTION public.get_rank_score_breakdown(p_user_id uuid)
RETURNS TABLE(
  active_days integer,
  active_days_score numeric,
  xp_score numeric,
  streak_score numeric,
  trust numeric,
  total numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_streak integer;
  v_trust numeric;
  v_avg7 numeric;
  v_max7 numeric;
  v_days integer;
  v_xp numeric;
  v_streak_s numeric;
  v_cons numeric;
BEGIN
  -- Own data only (or service role): the numbers are private.
  IF auth.uid() IS DISTINCT FROM p_user_id AND current_user IN ('authenticated', 'anon') THEN
    RETURN;
  END IF;
  SELECT streak, COALESCE(trust_multiplier, 1.0) INTO v_streak, v_trust FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(AVG(xp_earned), 0) INTO v_avg7
  FROM daily_checkins WHERE user_id = p_user_id AND checked_in_at >= now() - interval '7 days';
  SELECT COALESCE(MAX(sub.avg_xp), 1) INTO v_max7
  FROM (SELECT AVG(xp_earned) AS avg_xp FROM daily_checkins
        WHERE checked_in_at >= now() - interval '7 days' GROUP BY user_id) sub;
  v_xp := LEAST(100, (v_avg7 / GREATEST(v_max7, 1)) * 100);
  v_streak_s := LEAST(100, 25 * ln(COALESCE(v_streak, 0) + 1));
  SELECT count(DISTINCT date(checked_in_at)) INTO v_days
  FROM daily_checkins WHERE user_id = p_user_id AND checked_in_at >= now() - interval '30 days';
  v_cons := (v_days::numeric / 30.0) * 100;

  active_days := v_days;
  active_days_score := ROUND(v_cons, 1);
  xp_score := ROUND(v_xp, 1);
  streak_score := ROUND(v_streak_s, 1);
  trust := v_trust;
  total := ROUND((0.25 * v_xp + 0.20 * v_streak_s + 0.55 * v_cons) * v_trust, 2);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rank_score_breakdown(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rank_score_breakdown(uuid) TO authenticated;
