
-- Allow admins to delete any battle
CREATE POLICY "Admins can delete any battle"
ON public.battles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any battle (cancel/resolve)
CREATE POLICY "Admins can update any battle"
ON public.battles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
