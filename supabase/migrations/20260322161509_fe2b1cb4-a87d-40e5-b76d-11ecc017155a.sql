
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
      winner := NULL;
    ELSIF expired.challenger_proof_url IS NULL THEN
      winner := expired.opponent_id;
    ELSIF expired.opponent_proof_url IS NULL THEN
      winner := expired.challenger_id;
    ELSE
      IF expired.challenger_score > expired.opponent_score THEN
        winner := expired.challenger_id;
      ELSIF expired.opponent_score > expired.challenger_score THEN
        winner := expired.opponent_id;
      END IF;
    END IF;

    UPDATE battles
    SET status = 'completed', ended_at = now(), winner_id = winner
    WHERE id = expired.id;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER check_expired_battles
  AFTER INSERT OR UPDATE ON public.battles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.auto_resolve_expired_battles();
