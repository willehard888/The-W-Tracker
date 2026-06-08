-- ============================================================
-- Security hardening: stop cross-user data exposure & self-escalation
-- ============================================================
-- 1. user_badges: was readable by ANYONE (anon included) via
--    `USING (true)` with no role restriction. Restrict to logged-in users.
-- 2. protect_profile_columns: extend the BEFORE UPDATE lock to cover the
--    membership/rank columns that bypassed it. Without this, a client could
--    UPDATE its own profile row to set is_apex_subscriber / legend_pinned and
--    self-grant Premium (effectiveMembership trusts those), or forge rank.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lock down user_badges reads to authenticated users
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Badges viewable by everyone" ON public.user_badges;
DROP POLICY IF EXISTS "Authenticated can view all badges" ON public.user_badges;
CREATE POLICY "Authenticated can view all badges"
  ON public.user_badges
  FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- 2. Expand the profile-column protection trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.xp             IS DISTINCT FROM OLD.xp
    OR NEW.level          IS DISTINCT FROM OLD.level
    OR NEW.streak         IS DISTINCT FROM OLD.streak
    OR NEW.longest_streak IS DISTINCT FROM OLD.longest_streak
    OR NEW.status_tier    IS DISTINCT FROM OLD.status_tier
    OR NEW.is_elite       IS DISTINCT FROM OLD.is_elite
    OR NEW.is_premium     IS DISTINCT FROM OLD.is_premium
    OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
    OR NEW.referral_count IS DISTINCT FROM OLD.referral_count
    OR NEW.referral_code  IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by    IS DISTINCT FROM OLD.referred_by
    -- membership / rank columns (added) — server functions only
    OR NEW.is_apex_subscriber       IS DISTINCT FROM OLD.is_apex_subscriber
    OR NEW.apex_credits_until       IS DISTINCT FROM OLD.apex_credits_until
    OR NEW.membership_credits_until IS DISTINCT FROM OLD.membership_credits_until
    OR NEW.legend_pinned            IS DISTINCT FROM OLD.legend_pinned
    OR NEW.rank_score               IS DISTINCT FROM OLD.rank_score
    OR NEW.trust_multiplier         IS DISTINCT FROM OLD.trust_multiplier
    THEN
      RAISE EXCEPTION
        'Protected profile columns can only be changed via server functions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_columns_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
