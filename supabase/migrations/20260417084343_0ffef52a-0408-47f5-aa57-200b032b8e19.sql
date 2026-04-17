-- 1. Add trial_started_at to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: existing users get a fresh 9-day trial starting now
UPDATE public.profiles
SET trial_started_at = now()
WHERE trial_started_at IS NULL OR trial_started_at < now() - interval '9 days';

-- 2. Update handle_new_user to set trial_started_at on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
BEGIN
  base_username := lower(trim(coalesce(
    NEW.raw_user_meta_data->>'username',
    split_part(coalesce(NEW.email, ''), '@', 1),
    'user'
  )));

  base_username := regexp_replace(base_username, '[^a-z0-9_]+', '_', 'g');
  base_username := trim(both '_' from base_username);

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  final_username := left(base_username, 20);

  IF final_username IS NULL OR final_username = '' THEN
    final_username := 'user';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE username = final_username
  ) THEN
    final_username := left(base_username, 13) || '_' || substring(NEW.id::text, 1, 6);
  END IF;

  INSERT INTO public.profiles (user_id, username, referral_code, trial_started_at)
  VALUES (
    NEW.id,
    final_username,
    left(final_username || '_' || substring(NEW.id::text, 1, 6), 20),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3. has_active_access: returns true if Elite OR within 9-day trial
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_elite = true
        OR trial_started_at > now() - interval '9 days'
      )
  );
$function$;

-- 4. Trigger: auto-update status_tier after daily check-in
CREATE OR REPLACE FUNCTION public.trg_update_status_after_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.update_status_tier(NEW.user_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_status_after_checkin ON public.daily_checkins;
CREATE TRIGGER update_status_after_checkin
AFTER INSERT ON public.daily_checkins
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_status_after_checkin();

-- 5. Trigger: auto-update status_tier when a battle completes
CREATE OR REPLACE FUNCTION public.trg_update_status_after_battle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.update_status_tier(NEW.challenger_id);
    PERFORM public.update_status_tier(NEW.opponent_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_status_after_battle ON public.battles;
CREATE TRIGGER update_status_after_battle
AFTER UPDATE ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_status_after_battle();