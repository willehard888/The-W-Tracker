-- ============================================================
-- Pilot: one trial length for everyone — 14 days.
--
-- has_active_access() gave organic signups 7 days and referred signups 14,
-- while every piece of user-facing copy (Auth, PremiumHero, TrialExpirySheet)
-- promised 14 to all of them. The majority of signups are organic, so the
-- majority were told 14 and given 7.
--
-- A previous fix shortened the CLIENT countdown to match the server. That made
-- the pill honest but left the promise broken. For the pilot we do the
-- opposite: raise the server to the number we actually advertise. The client
-- half of this change lives in src/hooks/use-trial-access.ts — the two must
-- always move together or the app goes dark while the header says "6d left".
--
-- Everything else in the function is reproduced verbatim from
-- 20260422100359 (apex credits, membership credits, elite flags).
-- ============================================================

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
        OR is_apex_subscriber = true
        OR (apex_credits_until IS NOT NULL AND apex_credits_until > now())
        OR (membership_credits_until IS NOT NULL AND membership_credits_until > now())
        OR trial_started_at > now() - interval '14 days'
      )
  );
$function$;
