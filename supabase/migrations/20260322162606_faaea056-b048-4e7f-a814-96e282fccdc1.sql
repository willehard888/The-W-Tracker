
-- Auto-resolve voting battle when 3 votes are cast
CREATE OR REPLACE FUNCTION public.check_voting_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  battle RECORD;
  vote_count integer;
  challenger_votes integer;
  opponent_votes integer;
  winner uuid;
BEGIN
  -- Get the battle
  SELECT * INTO battle FROM battles WHERE id = NEW.battle_id AND status = 'voting';
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Count total votes
  SELECT count(*) INTO vote_count FROM battle_votes WHERE battle_id = NEW.battle_id;

  -- Resolve if 3+ votes
  IF vote_count >= 3 THEN
    SELECT count(*) INTO challenger_votes FROM battle_votes
      WHERE battle_id = NEW.battle_id AND voted_for = battle.challenger_id;
    SELECT count(*) INTO opponent_votes FROM battle_votes
      WHERE battle_id = NEW.battle_id AND voted_for = battle.opponent_id;

    winner := NULL;
    IF challenger_votes > opponent_votes THEN
      winner := battle.challenger_id;
    ELSIF opponent_votes > challenger_votes THEN
      winner := battle.opponent_id;
    END IF;

    UPDATE battles SET status = 'completed', winner_id = winner WHERE id = NEW.battle_id;

    IF winner IS NOT NULL THEN
      PERFORM update_status_tier(winner);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_battle_vote_check_threshold
  AFTER INSERT ON public.battle_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_voting_threshold();
