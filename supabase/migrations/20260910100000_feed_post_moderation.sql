-- Reporting a post on the global feed did nothing.
--
-- EliteFeed inserted a `reports` row (allowed) and then ran
-- `UPDATE feed_posts SET reported = true`. The only UPDATE policies on
-- feed_posts are author-only (auth.uid() = user_id) and global admin, and a
-- reporter is neither — the menu item only renders for posts you did NOT write.
-- So the update matched zero rows, PostgREST returned 200 with no error, the
-- "Post reported" toast fired, and the flag stayed false.
--
-- Two things read that flag, and both were dead:
--   * src/lib/feed-query.ts hides reported posts from the normal feed, so
--     reported content was never hidden from anyone;
--   * the admin "flagged posts" toggle just drops that filter, so it showed the
--     entire feed instead of the flagged subset.
--
-- Same fix as the tribe side (20260909120000_tribe_post_moderation.sql): the
-- flag becomes derived. No client can write it, so it cannot drift from the
-- reports that justify it.
--
-- Safe from recursion: the only UPDATE trigger on feed_posts is
-- update_updated_at_column (BEFORE UPDATE, touches updated_at); the moderation
-- trigger is AFTER INSERT only.

-- ── 1. One member reports one post once ──────────────────────
-- Without this a single member can report the same post repeatedly and inflate
-- the admin queue. De-duplicate first (keep the oldest per pair), then
-- constrain. Both steps are idempotent. `reports.post_id` is nullable, so the
-- constraint only binds rows that name a post.
DELETE FROM public.reports r
USING public.reports keep
WHERE r.post_id IS NOT NULL
  AND r.post_id = keep.post_id
  AND r.reporter_id = keep.reporter_id
  AND (keep.created_at, keep.id) < (r.created_at, r.id);

DROP INDEX IF EXISTS public.reports_post_reporter_key;
CREATE UNIQUE INDEX reports_post_reporter_key
  ON public.reports (post_id, reporter_id)
  WHERE post_id IS NOT NULL;

-- ── 2. `reported` is derived from the open reports ───────────
-- SECURITY DEFINER so the recompute bypasses the author-only UPDATE policy on
-- feed_posts — the whole point is that the reporter is not the author.
-- TG_OP is branched with IF/ELSE, never CASE: a plpgsql CASE expression compiles
-- to a single SQL query that touches the unassigned NEW record on DELETE and
-- raises.
CREATE OR REPLACE FUNCTION public.tg_feed_post_reported()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_post uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_post := OLD.post_id;
  ELSE
    v_post := NEW.post_id;
  END IF;

  -- A report can name something other than a feed post; nothing to flag then.
  IF v_post IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.feed_posts p
  SET reported = EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.post_id = v_post AND NOT r.resolved
  )
  WHERE p.id = v_post;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS reports_flag_ins ON public.reports;
CREATE TRIGGER reports_flag_ins
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_feed_post_reported();

DROP TRIGGER IF EXISTS reports_flag_upd ON public.reports;
CREATE TRIGGER reports_flag_upd
  AFTER UPDATE OF resolved ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_feed_post_reported();

DROP TRIGGER IF EXISTS reports_flag_del ON public.reports;
CREATE TRIGGER reports_flag_del
  AFTER DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_feed_post_reported();

-- ── 3. Light today's flags ───────────────────────────────────
-- Every report filed while the flag write was silently failing is still sitting
-- unresolved. Sync once so the admin view and the hide-filter agree with the
-- reports table. The WHERE clause makes a re-run a no-op.
UPDATE public.feed_posts p
SET reported = EXISTS (
  SELECT 1 FROM public.reports r
  WHERE r.post_id = p.id AND NOT r.resolved
)
WHERE p.reported IS DISTINCT FROM EXISTS (
  SELECT 1 FROM public.reports r
  WHERE r.post_id = p.id AND NOT r.resolved
);

NOTIFY pgrst, 'reload schema';
