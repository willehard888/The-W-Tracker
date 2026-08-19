-- ============================================================
-- Security S6 — waitlist abuse throttle + answer-poison fix.
--
-- join_waitlist is anon-callable (it must be — the public landing form).
-- Without a throttle, a loop with attacker-chosen addresses sends unlimited
-- Resend welcome mail to third parties (deliverability/reputation damage) and
-- grows the waitlist unboundedly. Also: the ON CONFLICT DO UPDATE let anyone
-- who guessed a signed-up address overwrite that row's quiz answers (poisoning
-- admin_waitlist's goal/struggle aggregates).
-- ============================================================

CREATE OR REPLACE FUNCTION public.join_waitlist(
  _email text,
  _source text DEFAULT 'landing',
  _answers jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(_email, '')));
  v_answers jsonb := NULL;
BEGIN
  IF length(v_email) < 6 OR length(v_email) > 254 THEN
    RETURN false;
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN false;
  END IF;

  -- Coarse global throttle: if the list took >300 signups in the last hour
  -- it's almost certainly a script — silently drop (return true, no oracle).
  -- A real launch spike stays well under this; a flood does not.
  IF (SELECT count(*) FROM public.waitlist WHERE created_at > now() - interval '1 hour') > 300 THEN
    RETURN true;
  END IF;

  IF _answers IS NOT NULL
     AND jsonb_typeof(_answers) = 'object'
     AND pg_column_size(_answers) < 2048 THEN
    v_answers := _answers;
  END IF;

  INSERT INTO public.waitlist (email, source, answers)
  VALUES (v_email, LEFT(coalesce(_source, 'landing'), 40), v_answers)
  ON CONFLICT (lower(email)) DO UPDATE
    -- Only FILL answers when the row has none — never overwrite (poison guard).
    SET answers = COALESCE(waitlist.answers, EXCLUDED.answers);

  RETURN true; -- true also on duplicate: no signal about existing emails
END $$;

REVOKE ALL ON FUNCTION public.join_waitlist(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_waitlist(text, text, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
