-- ============================================================
-- Waitlist welcome email + founder visibility.
--
-- 1) AFTER INSERT trigger → waitlist-welcome edge function (Resend).
--    Same pg_net + vault pattern as tg_notify_referral_joined; the
--    inner EXCEPTION guard is a repo invariant — a notification
--    failure must never roll back a signup. Duplicate signups hit
--    the upsert's UPDATE branch, so no second email is ever sent.
-- 2) admin_waitlist() — the Command Center's window into signups.
-- ============================================================

ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS welcomed_at timestamptz;

CREATE OR REPLACE FUNCTION public.tg_waitlist_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/waitlist-welcome',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object('email', NEW.email, 'answers', NEW.answers)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never let the welcome email break the signup
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS waitlist_welcome ON public.waitlist;
CREATE TRIGGER waitlist_welcome
  AFTER INSERT ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.tg_waitlist_welcome();

-- ── Founder visibility ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_waitlist()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total',    (SELECT count(*) FROM waitlist),
    'last_7d',  (SELECT count(*) FROM waitlist WHERE created_at >= now() - interval '7 days'),
    'welcomed', (SELECT count(*) FROM waitlist WHERE welcomed_at IS NOT NULL),
    'goal_counts', COALESCE((
      SELECT jsonb_object_agg(goal, n) FROM (
        SELECT g.goal, count(*) AS n
        FROM waitlist w, jsonb_array_elements_text(w.answers->'goals') AS g(goal)
        GROUP BY g.goal ORDER BY n DESC
      ) t
    ), '{}'::jsonb),
    'struggle_counts', COALESCE((
      SELECT jsonb_object_agg(s, n) FROM (
        SELECT w.answers->>'struggle' AS s, count(*) AS n
        FROM waitlist w WHERE w.answers ? 'struggle'
        GROUP BY 1 ORDER BY n DESC
      ) t
    ), '{}'::jsonb),
    'rows', COALESCE((
      SELECT jsonb_agg(r) FROM (
        SELECT email,
               source,
               answers->>'age'   AS age,
               answers->'goals'  AS goals,
               created_at,
               (welcomed_at IS NOT NULL) AS welcomed
        FROM waitlist
        ORDER BY created_at DESC
        LIMIT 50
      ) r
    ), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.admin_waitlist() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_waitlist() TO authenticated;

NOTIFY pgrst, 'reload schema';
