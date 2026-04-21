-- Add updated_at to feed_comments to track edits
ALTER TABLE public.feed_comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Allow users to update only their own comments
DROP POLICY IF EXISTS "Users can update own comments" ON public.feed_comments;
CREATE POLICY "Users can update own comments"
  ON public.feed_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);