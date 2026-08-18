-- ============================================================
-- Waitlist quiz — the marketing page now runs a short onboarding
-- survey (age, goals, struggle, training frequency) before the
-- email step. Answers ride along into waitlist.answers.
--
-- join_waitlist is DROPPED and recreated with _answers jsonb
-- DEFAULT NULL instead of overloading — two signatures would make
-- PostgREST rpc resolution ambiguous (same lesson as record_checkin).
-- Old 2-arg callers (Landing.tsx) keep working via the default.
-- ============================================================

ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS answers jsonb;

DROP FUNCTION IF EXISTS public.join_waitlist(text, text);

CREATE FUNCTION public.join_waitlist(
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

  -- Accept only a reasonably-sized JSON object; anything else is silently
  -- dropped rather than rejected — the signup itself must never fail on
  -- malformed survey data.
  IF _answers IS NOT NULL
     AND jsonb_typeof(_answers) = 'object'
     AND pg_column_size(_answers) < 2048 THEN
    v_answers := _answers;
  END IF;

  INSERT INTO public.waitlist (email, source, answers)
  VALUES (v_email, LEFT(coalesce(_source, 'landing'), 40), v_answers)
  ON CONFLICT (lower(email)) DO UPDATE
    SET answers = COALESCE(EXCLUDED.answers, waitlist.answers);

  RETURN true; -- true also on duplicate: no signal about existing emails
END $$;

REVOKE ALL ON FUNCTION public.join_waitlist(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_waitlist(text, text, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
