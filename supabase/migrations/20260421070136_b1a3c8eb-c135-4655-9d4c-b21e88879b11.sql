-- AI moderation results table
CREATE TABLE public.content_moderations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('proof', 'feed_post')),
  content_id uuid,
  image_url text,
  text_content text,
  is_safe boolean NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0,
  reason text,
  action text NOT NULL CHECK (action IN ('allow', 'flag', 'block')),
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_moderations_content ON public.content_moderations(content_type, content_id);
CREATE INDEX idx_content_moderations_action ON public.content_moderations(action, created_at DESC);

ALTER TABLE public.content_moderations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderations"
ON public.content_moderations FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update moderations"
ON public.content_moderations FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));