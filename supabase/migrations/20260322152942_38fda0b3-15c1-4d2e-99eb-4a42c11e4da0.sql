
ALTER TABLE public.battles 
  ADD COLUMN IF NOT EXISTS challenger_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opponent_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS challenger_proof_url text,
  ADD COLUMN IF NOT EXISTS opponent_proof_url text;
