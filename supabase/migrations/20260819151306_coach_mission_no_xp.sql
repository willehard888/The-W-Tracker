-- ============================================================
-- Today's Plan missions no longer award XP.
--
-- Founder rule: XP comes ONLY from the daily check-in and from won
-- tribe battles (+ referral bonuses) — not from ticking coach missions.
-- complete_coach_mission still LOGS the completion (coach_mission_logs
-- drives the progress ring, done state and confetti — none of which
-- read XP), but it no longer writes profiles.xp. xp_awarded returns 0.
--
-- Safe: profiles.xp is not an input to rank math — calculate_rank_score
-- and update_status_tier read daily_checkins.xp_earned, so ranks, tiers
-- and the leaderboard are unaffected. This only stops cosmetic
-- XP-total inflation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_coach_mission(_plan_id uuid, _mission_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan record;
  v_mission jsonb;
  v_already boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_plan FROM public.coach_daily_plans WHERE id = _plan_id;
  IF NOT FOUND OR v_plan.user_id <> v_user THEN
    RETURN jsonb_build_object('error', 'plan_not_found');
  END IF;

  SELECT m INTO v_mission
  FROM jsonb_array_elements(v_plan.missions) m
  WHERE m->>'id' = _mission_id
  LIMIT 1;

  IF v_mission IS NULL THEN
    RETURN jsonb_build_object('error', 'mission_not_found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.coach_mission_logs
    WHERE daily_plan_id = _plan_id AND mission_id = _mission_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  -- Log the completion (progress ring / confetti read this), but award no XP.
  INSERT INTO public.coach_mission_logs(user_id, daily_plan_id, mission_id, xp_awarded)
  VALUES (v_user, _plan_id, _mission_id, 0);

  RETURN jsonb_build_object('ok', true, 'xp_awarded', 0);
END;
$$;

NOTIFY pgrst, 'reload schema';
