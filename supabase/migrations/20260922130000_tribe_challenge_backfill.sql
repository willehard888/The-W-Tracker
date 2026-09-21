-- The weekly challenge row is created lazily — by the Monday cron, or by the
-- first member to open the tribe that week — and the check-in trigger only
-- increments rows that already exist. A tribe opened after its members had
-- checked in read "0/20 check-ins together" beside "1/4 lit today" on the
-- same screen. The row now starts from this week's check-ins.

CREATE OR REPLACE FUNCTION public.ensure_tribe_challenge(p_tribe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week date := date_trunc('week', now())::date;
  v_members int;
  v_done int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tribes WHERE id = p_tribe_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM tribe_challenges WHERE tribe_id = p_tribe_id AND week_start = v_week) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO v_members FROM tribe_members
  WHERE tribe_id = p_tribe_id AND status = 'active';
  -- Check-ins already made this week by today's active members.
  SELECT count(*) INTO v_done
  FROM daily_checkins dc
  JOIN tribe_members tm ON tm.user_id = dc.user_id
  WHERE tm.tribe_id = p_tribe_id
    AND tm.status = 'active'
    AND dc.checked_in_at >= v_week;
  INSERT INTO tribe_challenges (tribe_id, week_start, target, progress)
  VALUES (p_tribe_id, v_week, GREATEST(5, v_members * 5), v_done)
  ON CONFLICT (tribe_id, week_start) DO NOTHING;
END $$;

-- This week's rows that were created empty after check-ins had happened.
UPDATE public.tribe_challenges c
SET progress = GREATEST(c.progress, (
  SELECT count(*) FROM daily_checkins dc
  JOIN tribe_members tm ON tm.user_id = dc.user_id
  WHERE tm.tribe_id = c.tribe_id AND tm.status = 'active'
    AND dc.checked_in_at >= c.week_start
))
WHERE c.week_start = date_trunc('week', now())::date AND c.status = 'active';
