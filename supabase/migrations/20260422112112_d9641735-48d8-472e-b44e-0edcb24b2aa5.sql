-- Fix get_user_rank: "Ahead of X%" should mean fraction of OTHER ranked users you beat.
-- Old formula: (total - rank) / total * 100  → #1 of 5 returned 80% (wrong; should be 100%).
-- New formula: (total - rank) / max(total - 1, 1) * 100 → #1 = 100%, last = 0%.
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
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles
    WHERE rank_score > 0
  ) r
  WHERE r.user_id = p_user_id;

  -- "Ahead of X%": fraction of OTHER ranked users you beat.
  -- #1 of N => 100%, last => 0%, single user => 100%.
  IF v_total <= 1 THEN
    v_percentile := 100;
  ELSE
    v_percentile := ((v_total - v_rank)::numeric / (v_total - 1)::numeric) * 100;
  END IF;

  rank := v_rank;
  total_users := v_total;
  percentile := ROUND(v_percentile, 2);
  has_rank := true;
  RETURN NEXT;
END;
$function$;