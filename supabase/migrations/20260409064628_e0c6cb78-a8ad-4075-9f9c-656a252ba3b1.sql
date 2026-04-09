
DROP POLICY IF EXISTS "Leaderboard baselines viewable by everyone" ON public.leaderboard_season_baselines;
CREATE POLICY "Leaderboard baselines viewable by authenticated"
ON public.leaderboard_season_baselines
FOR SELECT
TO authenticated
USING (true);
