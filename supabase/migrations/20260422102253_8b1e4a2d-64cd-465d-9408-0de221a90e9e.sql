
-- 1. Add video_url, comments_count, kudos_count, reported to tribe_posts
ALTER TABLE public.tribe_posts
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kudos_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reported boolean NOT NULL DEFAULT false;

-- 2. Tribe post comments (threaded)
CREATE TABLE IF NOT EXISTS public.tribe_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tribe_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.tribe_post_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tribe_post_comments_post ON public.tribe_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_tribe_post_comments_parent ON public.tribe_post_comments(parent_id);

ALTER TABLE public.tribe_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tribe comments viewable by tribe-visible viewers"
ON public.tribe_post_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tribe_posts p
    JOIN public.tribes t ON t.id = p.tribe_id
    WHERE p.id = tribe_post_comments.post_id
      AND (t.visibility = 'public' OR public.is_tribe_member(t.id, auth.uid()))
  )
);

CREATE POLICY "Tribe members can comment"
ON public.tribe_post_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_comments.post_id
      AND public.is_tribe_member(p.tribe_id, auth.uid())
  )
);

CREATE POLICY "Users can update own tribe comment"
ON public.tribe_post_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users or owners can delete tribe comment"
ON public.tribe_post_comments FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_comments.post_id
      AND public.is_tribe_owner(p.tribe_id, auth.uid())
  )
);

-- Trigger: keep comments_count up to date
CREATE OR REPLACE FUNCTION public.handle_tribe_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tribe_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tribe_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tribe_comment_count ON public.tribe_post_comments;
CREATE TRIGGER trg_tribe_comment_count
AFTER INSERT OR DELETE ON public.tribe_post_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_comment_count();

-- 3. Tribe post kudos (Apex-only by RLS, +10 XP via trigger)
CREATE TABLE IF NOT EXISTS public.tribe_post_kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tribe_posts(id) ON DELETE CASCADE,
  giver_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, giver_id)
);
CREATE INDEX IF NOT EXISTS idx_tribe_post_kudos_post ON public.tribe_post_kudos(post_id);
CREATE INDEX IF NOT EXISTS idx_tribe_post_kudos_giver ON public.tribe_post_kudos(giver_id);

ALTER TABLE public.tribe_post_kudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tribe kudos viewable by tribe-visible viewers"
ON public.tribe_post_kudos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tribe_posts p
    JOIN public.tribes t ON t.id = p.tribe_id
    WHERE p.id = tribe_post_kudos.post_id
      AND (t.visibility = 'public' OR public.is_tribe_member(t.id, auth.uid()))
  )
);

-- Apex/Legend or active Apex subscriber can give kudos to other tribe members' posts
CREATE POLICY "Apex tribe members can give kudos"
ON public.tribe_post_kudos FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = giver_id
  AND giver_id <> receiver_id
  AND EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_kudos.post_id
      AND public.is_tribe_member(p.tribe_id, auth.uid())
      AND p.user_id = tribe_post_kudos.receiver_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid()
      AND (
        pr.is_apex_subscriber = true
        OR pr.status_tier IN ('apex'::status_tier, 'legend'::status_tier)
      )
  )
);

CREATE POLICY "Users can remove own tribe kudos"
ON public.tribe_post_kudos FOR DELETE
TO authenticated
USING (auth.uid() = giver_id);

-- Trigger: kudos count + +10 XP to receiver
CREATE OR REPLACE FUNCTION public.handle_tribe_kudos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tribe_posts SET kudos_count = kudos_count + 1 WHERE id = NEW.post_id;
  UPDATE profiles SET xp = xp + 10, updated_at = now() WHERE user_id = NEW.receiver_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_tribe_kudos_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tribe_posts SET kudos_count = GREATEST(kudos_count - 1, 0) WHERE id = OLD.post_id;
  UPDATE profiles SET xp = GREATEST(xp - 10, 0), updated_at = now() WHERE user_id = OLD.receiver_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tribe_kudos_insert ON public.tribe_post_kudos;
CREATE TRIGGER trg_tribe_kudos_insert
AFTER INSERT ON public.tribe_post_kudos
FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_kudos_insert();

DROP TRIGGER IF EXISTS trg_tribe_kudos_delete ON public.tribe_post_kudos;
CREATE TRIGGER trg_tribe_kudos_delete
AFTER DELETE ON public.tribe_post_kudos
FOR EACH ROW EXECUTE FUNCTION public.handle_tribe_kudos_delete();

-- 4. Tribe post reports
CREATE TABLE IF NOT EXISTS public.tribe_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tribe_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tribe_post_reports_post ON public.tribe_post_reports(post_id);

ALTER TABLE public.tribe_post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and tribe owners can view tribe reports"
ON public.tribe_post_reports FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_reports.post_id
      AND public.is_tribe_owner(p.tribe_id, auth.uid())
  )
);

CREATE POLICY "Tribe members can report"
ON public.tribe_post_reports FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reporter_id
  AND EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_reports.post_id
      AND public.is_tribe_member(p.tribe_id, auth.uid())
  )
);

CREATE POLICY "Admins update tribe reports"
ON public.tribe_post_reports FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Allow admin delete + update on tribe_posts (for moderation)
DROP POLICY IF EXISTS "Admins can delete any tribe post" ON public.tribe_posts;
CREATE POLICY "Admins can delete any tribe post"
ON public.tribe_posts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update any tribe post" ON public.tribe_posts;
CREATE POLICY "Admins can update any tribe post"
ON public.tribe_posts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
