-- Audit round (2026-09-25), batch D — the bell keeps a blocked member's rows.
--
-- direct_messages hides both directions of a block (NOT is_blocked), so the
-- thread disappears from Messages; the inbox row that announced it
-- ("@x sent you a message · <preview>") stayed, with a door to a chat that
-- no longer opens. Same predicate, same table pattern: rows whose actor is
-- on either side of a block are not the member's to read. Rows without an
-- actor (briefings, battles decided, streak) are untouched. The unread badge
-- counts through the same policy, so it drops with them.
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND (actor_id IS NULL OR NOT public.is_blocked(user_id, actor_id))
  );

NOTIFY pgrst, 'reload schema';
