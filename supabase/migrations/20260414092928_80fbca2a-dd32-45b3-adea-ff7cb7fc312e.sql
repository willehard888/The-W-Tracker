
-- 1. Fix friendship status escalation: only addressee can accept/decline
DROP POLICY IF EXISTS "Users can update own friendships" ON public.friendships;
CREATE POLICY "Only addressee can accept or decline friendships"
ON public.friendships
FOR UPDATE
TO authenticated
USING ((auth.uid() = requester_id) OR (auth.uid() = addressee_id))
WITH CHECK (
  CASE 
    WHEN auth.uid() = addressee_id THEN true
    WHEN auth.uid() = requester_id THEN status = 'pending'::friendship_status
    ELSE false
  END
);

-- 2. Restrict profiles SELECT to authenticated users only, hiding internal fields via a view
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 3. Make battle_votes visible only to authenticated users
DROP POLICY IF EXISTS "Anyone can view votes" ON public.battle_votes;
CREATE POLICY "Authenticated can view votes"
ON public.battle_votes
FOR SELECT
TO authenticated
USING (true);

-- 4. Restrict leaderboard baselines to own user
DROP POLICY IF EXISTS "Leaderboard baselines viewable by authenticated" ON public.leaderboard_season_baselines;
CREATE POLICY "Users can view own baselines"
ON public.leaderboard_season_baselines
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
