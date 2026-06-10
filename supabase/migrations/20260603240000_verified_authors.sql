-- ============================================================
-- verified_authors(ids[]) — given a set of users, return the subset who have
-- a HealthKit-verified check-in in the last 21 days. SECURITY DEFINER because
-- daily_checkins RLS otherwise blocks reading other users' rows. Used by the
-- feed to mark verified posts (real, not self-reported).
-- ============================================================
CREATE OR REPLACE FUNCTION public.verified_authors(p_ids uuid[])
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT dc.user_id), '{}')
  FROM public.daily_checkins dc
  WHERE dc.user_id = ANY(p_ids)
    AND dc.verified_at IS NOT NULL
    AND dc.checked_in_at >= now() - interval '21 days';
$$;

GRANT EXECUTE ON FUNCTION public.verified_authors(uuid[]) TO authenticated;
