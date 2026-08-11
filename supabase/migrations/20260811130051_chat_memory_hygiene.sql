-- ============================================================
-- Chat-memory hygiene — make the coach's long-term memory trustworthy
-- now that ai-coach actually READS it every message.
-- 1) append_chat_memory_batch: add the same 60-day case-insensitive
--    dedup add_chat_memory already has (the batch path had none, so
--    repeated chats accumulated near-identical facts).
-- 2) Unify the per-user cap at 50: the insert trigger kept 30 while the
--    batch RPC pruned to 50 — the two fought; 50 wins (12 are injected
--    into the prompt, the rest are history for the memory screen).
-- ============================================================

CREATE OR REPLACE FUNCTION public.append_chat_memory_batch(_facts jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  inserted int := 0;
  item jsonb;
  fact_text text;
  conf numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF jsonb_typeof(_facts) <> 'array' THEN RETURN 0; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(_facts) LOOP
    fact_text := LEFT(COALESCE(item->>'fact', ''), 240);
    conf := LEAST(1, GREATEST(0, COALESCE((item->>'confidence')::numeric, 0.7)));
    IF length(fact_text) >= 6 AND NOT EXISTS (
      SELECT 1 FROM public.coach_chat_memory
      WHERE user_id = uid
        AND lower(fact) = lower(fact_text)
        AND created_at > now() - interval '60 days'
    ) THEN
      INSERT INTO public.coach_chat_memory (user_id, fact, confidence, source)
      VALUES (uid, fact_text, conf, 'chat-extract');
      inserted := inserted + 1;
    END IF;
  END LOOP;
  -- Prune to last 50 facts per user
  DELETE FROM public.coach_chat_memory
  WHERE user_id = uid
    AND id NOT IN (
      SELECT id FROM public.coach_chat_memory
      WHERE user_id = uid
      ORDER BY created_at DESC
      LIMIT 50
    );
  RETURN inserted;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_chat_memory_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.coach_chat_memory
  WHERE id IN (
    SELECT id FROM public.coach_chat_memory
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$$;
