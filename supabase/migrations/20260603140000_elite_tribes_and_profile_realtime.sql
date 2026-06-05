-- ============================================================
-- Tribe creation for Elite + real-time profile/status updates
-- ============================================================

-- 1. Elite (and above) can found tribes — not just Apex.
CREATE OR REPLACE FUNCTION public.can_create_tribe(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_apex_subscriber = true
        OR status_tier IN ('elite','apex','legend')
      )
  );
$$;

-- 2. Stream profile changes to the client so status_tier / xp / streak / level
--    update in real time (AuthContext subscribes per-user). Add the table to
--    the realtime publication only if it isn't already a member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
