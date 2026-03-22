
-- Add "voting" status for tied battles
ALTER TYPE public.battle_status ADD VALUE IF NOT EXISTS 'voting';

-- Create votes table
CREATE TABLE public.battle_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  voted_for uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(battle_id, voter_id)
);

ALTER TABLE public.battle_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes" ON public.battle_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON public.battle_votes
  FOR INSERT WITH CHECK (
    auth.uid() = voter_id
    AND auth.uid() != (SELECT challenger_id FROM battles WHERE id = battle_id)
    AND auth.uid() != (SELECT opponent_id FROM battles WHERE id = battle_id)
  );

CREATE INDEX idx_battle_votes_battle ON public.battle_votes(battle_id);
