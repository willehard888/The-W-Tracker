-- ============================================================
-- Security S5 — per-user AI rate limiting.
--
-- ai-coach fires GPT-5 (reasoning enabled, multi-thousand-token prompts)
-- gated only by has_active_access, which every fresh signup passes for 7
-- days. No per-user cap → scripted signups (or one leaked JWT) can run the
-- coach at full concurrency and drain the OpenRouter balance, taking the
-- coach down for paying users. This adds an atomic Postgres counter (isolate-
-- churn-proof, unlike an in-memory Map) checked before each upstream call.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id uuid NOT NULL,
  day     date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  kind    text NOT NULL DEFAULT 'coach',
  count   int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- No policies: written only through the SECURITY DEFINER RPC below.

-- Atomically bump the caller's counter for today and report whether they are
-- still under the limit. Returns TRUE while allowed. A blocked call still
-- increments (counts the attempt) — cheap and prevents burst gaming.
CREATE OR REPLACE FUNCTION public.bump_ai_usage(p_limit int, p_kind text DEFAULT 'coach')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_count int;
  v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;

  INSERT INTO ai_usage (user_id, day, kind, count)
  VALUES (uid, v_today, COALESCE(p_kind, 'coach'), 1)
  ON CONFLICT (user_id, day, kind) DO UPDATE
    SET count = ai_usage.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= GREATEST(1, p_limit);
END $$;

REVOKE ALL ON FUNCTION public.bump_ai_usage(int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(int, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
