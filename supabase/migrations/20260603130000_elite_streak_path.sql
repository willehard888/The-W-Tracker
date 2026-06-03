-- ============================================================
-- Make Elite reachable WITHOUT a rank percentile
-- ============================================================
-- Problem: in a small/early user base, "top 20% by rank score" is effectively
-- unreachable — there aren't enough ranked users for a percentile to be
-- meaningful, so Elite stayed locked no matter how disciplined a solo user was.
--
-- Fix: keep the rank path as ONE way in, but add a clear, rank-independent
-- grind path: a 30-day current streak + 20 active days in the last 30. This is
-- fully within a single user's control. High Performer keeps its existing
-- OR grind path. Apex stays rank-gated (top 10%) by design.
--
-- Only the tier-threshold block changed vs. the previous definition; the
-- legend/apex/subscriber/early-return guards are preserved verbatim.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
  user_score numeric;
  is_pinned_legend boolean;
  is_apex_sub boolean;
  apex_credits timestamptz;
BEGIN
  SELECT legend_pinned, is_apex_subscriber, apex_credits_until
    INTO is_pinned_legend, is_apex_sub, apex_credits
    FROM profiles WHERE user_id = target_user_id;

  -- Legend is INVITE-ONLY: only achievable via redeem_legend_invite.
  IF COALESCE(is_pinned_legend, false) THEN
    UPDATE profiles SET status_tier = 'legend' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  PERFORM calculate_rank_score(target_user_id);
  SELECT rank_score INTO user_score FROM profiles WHERE user_id = target_user_id;

  IF COALESCE(is_apex_sub, false) OR (apex_credits IS NOT NULL AND apex_credits > now()) THEN
    UPDATE profiles SET status_tier = 'apex' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  IF user_score IS NULL OR user_score <= 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles SET status_tier = 'recruit' WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT rn INTO user_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles WHERE rank_score > 0
  ) r WHERE r.user_id = target_user_id;

  percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';

  SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = target_user_id;

  -- Apex stays rank-gated (invite/subscriber handled above; this is the earned
  -- top-10% path). Elite + High Performer are reachable by rank OR the grind.
  IF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN
    new_tier := 'apex';
  ELSIF percentile >= 80 OR (user_streak >= 30 AND activity_days >= 20) THEN
    new_tier := 'elite';
  ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14) THEN
    new_tier := 'high_performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN
    new_tier := 'performer';
  ELSIF percentile >= 25 AND activity_days >= 5 THEN
    new_tier := 'operator';
  ELSE
    new_tier := 'recruit';
  END IF;

  UPDATE profiles SET status_tier = new_tier WHERE user_id = target_user_id;
END;
$$;
