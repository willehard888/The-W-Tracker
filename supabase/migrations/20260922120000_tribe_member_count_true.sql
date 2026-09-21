-- tribes.member_count is a counter that six functions kept by hand (+1 on
-- join/accept/approve, -1 on leave/remove). Account deletion cascades the
-- tribe_members rows and never touched it, so "The W Group" read 5 members
-- with 4 rows — beside "1/4 lit today" on the same card.
--
-- The counter now derives from the rows every time it is written: a BEFORE
-- UPDATE OF member_count trigger replaces whatever value was set with the live
-- active count, and any change to tribe_members touches the counter so the
-- cascade path recounts too. The hand-kept ±1 in the existing functions still
-- runs; it is simply overwritten with the truth.

CREATE OR REPLACE FUNCTION public.tribe_member_count_true()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.member_count := (
    SELECT count(*)::int FROM tribe_members
    WHERE tribe_id = NEW.id AND status = 'active'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tribe_member_count_true ON public.tribes;
CREATE TRIGGER trg_tribe_member_count_true
  BEFORE UPDATE OF member_count ON public.tribes
  FOR EACH ROW EXECUTE FUNCTION public.tribe_member_count_true();

CREATE OR REPLACE FUNCTION public.tribe_members_touch_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Listing the column is enough to fire the recount above.
  UPDATE tribes SET member_count = member_count WHERE id = COALESCE(NEW.tribe_id, OLD.tribe_id);
  IF TG_OP = 'UPDATE' AND NEW.tribe_id IS DISTINCT FROM OLD.tribe_id THEN
    UPDATE tribes SET member_count = member_count WHERE id = OLD.tribe_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tribe_members_touch_count ON public.tribe_members;
CREATE TRIGGER trg_tribe_members_touch_count
  AFTER INSERT OR DELETE OR UPDATE OF status, tribe_id ON public.tribe_members
  FOR EACH ROW EXECUTE FUNCTION public.tribe_members_touch_count();

-- One resync for the drift already in the table.
UPDATE public.tribes SET member_count = member_count;
