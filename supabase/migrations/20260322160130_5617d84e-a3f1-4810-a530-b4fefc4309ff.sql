DROP POLICY IF EXISTS "Users can view own badges" ON public.user_badges;
CREATE POLICY "Badges viewable by everyone" ON public.user_badges FOR SELECT USING (true);