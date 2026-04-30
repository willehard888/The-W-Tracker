-- 1. Add is_premium column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_premium_idx ON public.profiles(is_premium) WHERE is_premium = true;

-- 2. Backfill: every existing paying user becomes Premium
UPDATE public.profiles
SET is_premium = true
WHERE is_apex_subscriber = true
   OR is_elite = true
   OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
   OR (membership_credits_until IS NOT NULL AND membership_credits_until > now());

-- 3. Helper for RLS on future Vault content tables
CREATE OR REPLACE FUNCTION public.has_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND (
        p.is_premium = true
        OR p.is_elite = true
        OR p.is_apex_subscriber = true
        OR (p.apex_credits_until IS NOT NULL AND p.apex_credits_until > now())
        OR (p.membership_credits_until IS NOT NULL AND p.membership_credits_until > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_premium(uuid) TO authenticated, service_role;

-- 4. Update set_elite_status RPC to keep is_premium in sync.
CREATE OR REPLACE FUNCTION public.set_elite_status(target_user_id uuid, elite boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id required';
  END IF;

  UPDATE public.profiles
  SET is_elite = elite,
      is_premium = elite OR is_apex_subscriber
                          OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
                          OR (membership_credits_until IS NOT NULL AND membership_credits_until > now()),
      updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_elite_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_elite_status(uuid, boolean) TO authenticated, service_role;