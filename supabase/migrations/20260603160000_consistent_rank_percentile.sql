-- ============================================================
-- One percentile definition everywhere
-- ============================================================
-- get_user_rank used (N - rank) / (N - 1) → #1 = 100%, while update_status_tier
-- (which decides Elite/Apex) and the Ranks page use (N - rank) / N → #1 of 9 =
-- ~89%. That mismatch showed "Ahead of 100.0%" on Home and a 100% Road-to-Elite
-- bar while the tier said High Performer. Align get_user_rank to the tier
-- formula so the displayed "ahead of X%" matches what actually gates tiers.
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
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles
    WHERE rank_score > 0
  ) r
  WHERE r.user_id = p_user_id;

  -- Same definition as update_status_tier + the Ranks page: fraction of the
  -- ranked field you're ahead of. #1 of N => (N-1)/N, last => 0.
  v_percentile := ((v_total - v_rank)::numeric / v_total::numeric) * 100;

  rank := v_rank;
  total_users := v_total;
  percentile := ROUND(v_percentile, 2);
  has_rank := true;
  RETURN NEXT;
END;
$function$;
