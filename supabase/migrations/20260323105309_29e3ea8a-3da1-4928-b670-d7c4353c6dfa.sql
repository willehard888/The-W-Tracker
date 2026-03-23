ALTER TABLE public.battles
  ADD COLUMN challenger_start_xp integer NOT NULL DEFAULT 0,
  ADD COLUMN opponent_start_xp integer NOT NULL DEFAULT 0;