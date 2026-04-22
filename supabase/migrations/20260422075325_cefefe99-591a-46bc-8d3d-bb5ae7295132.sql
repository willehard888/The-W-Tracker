
-- Ensure all tables have policies (linter requires at least one policy when RLS is on)
-- Direct mutations are blocked; everything goes through SECURITY DEFINER RPCs.

CREATE POLICY "No direct tribe insert"
ON public.tribes FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "No direct tribe update"
ON public.tribes FOR UPDATE TO authenticated USING (false);

CREATE POLICY "No direct tribe delete"
ON public.tribes FOR DELETE TO authenticated USING (false);

CREATE POLICY "No direct member insert"
ON public.tribe_members FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "No direct member update"
ON public.tribe_members FOR UPDATE TO authenticated USING (false);

CREATE POLICY "No direct member delete"
ON public.tribe_members FOR DELETE TO authenticated USING (false);
