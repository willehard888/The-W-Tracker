-- The pilot's observation window, its feedback, and the log that paces it.
--
-- WHAT IS NOT HERE, ON PURPOSE
--
-- No new access path, no new code table, no cohort machinery. `pilot_codes`,
-- `pilot_code_redemptions` and `redeem_pilot_code()` (20260901130000) already
-- do all of that, and better than a second system would: row-locked, rate
-- limited, RLS-sealed, and already wired into the paywall. This migration adds
-- two columns to that table and reads the rest.
--
-- TWO WINDOWS, NOT ONE
--
-- A pilot code grants `grant_days` of membership credits — 90 by default. The
-- pilot we are running is 14 days. These are deliberately different lengths:
-- access should not evaporate in the tester's hand the moment we stop watching,
-- and nothing has to be unwound when the pilot ends. So the OBSERVATION window
-- (`observe_days`) is its own number, and day 0 is `redeemed_at`. There is no
-- enrolment record, because there is nothing an enrolment record would know
-- that the redemption does not already say.
--
-- Day is counted in the TESTER's timezone (profiles.timezone, which
-- touch_activity already maintains), not UTC. A checkpoint that fires at 2am
-- because the server disagrees with the phone about what day it is would be the
-- first thing a tester reported as a bug.

-- ── The observation window ───────────────────────────────────────────────────

ALTER TABLE public.pilot_codes
  ADD COLUMN IF NOT EXISTS cohort text,
  ADD COLUMN IF NOT EXISTS observe_days smallint NOT NULL DEFAULT 14
    CHECK (observe_days > 0 AND observe_days <= 365);

COMMENT ON COLUMN public.pilot_codes.cohort IS
  'Names the run a code belongs to ("pilot-1"). Read by the admin page; never shown to the tester.';
COMMENT ON COLUMN public.pilot_codes.observe_days IS
  'How long we WATCH. Separate from grant_days, which is how long they get in.';

-- Everything the app needs to know about the caller's pilot, in one call.
--
-- Server-side by design: the client must never decide for itself that it is in
-- a pilot, or which day it is on, because both gate whether a question may be
-- asked at all.
--
-- The MOST RECENT redemption wins. A tester handed a second code for a later
-- cohort starts a new window rather than carrying the first one forever.
CREATE OR REPLACE FUNCTION public.pilot_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'is_pilot',     true,
        'cohort',       c.cohort,
        'code_id',      c.id,
        'redeemed_at',  r.redeemed_at,
        'observe_days', c.observe_days,
        'day',          GREATEST(0, (
          (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
          - (r.redeemed_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
        )),
        'in_window',    (
          (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
          - (r.redeemed_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
        ) <= c.observe_days
      )
      FROM pilot_code_redemptions r
      JOIN pilot_codes c ON c.id = r.code_id
      JOIN profiles p    ON p.user_id = r.user_id
      WHERE r.user_id = auth.uid()
      ORDER BY r.redeemed_at DESC
      LIMIT 1
    ),
    jsonb_build_object('is_pilot', false)
  );
$fn$;

-- ── What a tester tells us ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pilot_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which question this answers, or FREEFORM for the always-available door.
  prompt_id   text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('checkpoint', 'contextual', 'volunteered', 'bug')),
  rating      smallint CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  -- The option they picked, from a fixed list the client owns.
  choice      text,
  comment     text CHECK (comment IS NULL OR char_length(comment) <= 2000),
  -- WHICH SCREEN, and nothing else. Never health data, never what they logged.
  context     jsonb CHECK (context IS NULL OR pg_column_size(context) <= 2048),
  -- Stamped server-side from pilot_context(), so a client cannot claim day 14
  -- on day 1 and skew the read.
  pilot_day   smallint,
  cohort      text,
  app_version text CHECK (app_version IS NULL OR char_length(app_version) <= 40),
  -- Founder triage. Only an admin can move it.
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'wontfix')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_recent ON public.pilot_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_user   ON public.pilot_feedback (user_id, created_at DESC);

