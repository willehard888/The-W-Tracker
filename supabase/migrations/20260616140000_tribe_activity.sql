-- Tribe discovery by activity — tag each tribe with a primary activity so
-- members can browse clubs by what they actually do. Idempotent.

ALTER TABLE public.tribes ADD COLUMN IF NOT EXISTS primary_activity text;

-- Owner sets / changes the tribe's primary activity.
CREATE OR REPLACE FUNCTION public.set_tribe_activity(p_tribe uuid, p_activity text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.is_tribe_owner(p_tribe, uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.tribes
  SET primary_activity = NULLIF(trim(coalesce(p_activity, '')), ''),
      updated_at = now()
  WHERE id = p_tribe;
END; $$;

GRANT EXECUTE ON FUNCTION public.set_tribe_activity(uuid, text) TO authenticated;
