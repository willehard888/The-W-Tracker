
CREATE OR REPLACE FUNCTION public.auto_resolve_expired_battles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired RECORD;
  winner uuid;
BEGIN
  FOR expired IN
    SELECT * FROM battles
    WHERE status = 'active'
      AND started_at IS NOT NULL
      AND (started_at + (duration_days || ' days')::interval) < now()
  LOOP
    winner := NULL;

    IF expired.challenger_proof_url IS NULL AND expired.opponent_proof_url IS NULL THEN
      -- Both forfeit
      UPDATE battles SET status = 'completed', ended_at = now(), winner_id = NULL WHERE id = expired.id;
    ELSIF expired.challenger_proof_url IS NULL THEN
      UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.opponent_id WHERE id = expired.id;
    ELSIF expired.opponent_proof_url IS NULL THEN
      UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.challenger_id WHERE id = expired.id;
    ELSE
      -- Both have proof
      IF expired.challenger_score > expired.opponent_score THEN
        UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.challenger_id WHERE id = expired.id;
      ELSIF expired.opponent_score > expired.challenger_score THEN
        UPDATE battles SET status = 'completed', ended_at = now(), winner_id = expired.opponent_id WHERE id = expired.id;
      ELSE
        -- Tie with both proofs → community voting
        UPDATE battles SET status = 'voting', ended_at = now() WHERE id = expired.id;
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;
