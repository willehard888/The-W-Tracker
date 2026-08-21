-- ============================================================
-- Onboarding O1: DB-backed completion flag.
-- Completion used to live ONLY in device localStorage
-- (w_onboarding_done) — it replayed on reinstall/new device and was
-- wiped by signOut on shared devices. The profile row becomes the
-- authority; localStorage stays as a sync fast-path cache.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Backfill: every profile that exists at deploy time predates the new
-- flow — they must never see onboarding (again).
UPDATE public.profiles
SET onboarded_at = COALESCE(created_at, now())
WHERE onboarded_at IS NULL;

-- Client marks completion through this instead of a raw column update
-- (profiles column writes are trigger-guarded; this is the sanctioned path).
CREATE OR REPLACE FUNCTION public.mark_onboarded()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET onboarded_at = now()
  WHERE user_id = auth.uid() AND onboarded_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.mark_onboarded() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_onboarded() TO authenticated;
