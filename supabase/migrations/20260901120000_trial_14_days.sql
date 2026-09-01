-- ============================================================
-- Trial: flat 14 days for everyone (was 7 organic / 14 referred).
-- Founder decision 2026-09-01 alongside the app-wide paywall launch
-- (8,99 €/mo · 89,99 €/yr): one trial length, one story — every copy
-- surface already says "14-day free trial". has_premium is deliberately
-- NOT touched: posting to the Elite Feed stays members-only.
-- Client mirror: src/hooks/use-trial-access.ts must match.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND (
        is_elite = true
        OR is_apex_subscriber = true
        OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
        OR (membership_credits_until IS NOT NULL AND membership_credits_until > now())
        OR trial_started_at > now() - interval '14 days'
      )
  );
$$;
