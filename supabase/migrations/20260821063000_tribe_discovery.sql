-- ============================================================
-- Tribe discovery — "N/M lit today" pulse for the browse list.
--
-- The list page wants a live social-proof signal per tribe: how many
-- members have fed the fire today. daily_checkins is RLS-protected, so
-- the client cannot compute this — a SECURITY DEFINER aggregate is the
-- only safe shape. Body adapted from tribe_fire_at_risk()'s
-- today/tribe_stats CTEs (20260819070302), minus the HAVING gate and
-- the per-user anti-join: this one returns per-tribe counts only,
-- never who is missing (no member-level leakage).
-- ============================================================

CREATE OR REPLACE FUNCTION public.tribe_today_pulse(p_tribe_ids uuid[])
RETURNS TABLE (tribe_id uuid, checked int, total int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (
    -- Clamp: the browse page shows at most 50 tribes; never aggregate
    -- an unbounded id list.
    SELECT DISTINCT unnest(p_tribe_ids[1:60]) AS tid
  ),
  today AS (
    SELECT DISTINCT dc.user_id
    FROM daily_checkins dc
    WHERE dc.checked_in_at >= date_trunc('day', now())
  )
  SELECT tm.tribe_id,
         (count(*) FILTER (WHERE td.user_id IS NOT NULL))::int AS checked,
         count(*)::int AS total
  FROM tribe_members tm
  JOIN ids ON ids.tid = tm.tribe_id
  LEFT JOIN today td ON td.user_id = tm.user_id
  WHERE tm.status = 'active'
  GROUP BY tm.tribe_id;
$$;

REVOKE ALL ON FUNCTION public.tribe_today_pulse(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tribe_today_pulse(uuid[]) TO authenticated;
