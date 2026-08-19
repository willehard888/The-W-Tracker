-- ============================================================
-- Kudos monthly cap — server-enforced, unified at 2/month.
--
-- The global feed (kudos on feed_posts) capped giving at 10/month
-- but only in client state (EliteFeed.tsx KUDOS_PER_MONTH), so a
-- direct API caller could hand out unlimited kudos — each worth +10
-- XP to the receiver — enabling two-account collusion farming. The
-- tribe feed already enforces 2/month in its RLS policy. This aligns
-- the global feed to the same 2/month rule AND enforces it in the DB.
-- ============================================================

DROP POLICY IF EXISTS "Users can give kudos" ON public.kudos;
CREATE POLICY "Users can give kudos" ON public.kudos FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = giver_id
  AND giver_id <> receiver_id
  AND EXISTS (
    SELECT 1 FROM public.feed_posts p
    WHERE p.id = kudos.post_id AND p.user_id = kudos.receiver_id
  )
  AND (
    SELECT count(*) FROM public.kudos k
    WHERE k.giver_id = auth.uid()
      AND k.created_at >= date_trunc('month', now())
  ) < 2
);
