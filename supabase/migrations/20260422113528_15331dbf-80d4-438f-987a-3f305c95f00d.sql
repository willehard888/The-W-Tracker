CREATE OR REPLACE FUNCTION public.auto_grant_founding_apex_to_legends()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_tier = 'legend' AND (OLD.status_tier IS DISTINCT FROM 'legend') THEN
    NEW.is_apex_subscriber := true;
    IF NEW.apex_subscription_started_at IS NULL THEN
      NEW.apex_subscription_started_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_grant_founding_apex_to_legends ON public.profiles;
CREATE TRIGGER trg_auto_grant_founding_apex_to_legends
  BEFORE UPDATE OF status_tier ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_founding_apex_to_legends();