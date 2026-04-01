CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  INSERT INTO public.profiles (user_id, username, referral_code)
  VALUES (
    NEW.id,
    final_username,
    left(final_username || '_' || substring(NEW.id::text, 1, 6), 20)
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;