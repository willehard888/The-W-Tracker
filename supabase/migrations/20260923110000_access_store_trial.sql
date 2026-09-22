-- Access is membership. The free trial is Apple's now.
--
-- Every new account got 14 days of full access without a card
-- (`trial_started_at`), and met the paywall only when the clock ran out. The
-- trial lives in the App Store from here: both subscriptions carry a two-week
-- introductory free trial (scripts/asc-intro-offer.mjs), a new account meets
-- the paywall right after sign-up, and starting the trial through Apple is
-- what opens the app — RevenueCat's INITIAL_PURCHASE (period_type TRIAL)
-- grants is_elite like any purchase. The card is on the Apple ID; Apple
-- charges when the trial ends.
--
-- `trial_started_at` stays on the row (immutable trigger lists, handle_new_user
-- still stamps it) and means nothing for access any more. Accounts inside their
-- old in-app 14 days meet the paywall on their next launch and can start the
-- store trial there (0 purchases and ~13 accounts in prod on 2026-09-22).

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
      )
  );
$$;
