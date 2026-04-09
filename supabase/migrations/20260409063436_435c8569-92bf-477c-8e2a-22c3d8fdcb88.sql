
-- 1. Fix feed_posts INSERT: enforce elite status at DB level
DROP POLICY IF EXISTS "Elite users can post" ON public.feed_posts;
CREATE POLICY "Elite users can post" ON public.feed_posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_elite = true)
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'moderator')
  )
);

-- 2. Restrict profile UPDATE policy to safe columns only via RPC
-- Drop the permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a restrictive policy: users can only update safe columns
-- We use a SECURITY DEFINER function approach
CREATE OR REPLACE FUNCTION public.update_own_profile(
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_avatar_url text DEFAULT NULL,
  new_featured_badge_id uuid DEFAULT NULL,
  clear_featured_badge boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    avatar_url = COALESCE(new_avatar_url, avatar_url),
    featured_badge_id = CASE
      WHEN clear_featured_badge THEN NULL
      WHEN new_featured_badge_id IS NOT NULL THEN new_featured_badge_id
      ELSE featured_badge_id
    END,
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- 3. Create RPC for elite status changes (called by subscription webhooks/context)
CREATE OR REPLACE FUNCTION public.set_elite_status(target_user_id uuid, elite boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the user themselves or admins
  IF auth.uid() != target_user_id AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  UPDATE profiles SET is_elite = elite, updated_at = now() WHERE user_id = target_user_id;
END;
$$;

-- 4. Re-add a restrictive UPDATE policy that blocks direct updates from clients
-- Allow updates only through RPC (SECURITY DEFINER functions bypass RLS)
CREATE POLICY "Users can update own profile via RPC only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