-- What has been asked, and how it went.
--
-- Separate from the answers because this is the table that PACES the system,
-- and it has to hold a row for a question that was shown and ignored — which is
-- not an answer, and is the single most important thing to remember so we do
-- not ask again.
--
-- It lives in the database rather than localStorage for one specific reason: on
-- TestFlight a build update keeps the app container but a delete-and-reinstall
-- does not, and exactly two of this app's existing "we already asked you"
-- memories survive that (onboarding_state and ai_consent_version). Every other
-- one is localStorage and dies with the container. A pilot that asks the same
-- person the day-7 question twice has told them we are not paying attention.
CREATE TABLE IF NOT EXISTS public.pilot_prompt_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id    text NOT NULL,
  shown_at     timestamptz NOT NULL DEFAULT now(),
  answered_at  timestamptz,
  dismissed_at timestamptz,
  UNIQUE (user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_pilot_prompt_log_user ON public.pilot_prompt_log (user_id, shown_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
--
-- Shaped like pilot_code_redemptions: the owner reads their own rows, an admin
-- reads all of them. That is a deliberate exception to the house rule that
-- admins get aggregates and not rows — feedback IS rows, because a comment has
-- to be read as written. The aggregates still go through the RPCs below,
-- because analytics_events has no SELECT policy at all.
--
-- Every write goes through the SECURITY DEFINER functions: a direct INSERT
-- would let a client stamp its own pilot_day and cohort, which are the two
-- fields the whole read is sliced by.

ALTER TABLE public.pilot_feedback   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_prompt_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pilot_feedback read own or admin" ON public.pilot_feedback;
DROP POLICY IF EXISTS "pilot_feedback no direct insert"  ON public.pilot_feedback;
DROP POLICY IF EXISTS "pilot_feedback admin update"      ON public.pilot_feedback;
DROP POLICY IF EXISTS "pilot_feedback no direct delete"  ON public.pilot_feedback;

CREATE POLICY "pilot_feedback read own or admin" ON public.pilot_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pilot_feedback no direct insert" ON public.pilot_feedback
  FOR INSERT TO authenticated WITH CHECK (false);
-- Triage only, and only by an admin: status is the founders' column.
CREATE POLICY "pilot_feedback admin update" ON public.pilot_feedback
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pilot_feedback no direct delete" ON public.pilot_feedback
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "pilot_prompt_log read own or admin" ON public.pilot_prompt_log;
DROP POLICY IF EXISTS "pilot_prompt_log no direct insert"  ON public.pilot_prompt_log;
DROP POLICY IF EXISTS "pilot_prompt_log no direct update"  ON public.pilot_prompt_log;
DROP POLICY IF EXISTS "pilot_prompt_log no direct delete"  ON public.pilot_prompt_log;

CREATE POLICY "pilot_prompt_log read own or admin" ON public.pilot_prompt_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pilot_prompt_log no direct insert" ON public.pilot_prompt_log
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "pilot_prompt_log no direct update" ON public.pilot_prompt_log
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "pilot_prompt_log no direct delete" ON public.pilot_prompt_log
  FOR DELETE TO authenticated USING (false);

-- ── Writes ───────────────────────────────────────────────────────────────────

-- Record that a prompt was shown, answered or dismissed.
--
-- Idempotent per (user, prompt): shown_at is stamped once and never moved, so
-- "when did we first ask" survives every later call. answered_at and
-- dismissed_at are write-once too — a tester who dismisses and later answers
-- keeps both facts, which is the interesting case.
CREATE OR REPLACE FUNCTION public.pilot_mark_prompt(_prompt_id text, _outcome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF _prompt_id IS NULL OR char_length(_prompt_id) > 64 THEN RETURN; END IF;
  IF _outcome NOT IN ('shown', 'answered', 'dismissed') THEN RETURN; END IF;

  INSERT INTO pilot_prompt_log (user_id, prompt_id, shown_at, answered_at, dismissed_at)
  VALUES (
    v_uid, _prompt_id, now(),
    CASE WHEN _outcome = 'answered'  THEN now() END,
    CASE WHEN _outcome = 'dismissed' THEN now() END
  )
  ON CONFLICT (user_id, prompt_id) DO UPDATE SET
    answered_at  = COALESCE(pilot_prompt_log.answered_at,  EXCLUDED.answered_at),
    dismissed_at = COALESCE(pilot_prompt_log.dismissed_at, EXCLUDED.dismissed_at);
END $fn$;

-- Store one piece of feedback.
--
-- `pilot_day` and `cohort` are read from pilot_context() here rather than taken
-- from the caller: they are what the whole read is sliced by, and a client that
-- can set them can rewrite the finding.
--
-- Capped at 30 submissions a day through the house counter. Generous for
-- somebody with a lot to say on day one, tight against a loop.
CREATE OR REPLACE FUNCTION public.pilot_submit_feedback(
  _prompt_id   text,
  _kind        text,
  _rating      smallint DEFAULT NULL,
  _choice      text     DEFAULT NULL,
  _comment     text     DEFAULT NULL,
  _context     jsonb    DEFAULT NULL,
  _app_version text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_ctx jsonb;
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;
  IF _kind NOT IN ('checkpoint', 'contextual', 'volunteered', 'bug') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'bad_kind');
  END IF;
  IF _prompt_id IS NULL OR char_length(_prompt_id) > 64 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'bad_prompt');
  END IF;
  -- Nothing said is nothing to store. An empty submission is a mis-tap.
  IF _rating IS NULL AND _choice IS NULL AND COALESCE(btrim(_comment), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty');
  END IF;
  IF NOT bump_ai_usage(30, 'pilot_feedback') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'too_many_today');
  END IF;

  v_ctx := pilot_context();

  INSERT INTO pilot_feedback (
    user_id, prompt_id, kind, rating, choice, comment, context,
    pilot_day, cohort, app_version
  )
  VALUES (
    v_uid, _prompt_id, _kind, _rating,
    left(_choice, 64), left(btrim(_comment), 2000), _context,
    NULLIF(v_ctx->>'day', '')::smallint,
    v_ctx->>'cohort',
    left(_app_version, 40)
  )
  RETURNING id INTO v_id;

  PERFORM pilot_mark_prompt(_prompt_id, 'answered');

  RETURN jsonb_build_object('success', true, 'id', v_id);
END $fn$;

-- ── Reads, for the founders only ─────────────────────────────────────────────

-- The pilot at a glance.
--
-- Computes against analytics_events, which NO client can read — that table has
-- an insert-own policy and deliberately no SELECT policy at all — so this has
-- to be SECURITY DEFINER even for an admin.
--
-- Deliberately does not touch admin_funnel(): its hardcoded 15-event list is
-- what /admin/metrics renders, and widening it would change a page nobody asked
-- to change.
CREATE OR REPLACE FUNCTION public.admin_pilot_overview(p_cohort text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH members AS (
    SELECT DISTINCT ON (r.user_id)
      r.user_id,
      r.redeemed_at,
      c.cohort,
      c.observe_days,
      p.timezone,
      p.created_at AS signed_up_at
    FROM pilot_code_redemptions r
    JOIN pilot_codes c ON c.id = r.code_id
    JOIN profiles p    ON p.user_id = r.user_id
    WHERE p_cohort IS NULL OR c.cohort = p_cohort
    ORDER BY r.user_id, r.redeemed_at DESC
  ),
  dayed AS (
    SELECT
      m.*,
      GREATEST(0, (now() AT TIME ZONE COALESCE(m.timezone, 'UTC'))::date
                  - (m.redeemed_at AT TIME ZONE COALESCE(m.timezone, 'UTC'))::date) AS day
    FROM members m
  ),
  -- "Reached" = at least one row for that event, ever, per member. The pilot
  -- asks which features are found at all, not how often they are used.
  reach AS (
    SELECT
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM profiles pr
        WHERE pr.user_id = d.user_id AND pr.onboarded_at IS NOT NULL))                   AS onboarded,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM daily_checkins dc
        WHERE dc.user_id = d.user_id))                                                   AS checked_in,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM coach_program_logs cl
        WHERE cl.user_id = d.user_id AND cl.completed))                                  AS trained,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM coach_reflections cr
        WHERE cr.user_id = d.user_id))                                                   AS reflected,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events ae
        WHERE ae.user_id = d.user_id AND ae.event = 'coach_message_sent'))               AS asked_coach,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events ae
        WHERE ae.user_id = d.user_id AND ae.event = 'recovery_completed'))               AS recovered,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events ae
        WHERE ae.user_id = d.user_id AND ae.event = 'app_opened'
          AND ae.created_at > now() - interval '3 days'))                                AS opened_3d
    FROM dayed d
  )
  SELECT jsonb_build_object(
    'cohort',       p_cohort,
    'members',      (SELECT count(*) FROM dayed),
    'in_window',    (SELECT count(*) FROM dayed WHERE day <= observe_days),
    'median_day',   (SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY day) FROM dayed),
    'observe_days', (SELECT max(observe_days) FROM dayed),
    'reach',        (SELECT to_jsonb(r) FROM reach r),
    'feedback_new', (SELECT count(*) FROM pilot_feedback f
                       WHERE f.status = 'new' AND (p_cohort IS NULL OR f.cohort = p_cohort)),
    'bugs_open',    (SELECT count(*) FROM pilot_feedback f
                       WHERE f.kind = 'bug' AND f.status = 'new'
                         AND (p_cohort IS NULL OR f.cohort = p_cohort)),
    -- Time to first value, in minutes from signup. Anchored on
    -- profiles.created_at and NOT on the `signup` event, which has a 10-minute
    -- client-side dedup gate that silently drops anyone whose first session
    -- starts later than that.
    'ttv_minutes',  (
      SELECT jsonb_build_object(
        'first_checkin', percentile_disc(0.5) WITHIN GROUP (ORDER BY mins_checkin),
        'first_workout', percentile_disc(0.5) WITHIN GROUP (ORDER BY mins_workout)
      )
      FROM (
        SELECT
          (SELECT EXTRACT(EPOCH FROM (min(dc.checked_in_at) - d.signed_up_at)) / 60
             FROM daily_checkins dc WHERE dc.user_id = d.user_id) AS mins_checkin,
          (SELECT EXTRACT(EPOCH FROM (min(cl.logged_at) - d.signed_up_at)) / 60
             FROM coach_program_logs cl
             WHERE cl.user_id = d.user_id AND cl.completed)       AS mins_workout
        FROM dayed d
      ) t
    ),
    -- Started a session and never finished it. Read from the row rather than
    -- from an event, because a session is abandoned when the app is killed —
    -- exactly when a client event does not arrive.
    'stalled_sessions', (
      SELECT count(*) FROM coach_program_logs cl
      JOIN dayed d ON d.user_id = cl.user_id
      WHERE cl.completed = false AND cl.started_at IS NOT NULL
        AND cl.started_at < now() - interval '1 day'
    )
  ) INTO v_result;

  RETURN v_result;
