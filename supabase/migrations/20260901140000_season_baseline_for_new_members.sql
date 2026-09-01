-- ============================================================
-- Season baselines for members who join mid-season.
--
-- leaderboard_season_baselines is populated ONLY when a season is created,
-- as a snapshot of every profile that exists at that instant. Anyone who
-- signs up afterwards has no baseline row for the running season, and the
-- client falls back to `baseline := their current xp` — which makes their
-- season points exactly (xp - xp) = 0, permanently, no matter how much they
-- check in. A member who joined mid-season could never appear on the season
-- board until the next monthly rollover snapshotted them.
--
-- That was survivable while the board also listed every dormant account at
-- "0 SEASON XP" — a new member was merely lost in the noise. Now that the
-- board only lists people with season points (so old test accounts stop
-- padding it), a missing baseline would hide a genuinely active member
-- outright. Both halves have to land together.
--
-- Correct baseline for someone who joined DURING the season is 0: every point
-- of XP they have was earned inside it. For a pre-existing profile that is
-- somehow missing a row, we fall back to their current xp, which is neutral.
-- ============================================================

-- ─── Going forward: every new profile gets a baseline immediately ───
CREATE OR REPLACE FUNCTION public.seed_season_baseline_for_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
  SELECT s.id, NEW.user_id, COALESCE(NEW.xp, 0)
  FROM public.leaderboard_seasons s
  WHERE s.status = 'active'
    AND s.starts_at <= now()
    AND s.ends_at > now()
  ON CONFLICT (season_id, user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Leaderboard bookkeeping must NEVER abort account creation. This trigger
  -- runs inside handle_new_user's transaction; an unhandled error here would
  -- fail the signup itself. WARN so a permanently broken baseline path shows
  -- up in logs instead of silently costing new members a season.
  RAISE WARNING 'seed_season_baseline_for_new_profile failed for %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Replaces trg_new_profile_leaderboard_baseline (20260329083111), which did
-- the same insert but with no exception guard — a leaderboard hiccup there
-- could abort the whole signup. One trigger, guarded, wins.
DROP TRIGGER IF EXISTS trg_new_profile_leaderboard_baseline ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_new_profile_leaderboard_baseline();

DROP TRIGGER IF EXISTS tg_seed_season_baseline ON public.profiles;
CREATE TRIGGER tg_seed_season_baseline
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.seed_season_baseline_for_new_profile();

-- ─── Backfill: everyone currently missing a row for the live season ───
INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
SELECT s.id,
       p.user_id,
       CASE WHEN p.created_at >= s.starts_at THEN 0 ELSE COALESCE(p.xp, 0) END
FROM public.leaderboard_seasons s
CROSS JOIN public.profiles p
WHERE s.status = 'active'
  AND s.starts_at <= now()
  AND s.ends_at > now()
ON CONFLICT (season_id, user_id) DO NOTHING;
