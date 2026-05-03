-- Daily AI Trainer Brief storage
CREATE TABLE IF NOT EXISTS public.coach_daily_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brief_date DATE NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, brief_date)
);

ALTER TABLE public.coach_daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own daily briefs"
  ON public.coach_daily_briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_daily_briefs_user_date
  ON public.coach_daily_briefs(user_id, brief_date DESC);

-- SECURITY DEFINER RPC for upsert (called from edge function with user JWT)
CREATE OR REPLACE FUNCTION public.upsert_daily_brief(_payload JSONB)
RETURNS public.coach_daily_briefs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.coach_daily_briefs;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  INSERT INTO public.coach_daily_briefs(user_id, brief_date, payload)
  VALUES (_uid, CURRENT_DATE, _payload)
  ON CONFLICT (user_id, brief_date)
  DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;