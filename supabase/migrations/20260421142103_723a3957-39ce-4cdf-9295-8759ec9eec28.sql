ALTER TABLE public.feed_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.feed_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_feed_comments_parent_id ON public.feed_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_parent ON public.feed_comments(post_id, parent_id);