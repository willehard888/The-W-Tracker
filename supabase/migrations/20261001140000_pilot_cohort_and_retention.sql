-- ============================================================================
-- Pilot: a code can be minted with its cohort, and feedback does not live
-- forever.
--
-- Two gaps the observation migration left behind, both found while taking the
-- pilot from "built" to "ready".
-- ============================================================================


-- ── 1) create_pilot_code() can set cohort and observe_days ──────────────────
--
-- 20260929090000 added `cohort` and `observe_days` to pilot_codes and never
-- widened the function that mints them, so every code made through the RPC
-- came out with cohort NULL.
--
-- That is not cosmetic. admin_pilot_overview(p_cohort => …) filters on it and
-- pilot_submit_feedback stamps it onto every row, so a NULL cohort means the
-- admin page cannot slice the feedback it collects. And it cannot be repaired
-- from the app afterwards: pilot_codes carries a "No direct update" policy
-- that refuses every caller, leaving the SQL editor as the only route.
--
-- The new parameters are last and defaulted, so every existing call site keeps
-- working untouched.

CREATE OR REPLACE FUNCTION public.create_pilot_code(
  p_code text DEFAULT NULL,
  p_grant_days integer DEFAULT 90,
  p_max_redemptions integer DEFAULT 1,
  p_expires_at timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_cohort text DEFAULT NULL,
  p_observe_days smallint DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- No code supplied → random, like legend_invites. Guessable dictionary
  -- words × unlimited signups × 90 free days is the actual threat model.
  v_final text := COALESCE(nullif(trim(p_code), ''), upper(encode(gen_random_bytes(6), 'hex')));
  v_row pilot_codes;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden');
  END IF;

  IF length(v_final) < 4 OR length(v_final) > 40 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_length');
  END IF;

  INSERT INTO pilot_codes
    (code, grant_days, max_redemptions, expires_at, note, cohort, observe_days, created_by)
  VALUES
    (v_final, p_grant_days, p_max_redemptions, p_expires_at, p_note,
     nullif(trim(coalesce(p_cohort, '')), ''), p_observe_days, auth.uid())
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'code', v_row.code, 'id', v_row.id, 'cohort', v_row.cohort);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'reason', 'code_exists');
  WHEN check_violation THEN
    -- grant_days/max_redemptions <= 0, or observe_days outside 1..365 — keep
    -- the {success:false} contract instead of surfacing a PostgREST 500.
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_params');
END;
$$;

-- The old five-argument signature would otherwise linger beside the new one
-- and get picked by PostgREST on a five-key call, writing cohort NULL again.
DROP FUNCTION IF EXISTS public.create_pilot_code(text, integer, integer, timestamptz, text);

REVOKE ALL ON FUNCTION public.create_pilot_code(text, integer, integer, timestamptz, text, text, smallint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pilot_code(text, integer, integer, timestamptz, text, text, smallint)
  TO authenticated;


-- ── 2) Pilot feedback is kept for 180 days ─────────────────────────────────
--
-- The same figure analytics_events has used since 20260810144606, and the
-- same reason: free text somebody typed about their own training is not ours
-- to hold indefinitely. One number for the whole product is also one sentence
-- to a tester, which is what the redemption screen now promises them.
--
-- pilot_prompt_log is deliberately NOT swept. It records which questions were
-- asked and whether they were answered — short counters, no free text — and
-- deleting it would destroy the response rates that say whether silence meant
-- "not shown" or "not answered". Both tables still go the moment an account
-- is deleted (delete-account sweeps them by user_id).

DO $$
BEGIN
  PERFORM cron.schedule(
    'pilot-feedback-retention',
    '45 4 * * *',  -- a quarter-hour after analytics-retention, not alongside it
    $job$ DELETE FROM public.pilot_feedback WHERE created_at < now() - interval '180 days' $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule pilot-feedback-retention manually';
END $$;
