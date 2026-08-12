-- ============================================================
-- Waitlist — email signups from the standalone marketing page.
-- Deny-all RLS on the table (no direct anon access, keeping the repo's
-- "no anon INSERT policies" invariant); all writes go through a
-- SECURITY DEFINER RPC that validates, normalizes and dedups.
-- Duplicate signups return true (no email-existence oracle).
-- ============================================================

CREATE TABLE public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  source     text NOT NULL DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX waitlist_email_unique ON public.waitlist (lower(email));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: deny-all for anon/authenticated; service role and
-- the RPC below are the only paths in.

CREATE FUNCTION public.join_waitlist(_email text, _source text DEFAULT 'landing')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(_email, '')));
BEGIN
  IF length(v_email) < 6 OR length(v_email) > 254 THEN
    RETURN false;
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN false;
  END IF;

  INSERT INTO public.waitlist (email, source)
  VALUES (v_email, LEFT(coalesce(_source, 'landing'), 40))
  ON CONFLICT (lower(email)) DO NOTHING;

  RETURN true; -- true also on duplicate: no signal about existing emails
END $$;

REVOKE ALL ON FUNCTION public.join_waitlist(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_waitlist(text, text) TO anon, authenticated;
