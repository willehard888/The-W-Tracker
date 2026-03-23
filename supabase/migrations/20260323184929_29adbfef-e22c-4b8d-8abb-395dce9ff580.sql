
-- Allow admins to delete any post
CREATE POLICY "Admins can delete any post"
ON public.feed_posts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any post (e.g. un-report)
CREATE POLICY "Admins can update any post"
ON public.feed_posts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view reports
CREATE POLICY "Admins can view reports"
ON public.reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update reports (resolve)
CREATE POLICY "Admins can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete comments
CREATE POLICY "Admins can delete any comment"
ON public.feed_comments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
