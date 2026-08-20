-- ============================================================
-- S7a: SERVER-SIDE moderation enforcement (deferred from S5).
--
-- Until now moderation was client-orchestrated only: the app called
-- moderate-content BEFORE inserting, but feed_posts/tribe_posts allow
-- direct INSERT — a client that skips the call posts unmoderated
-- content to everyone.
--
-- Model: posts insert as 'pending'. The author sees their own post
-- instantly; everyone else sees it only once the server-side pass
-- flips it to 'approved'. An AFTER INSERT trigger fans out to the
-- moderate-content edge function (service role), which moderates the
-- stored image AND caption together and updates the status. A sweeper
-- cron approves anything stuck pending >10 min (fail-open with a
-- human-review queue row) so a hung function can never make posts
-- vanish forever.
-- ============================================================

-- ── 1. Status columns ────────────────────────────────────────
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
  CHECK (moderation_status IN ('pending','approved','blocked'));
ALTER TABLE public.tribe_posts
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
  CHECK (moderation_status IN ('pending','approved','blocked'));

-- Existing content was already client-moderated at creation — grandfather it.
UPDATE public.feed_posts SET moderation_status = 'approved' WHERE moderation_status = 'pending';
UPDATE public.tribe_posts SET moderation_status = 'approved' WHERE moderation_status = 'pending';

CREATE INDEX IF NOT EXISTS feed_posts_modstatus_idx ON public.feed_posts (moderation_status) WHERE moderation_status = 'pending';
CREATE INDEX IF NOT EXISTS tribe_posts_modstatus_idx ON public.tribe_posts (moderation_status) WHERE moderation_status = 'pending';

-- ── 2. RLS: others see only approved; your own post is always yours ─
DROP POLICY IF EXISTS "Feed viewable by members" ON public.feed_posts;
CREATE POLICY "Feed viewable by members" ON public.feed_posts
  FOR SELECT TO authenticated
  USING (moderation_status = 'approved' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Tribe posts viewable by members or public" ON public.tribe_posts;
CREATE POLICY "Tribe posts viewable by members or public"
ON public.tribe_posts FOR SELECT TO authenticated
USING (
  (moderation_status = 'approved' OR user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tribes t
    WHERE t.id = tribe_id
      AND (t.visibility = 'public' OR is_tribe_member(t.id, auth.uid()))
  )
);

-- Realtime evaluates the subscriber's SELECT policy per row; non-PK columns
-- in that check need the full old/new row in the WAL payload.
ALTER TABLE public.tribe_posts REPLICA IDENTITY FULL;

-- ── 3. INSERT trigger → moderate-content (service role) ──────
CREATE OR REPLACE FUNCTION public.tg_post_moderate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/moderate-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'server_enforce', true,
        'table', TG_TABLE_NAME,
        'content_id', NEW.id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- a moderation dispatch failure must never abort the post
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS feed_posts_moderate ON public.feed_posts;
CREATE TRIGGER feed_posts_moderate
  AFTER INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_post_moderate();

DROP TRIGGER IF EXISTS tribe_posts_moderate ON public.tribe_posts;
CREATE TRIGGER tribe_posts_moderate
  AFTER INSERT ON public.tribe_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_post_moderate();

-- ── 4. Sweeper — fail-open with audit after 10 min ───────────
-- If the edge function never ran (outage, pg_net hiccup), the post must not
-- stay invisible forever. Approve stale pendings and queue them for human
-- review so nothing ships unmoderated silently.
CREATE OR REPLACE FUNCTION public.approve_stale_pending_posts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.moderation_queue (content_type, content_id, user_id, image_url, text_content, ai_action, ai_reason)
  SELECT 'feed_post', p.id, p.user_id, p.image_url, p.content, 'flag', 'auto-approved: moderation did not run within 10 min'
  FROM public.feed_posts p
  WHERE p.moderation_status = 'pending' AND p.created_at < now() - interval '10 minutes';

  UPDATE public.feed_posts
  SET moderation_status = 'approved'
  WHERE moderation_status = 'pending' AND created_at < now() - interval '10 minutes';

  INSERT INTO public.moderation_queue (content_type, content_id, user_id, image_url, text_content, ai_action, ai_reason)
  SELECT 'tribe_post', p.id, p.user_id, p.image_url, p.content, 'flag', 'auto-approved: moderation did not run within 10 min'
  FROM public.tribe_posts p
  WHERE p.moderation_status = 'pending' AND p.created_at < now() - interval '10 minutes';

  UPDATE public.tribe_posts
  SET moderation_status = 'approved'
  WHERE moderation_status = 'pending' AND created_at < now() - interval '10 minutes';
END $$;

REVOKE ALL ON FUNCTION public.approve_stale_pending_posts() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule('moderation-sweeper');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('moderation-sweeper', '*/5 * * * *',
    'SELECT public.approve_stale_pending_posts()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule moderation-sweeper manually';
END $$;
