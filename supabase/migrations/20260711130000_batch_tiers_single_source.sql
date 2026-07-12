-- ============================================================
-- Fix: update_all_status_tiers used a STALE inlined tier algorithm
-- ============================================================
-- The batch recompute (called by sync-streaks + the referral/season paths)
-- carried its own copy of the tier logic, written before the earned-status
-- rework. That copy has NO divisions, and predates the founder-legend override
-- and the performance-only (no paid-floor) rules — so every run would silently
-- overwrite everyone's correct tier/division with the old logic.
--
-- Fix: make it delegate to update_status_tier(user_id), the single source of
-- truth (founder override + earned Legend/Apex + III/II/I divisions). O(n) rank
-- queries per user, but runs off-peak and keeps one algorithm.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_all_status_tiers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles LOOP
    PERFORM public.update_status_tier(r.user_id);
  END LOOP;
END;
$$;
