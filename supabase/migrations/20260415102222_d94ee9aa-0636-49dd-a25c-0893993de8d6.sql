
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own baselines" ON public.leaderboard_season_baselines;

-- Allow all authenticated users to read all baselines (needed for leaderboard computation)
CREATE POLICY "Authenticated can view all baselines"
ON public.leaderboard_season_baselines
FOR SELECT
TO authenticated
USING (true);
