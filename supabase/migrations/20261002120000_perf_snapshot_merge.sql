-- Two writers share coach_performance_snapshots: the nightly Whealth Index
-- (coach-insights — performance_score = the index, components.pillars …) and
-- the weekly review (coach-weekly-review via this RPC — components.sleep_pts,
-- train_pts, …). The RPC replaced the whole row, so a review generated on a
-- day the index had already scored erased that day's pillars and overwrote
-- the index with the review's own 0–100 (seen on the simulator: Profile
-- "Whealth Index 82 · Last scored Sep 17" while rows for Oct 1–2 existed).
-- Now that the review writes itself every week, the collision is weekly.
--
-- Merge instead: the review's keys are added to whatever the row holds, and
-- the index score stands once the pillars are there.

CREATE OR REPLACE FUNCTION public.upsert_performance_snapshot(
  _snapshot_date date,
  _performance_score int,
  _components jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.coach_performance_snapshots (user_id, snapshot_date, performance_score, components)
  VALUES (uid, _snapshot_date, GREATEST(0, LEAST(100, _performance_score)), COALESCE(_components, '{}'::jsonb))
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    performance_score = CASE
      WHEN coach_performance_snapshots.components ? 'pillars' THEN coach_performance_snapshots.performance_score
      ELSE EXCLUDED.performance_score
    END,
    components = COALESCE(coach_performance_snapshots.components, '{}'::jsonb) || EXCLUDED.components
  RETURNING id INTO rid;
  RETURN rid;
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_performance_snapshot(date,int,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upsert_performance_snapshot(date,int,jsonb) TO authenticated;
