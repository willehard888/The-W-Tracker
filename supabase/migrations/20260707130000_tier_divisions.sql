-- ============================================================
-- Earned Status Ladder — Phase 2: divisions (III / II / I)
-- ============================================================
-- Adds sub-divisions inside the competitive tiers (operator..apex) so users get
-- far more frequent "rank up" moments. recruit + legend stay singular.
--   tier_division: 0 = none (recruit/legend); else 1 = III (bottom of tier),
--   2 = II, 3 = I (top of tier, closest to promotion).
-- update_status_tier now also computes the division from where the user sits
-- within their tier's percentile band. Preserves the Phase-1 founder override +
-- performance-only earning.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_division smallint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_status_tier(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users integer;
  user_rank integer;
  percentile numeric;
  new_tier status_tier;
  activity_days integer;
  user_streak integer;
  user_score numeric;
  v_division smallint;
  band_lo numeric;
  band_hi numeric;
  v_frac numeric;
BEGIN
  -- Founder/owner Legend override — curated, never from payment/referrals.
  IF (SELECT COALESCE(legend_pinned, false) FROM profiles WHERE user_id = target_user_id) THEN
    UPDATE profiles SET status_tier = 'legend', tier_division = 0 WHERE user_id = target_user_id;
    RETURN;
  END IF;

  PERFORM calculate_rank_score(target_user_id);
  SELECT rank_score INTO user_score FROM profiles WHERE user_id = target_user_id;

  IF user_score IS NULL OR user_score <= 0 THEN
    UPDATE profiles SET status_tier = 'recruit', tier_division = 0 WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT count(*) INTO total_users FROM profiles WHERE rank_score > 0;
  IF total_users = 0 THEN
    UPDATE profiles SET status_tier = 'recruit', tier_division = 0 WHERE user_id = target_user_id;
    RETURN;
  END IF;

  SELECT rn INTO user_rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY rank_score DESC) AS rn
    FROM profiles WHERE rank_score > 0
  ) r WHERE r.user_id = target_user_id;

  percentile := ((total_users - user_rank)::numeric / total_users::numeric) * 100;

  SELECT count(DISTINCT date(checked_in_at)) INTO activity_days
  FROM daily_checkins
  WHERE user_id = target_user_id AND checked_in_at >= now() - interval '30 days';

  SELECT COALESCE(streak, 0) INTO user_streak FROM profiles WHERE user_id = target_user_id;

  IF    percentile >= 99 AND activity_days >= 30 AND user_streak >= 45 THEN new_tier := 'legend';
  ELSIF percentile >= 90 AND activity_days >= 30 AND user_streak >= 30 THEN new_tier := 'apex';
  ELSIF percentile >= 80 OR (user_streak >= 30 AND activity_days >= 20)  THEN new_tier := 'elite';
  ELSIF percentile >= 70 OR (activity_days >= 15 AND user_streak >= 14)  THEN new_tier := 'high_performer';
  ELSIF percentile >= 50 AND activity_days >= 7 THEN new_tier := 'performer';
  ELSIF percentile >= 25 AND activity_days >= 5 THEN new_tier := 'operator';
  ELSE new_tier := 'recruit';
  END IF;

  -- Division = where the user sits within their tier's percentile band.
  -- recruit + legend are singular (0). Grind-path users below their band floor
  -- clamp to III (1). frac near the top of the band → I (3), closest to promotion.
  IF new_tier IN ('recruit', 'legend') THEN
    v_division := 0;
  ELSE
    band_lo := CASE new_tier
      WHEN 'operator' THEN 25 WHEN 'performer' THEN 50 WHEN 'high_performer' THEN 70
      WHEN 'elite' THEN 80 WHEN 'apex' THEN 90 ELSE 0 END;
    band_hi := CASE new_tier
      WHEN 'operator' THEN 50 WHEN 'performer' THEN 70 WHEN 'high_performer' THEN 80
      WHEN 'elite' THEN 90 WHEN 'apex' THEN 99 ELSE 100 END;
    v_frac := (percentile - band_lo) / NULLIF(band_hi - band_lo, 0);
    v_frac := LEAST(0.999, GREATEST(0, COALESCE(v_frac, 0)));
    v_division := 1 + floor(v_frac * 3)::int;   -- 1..3
  END IF;

  UPDATE profiles SET status_tier = new_tier, tier_division = v_division WHERE user_id = target_user_id;
END;
$$;

-- Protect tier_division from client spoofing (same lock as status_tier etc.).
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
    OR NEW.tier_division  IS DISTINCT FROM OLD.tier_division
    OR NEW.is_elite       IS DISTINCT FROM OLD.is_elite
    OR NEW.is_premium     IS DISTINCT FROM OLD.is_premium
    OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
    OR NEW.referral_count IS DISTINCT FROM OLD.referral_count
    OR NEW.referral_code  IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by    IS DISTINCT FROM OLD.referred_by
    THEN
      RAISE EXCEPTION
        'Protected profile columns (xp/level/streak/status_tier/tier_division/is_elite/is_premium/trial/referral) can only be changed via server functions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
