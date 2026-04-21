-- 1. moderation_cache
CREATE TABLE public.moderation_cache (
  image_hash text PRIMARY KEY,
  action text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0,
  severity text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_cache_created_at ON public.moderation_cache(created_at);

ALTER TABLE public.moderation_cache ENABLE ROW LEVEL SECURITY;

-- No public policies — only service role can access (service_role bypasses RLS)

-- 2. moderation_queue
CREATE TABLE public.moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid,
  image_url text,
  text_content text,
  user_id uuid NOT NULL,
  ai_action text NOT NULL,
  ai_confidence numeric NOT NULL DEFAULT 0,
  ai_categories text[] NOT NULL DEFAULT '{}',
  ai_reason text,
  severity text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_queue_status_created ON public.moderation_queue(status, created_at DESC);

ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation queue"
  ON public.moderation_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update moderation queue"
  ON public.moderation_queue FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. content_moderations expansion
ALTER TABLE public.content_moderations
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latency_ms integer;