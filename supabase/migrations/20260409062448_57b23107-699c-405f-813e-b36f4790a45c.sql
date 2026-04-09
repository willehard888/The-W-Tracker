
-- 1. Lock down user_roles: deny all writes from client
CREATE POLICY "No direct role insertion"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct role updates"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No direct role deletion"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);

-- 2. Fix battles UPDATE: restrict what participants can update
-- Drop the existing permissive user update policy
DROP POLICY IF EXISTS "Users can update own battles" ON public.battles;

-- Create a restrictive RPC function for proof submission
CREATE OR REPLACE FUNCTION public.submit_battle_proof(
  battle_id uuid,
  proof_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT * INTO b FROM battles WHERE id = battle_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found or not active';
  END IF;

  IF auth.uid() = b.challenger_id THEN
    UPDATE battles SET challenger_proof_url = proof_url WHERE id = battle_id;
  ELSIF auth.uid() = b.opponent_id THEN
    UPDATE battles SET opponent_proof_url = proof_url WHERE id = battle_id;
  ELSE
    RAISE EXCEPTION 'Not a participant';
  END IF;
END;
$$;

-- Create a function for accepting/declining battles
CREATE OR REPLACE FUNCTION public.respond_to_battle(
  battle_id uuid,
  accept boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  c_xp integer;
  o_xp integer;
BEGIN
  SELECT * INTO b FROM battles WHERE id = battle_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found or not pending';
  END IF;

  IF auth.uid() != b.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can respond';
  END IF;

  IF accept THEN
    -- Get current XP for both players
    SELECT xp INTO c_xp FROM profiles WHERE user_id = b.challenger_id;
    SELECT xp INTO o_xp FROM profiles WHERE user_id = b.opponent_id;
    
    UPDATE battles 
    SET status = 'active', 
        started_at = now(),
        challenger_start_xp = COALESCE(c_xp, 0),
        opponent_start_xp = COALESCE(o_xp, 0)
    WHERE id = battle_id;
  ELSE
    UPDATE battles SET status = 'declined' WHERE id = battle_id;
  END IF;
END;
$$;

-- 3. Fix storage policies: enforce path ownership on uploads
-- Drop existing permissive INSERT policies and recreate with path check
DO $$
BEGIN
  -- Drop existing INSERT policies on storage.objects for feed-images
  DROP POLICY IF EXISTS "Users can upload feed images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload feed images" ON storage.objects;
  DROP POLICY IF EXISTS "feed-images insert" ON storage.objects;
  
  -- Drop existing INSERT policies on storage.objects for proof-photos  
  DROP POLICY IF EXISTS "Users can upload proof photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload proof photos" ON storage.objects;
  DROP POLICY IF EXISTS "proof-photos insert" ON storage.objects;
END $$;

-- Create new path-enforcing INSERT policies
CREATE POLICY "Users upload to own feed-images folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feed-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users upload to own proof-photos folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proof-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