END $fn$;

-- Who has been asked what, so nobody is chased twice and nobody is forgotten.
CREATE OR REPLACE FUNCTION public.admin_pilot_prompts(p_cohort text DEFAULT NULL)
RETURNS TABLE (prompt_id text, shown bigint, answered bigint, dismissed bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT l.prompt_id,
           count(*)                                           AS shown,
           count(*) FILTER (WHERE l.answered_at IS NOT NULL)   AS answered,
           count(*) FILTER (WHERE l.dismissed_at IS NOT NULL)  AS dismissed
    FROM pilot_prompt_log l
    WHERE p_cohort IS NULL OR EXISTS (
      SELECT 1 FROM pilot_code_redemptions r
      JOIN pilot_codes c ON c.id = r.code_id
      WHERE r.user_id = l.user_id AND c.cohort = p_cohort
    )
    GROUP BY l.prompt_id
    ORDER BY shown DESC;
END $fn$;

-- ── Grants ───────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.pilot_context()                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pilot_mark_prompt(text, text)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_pilot_overview(text)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_pilot_prompts(text)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pilot_submit_feedback(text, text, smallint, text, text, jsonb, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pilot_context()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_mark_prompt(text, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pilot_overview(text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pilot_prompts(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_submit_feedback(text, text, smallint, text, text, jsonb, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
