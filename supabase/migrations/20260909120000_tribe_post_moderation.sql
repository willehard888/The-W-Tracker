-- Tribe post moderation was dead in production.
--
-- Reporting a post inserted a tribe_post_reports row and then ran
-- `UPDATE tribe_posts SET reported = true`. The only UPDATE policies on
-- tribe_posts are author-only (auth.uid() = user_id) and global admin, so a
-- reporting member matched zero rows: PostgREST returns no error, the client
-- toasted success, and the flag stayed false. The owner's "N posts need your
-- review" door counts that flag, so the reports dialog was unreachable for
-- every real user. Dismiss failed the same silent way, twice: tribe_post_reports
-- UPDATE was admin-only too.
--
-- The fix makes `reported` derived instead of client-written: a trigger on
-- tribe_post_reports recomputes it, and tribe owners get the UPDATE policy they
-- need to resolve a report. No client can set the flag any more, so it can no
-- longer drift from the reports that justify it.
--
-- Safe from recursion: the only trigger on tribe_posts is `tribe_posts_moderate`
-- (AFTER INSERT only, 20260822070000_moderation_enforcement.sql), so the
-- recompute UPDATE below cannot re-fire it.

-- ── 1. One member reports one post once ──────────────────────
-- Without this, a single member can report the same post repeatedly and inflate
-- the owner's badge. De-duplicate first (keep the oldest report per pair), then
-- constrain. Both steps are idempotent.
DELETE FROM public.tribe_post_reports r
USING public.tribe_post_reports keep
WHERE r.post_id = keep.post_id
  AND r.reporter_id = keep.reporter_id
  AND (keep.created_at, keep.id) < (r.created_at, r.id);

ALTER TABLE public.tribe_post_reports
  DROP CONSTRAINT IF EXISTS tribe_post_reports_post_reporter_key;
ALTER TABLE public.tribe_post_reports
  ADD CONSTRAINT tribe_post_reports_post_reporter_key UNIQUE (post_id, reporter_id);

-- ── 2. `reported` is derived from the open reports ───────────
-- SECURITY DEFINER so the recompute bypasses the author-only UPDATE policy on
-- tribe_posts — the whole point is that the reporter is not the author.
-- TG_OP is branched with IF/ELSE, never CASE: a plpgsql CASE expression compiles
-- to a single SQL query that touches the unassigned NEW record on DELETE and
-- raises.
CREATE OR REPLACE FUNCTION public.tg_tribe_post_reported()
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

  UPDATE public.tribe_posts p
  SET reported = EXISTS (
    SELECT 1 FROM public.tribe_post_reports r
    WHERE r.post_id = v_post AND NOT r.resolved
  )
  WHERE p.id = v_post;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tribe_post_reports_flag_ins ON public.tribe_post_reports;
CREATE TRIGGER tribe_post_reports_flag_ins
  AFTER INSERT ON public.tribe_post_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_post_reported();

DROP TRIGGER IF EXISTS tribe_post_reports_flag_upd ON public.tribe_post_reports;
CREATE TRIGGER tribe_post_reports_flag_upd
  AFTER UPDATE OF resolved ON public.tribe_post_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_post_reported();

DROP TRIGGER IF EXISTS tribe_post_reports_flag_del ON public.tribe_post_reports;
CREATE TRIGGER tribe_post_reports_flag_del
  AFTER DELETE ON public.tribe_post_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_post_reported();

-- ── 3. Owners can resolve reports in their own tribe ─────────
-- Mirrors the shape of the existing SELECT policy ("Admins and tribe owners can
-- view tribe reports"). Dismiss now sets resolved = true, which fires the
-- trigger above and clears the post's flag.
DROP POLICY IF EXISTS "Tribe owners resolve tribe reports" ON public.tribe_post_reports;
CREATE POLICY "Tribe owners resolve tribe reports"
ON public.tribe_post_reports FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_reports.post_id
      AND public.is_tribe_owner(p.tribe_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_reports.post_id
      AND public.is_tribe_owner(p.tribe_id, auth.uid())
  )
);

-- ── 4. Light today's doors ───────────────────────────────────
-- Every report filed while the flag write was silently failing is still sitting
-- unresolved. Sync the flag once so those owners see their review door. The
-- WHERE clause makes a re-run a no-op.
UPDATE public.tribe_posts p
SET reported = EXISTS (
  SELECT 1 FROM public.tribe_post_reports r
  WHERE r.post_id = p.id AND NOT r.resolved
)
WHERE p.reported IS DISTINCT FROM EXISTS (
  SELECT 1 FROM public.tribe_post_reports r
  WHERE r.post_id = p.id AND NOT r.resolved
);

NOTIFY pgrst, 'reload schema';
