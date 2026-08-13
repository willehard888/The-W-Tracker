-- Growth Engine: anonymous top-of-funnel events. track() drops anon events
-- by design (RLS insert requires auth.uid() = user_id), so landing → auth →
-- signup-submit was a black box. Same hardened pattern as join_waitlist:
-- SECURITY DEFINER RPC, strict allowlist, no direct table access widened.
-- analytics_events.user_id is already nullable; the retention cron (180d)
-- and size caps apply to these rows like any other.

CREATE FUNCTION public.log_anon_event(_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _event NOT IN ('landing_viewed', 'auth_viewed', 'signup_submitted') THEN
    RETURN; -- silently ignore anything outside the allowlist
  END IF;
  INSERT INTO public.analytics_events (user_id, event, props)
  VALUES (NULL, _event, NULL);
END $$;

REVOKE ALL ON FUNCTION public.log_anon_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_anon_event(text) TO anon, authenticated;
