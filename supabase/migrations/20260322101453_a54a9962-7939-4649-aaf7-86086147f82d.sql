
-- Update handle_new_user to generate referral codes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, referral_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    LOWER(SUBSTRING((NEW.raw_user_meta_data->>'username') || '-' || SUBSTRING(NEW.id::text, 1, 6), 1, 20))
  );
  RETURN NEW;
END;
$function$;
