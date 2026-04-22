CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id uuid)
RETURNS TABLE(
  rank integer,
  total_users integer,
  percentile numeric,
  has_rank boolean
)
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
  -- Universe matches update_all_status_tiers: only profiles with rank_score > 0
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

  -- Rank: 1-based position when ordered by rank_score DESC
  SELECT rn INTO v_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles
    WHERE rank_score > 0
  ) r
  WHERE r.user_id = p_user_id;

  -- Percentile identical to update_all_status_tiers formula
  v_percentile := ((v_total - v_rank)::numeric / v_total::numeric) * 100;

  rank := v_rank;
  total_users := v_total;
  percentile := ROUND(v_percentile, 2);
  has_rank := true;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_rank(uuid) TO authenticated, anon;

-- Cleanup ghost tiers (e.g. High Performer with rank_score = 0)
SELECT public.update_all_status_tiers();