-- ============================================================
-- pg_net health diagnostics — lets any session verify that the
-- async HTTP worker actually dispatches and what the target
-- returned. URL is HARDCODED (own public og-image endpoint), so
-- this cannot be used to make the DB call arbitrary hosts.
-- Used to debug the S7a moderation trigger chain; kept because
-- every push/notify/moderation trigger rides on pg_net.
-- ============================================================

CREATE OR REPLACE FUNCTION public.debug_net_ping()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT net.http_post(
    url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/og-image',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.debug_net_result(p_id bigint)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', r.status_code,
    'error', r.error_msg,
    'body_head', left(r.content, 120)
  )
  FROM net._http_response r
  WHERE r.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.debug_net_ping() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.debug_net_result(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_net_ping() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_net_result(bigint) TO authenticated;
