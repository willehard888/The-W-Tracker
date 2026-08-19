-- ============================================================
-- admin_waitlist v2 — surface EVERY quiz answer.
-- The quiz collects age, goals[], struggle and training frequency, but
-- the Command Center row only exposed age + goals. Add struggle +
-- training to each row so the founder sees the whole signup.
-- ============================================================

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
               answers->>'age'      AS age,
               answers->'goals'     AS goals,
               answers->>'struggle' AS struggle,
               answers->>'training' AS training,
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

NOTIFY pgrst, 'reload schema';
