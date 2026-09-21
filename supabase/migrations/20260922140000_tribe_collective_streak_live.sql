-- tribes.collective_streak was only recomputed nightly (refresh_tribe_fire), so
-- the tribe page — which sums its members live — read "3 days" while the
-- battles screen one tap away, the tribe list and the leaderboard still read
-- last night's "2d". The column now follows its inputs: a member's streak
-- changing, or the membership changing.
--
-- fire_tier, weekly_xp and the tier_up milestone stay with the nightly job:
-- promotion is an event with side effects, not a number to keep in sync.

CREATE OR REPLACE FUNCTION public.refresh_tribe_collective(p_tribe_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tribes t
  SET collective_streak = s.total,
      longest_collective = GREATEST(COALESCE(t.longest_collective, 0), s.total)
  FROM (
    SELECT COALESCE(SUM(p.streak), 0)::int AS total
    FROM tribe_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.tribe_id = p_tribe_id AND tm.status = 'active'
  ) s
  WHERE t.id = p_tribe_id AND t.collective_streak IS DISTINCT FROM s.total;
$$;

REVOKE ALL ON FUNCTION public.refresh_tribe_collective(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_profile_streak_to_tribes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tribe_id FROM tribe_members WHERE user_id = NEW.user_id AND status = 'active' LOOP
    PERFORM public.refresh_tribe_collective(r.tribe_id);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_streak_to_tribes ON public.profiles;
CREATE TRIGGER trg_profile_streak_to_tribes
  AFTER UPDATE OF streak ON public.profiles
  FOR EACH ROW
  WHEN (NEW.streak IS DISTINCT FROM OLD.streak)
  EXECUTE FUNCTION public.tg_profile_streak_to_tribes();

-- Membership changes move the sum too; the count trigger from the previous
-- migration already fires on exactly those rows.
CREATE OR REPLACE FUNCTION public.tribe_members_touch_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Listing the column is enough to fire the recount.
  UPDATE tribes SET member_count = member_count WHERE id = COALESCE(NEW.tribe_id, OLD.tribe_id);
  PERFORM public.refresh_tribe_collective(COALESCE(NEW.tribe_id, OLD.tribe_id));
  IF TG_OP = 'UPDATE' AND NEW.tribe_id IS DISTINCT FROM OLD.tribe_id THEN
    UPDATE tribes SET member_count = member_count WHERE id = OLD.tribe_id;
    PERFORM public.refresh_tribe_collective(OLD.tribe_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Catch up now rather than at 03:20.
SELECT public.refresh_tribe_collective(id) FROM public.tribes;
