-- ============================================================
-- Tribe fire, server-owned (E2 of the tribe core program).
--
-- Until now the "collective fire" was a client-side sum of member
-- streaks — no history, nothing to push on, and the leaderboard
-- re-scanned every check-in in the database on every open. Now the
-- server owns the numbers and a nightly refresh keeps them true.
-- ============================================================

ALTER TABLE public.tribes ADD COLUMN IF NOT EXISTS collective_streak int NOT NULL DEFAULT 0;
ALTER TABLE public.tribes ADD COLUMN IF NOT EXISTS fire_tier int NOT NULL DEFAULT -1;
ALTER TABLE public.tribes ADD COLUMN IF NOT EXISTS weekly_xp int NOT NULL DEFAULT 0;
ALTER TABLE public.tribes ADD COLUMN IF NOT EXISTS longest_collective int NOT NULL DEFAULT 0;

-- ── Milestone ledger — the tribe's memory ────────────────────
CREATE TABLE IF NOT EXISTS public.tribe_milestones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id   uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('founded','member_joined','tier_up','battle_won','challenge_done')),
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tribe_milestones_tribe ON public.tribe_milestones (tribe_id, created_at DESC);

ALTER TABLE public.tribe_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestones visible with the tribe" ON public.tribe_milestones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tribes t
      WHERE t.id = tribe_milestones.tribe_id
        AND (t.visibility = 'public' OR public.is_tribe_member(t.id, auth.uid()))
    )
  );
-- Writes happen only via SECURITY DEFINER functions/triggers below.

-- founded — stamped when a tribe is born
CREATE OR REPLACE FUNCTION public.tg_tribe_founded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO tribe_milestones (tribe_id, kind, payload)
  VALUES (NEW.id, 'founded', jsonb_build_object('name', NEW.name));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tribes_founded ON public.tribes;
CREATE TRIGGER tribes_founded AFTER INSERT ON public.tribes
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_founded();

-- member_joined — only on an ACTIVE membership appearing
CREATE OR REPLACE FUNCTION public.tg_tribe_member_joined()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.status = 'active' AND NEW.role <> 'owner'
     AND (TG_OP = 'INSERT' OR OLD.status <> 'active') THEN
    SELECT username INTO v_name FROM profiles WHERE user_id = NEW.user_id;
    INSERT INTO tribe_milestones (tribe_id, kind, payload)
    VALUES (NEW.tribe_id, 'member_joined', jsonb_build_object('username', COALESCE(v_name, '?')));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tribe_members_joined ON public.tribe_members;
CREATE TRIGGER tribe_members_joined AFTER INSERT OR UPDATE OF status ON public.tribe_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_member_joined();

-- battle_won — stamped by resolve, for both winner's timeline visibility
CREATE OR REPLACE FUNCTION public.tg_tribe_battle_won()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_loser uuid; v_winner_name text; v_loser_name text;
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' AND NEW.winner_tribe_id IS NOT NULL THEN
    v_loser := CASE WHEN NEW.winner_tribe_id = NEW.challenger_tribe_id
                    THEN NEW.opponent_tribe_id ELSE NEW.challenger_tribe_id END;
    SELECT name INTO v_winner_name FROM tribes WHERE id = NEW.winner_tribe_id;
    SELECT name INTO v_loser_name FROM tribes WHERE id = v_loser;
    INSERT INTO tribe_milestones (tribe_id, kind, payload)
    VALUES (NEW.winner_tribe_id, 'battle_won',
            jsonb_build_object('opponent', COALESCE(v_loser_name, '?'),
                               'score', NEW.challenger_score || '–' || NEW.opponent_score));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tribe_battles_won ON public.tribe_battles;
CREATE TRIGGER tribe_battles_won AFTER UPDATE OF status ON public.tribe_battles
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_battle_won();

-- ── Nightly truth refresh ────────────────────────────────────
-- Collective streak = sum of active members' personal streaks (the exact
-- semantic the client has always rendered); weekly_xp = rolling 7 days.
-- Tier ladder mirrors src/lib/tribe-streak.ts (30/100/300/700/1500/3000/6000).
CREATE OR REPLACE FUNCTION public.refresh_tribe_fire()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_streak int;
  v_weekly int;
  v_tier int;
BEGIN
  FOR r IN SELECT id, fire_tier, longest_collective FROM tribes LOOP
    SELECT COALESCE(SUM(p.streak), 0) INTO v_streak
    FROM tribe_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.tribe_id = r.id AND tm.status = 'active';

    SELECT COALESCE(SUM(dc.xp_earned), 0) INTO v_weekly
    FROM daily_checkins dc
    WHERE dc.checked_in_at >= now() - interval '7 days'
      AND dc.user_id IN (
        SELECT user_id FROM tribe_members
        WHERE tribe_id = r.id AND status = 'active'
      );

    v_tier := CASE
      WHEN v_streak >= 6000 THEN 6
      WHEN v_streak >= 3000 THEN 5
      WHEN v_streak >= 1500 THEN 4
      WHEN v_streak >= 700  THEN 3
      WHEN v_streak >= 300  THEN 2
      WHEN v_streak >= 100  THEN 1
      WHEN v_streak >= 30   THEN 0
      ELSE -1
    END;

    UPDATE tribes
    SET collective_streak = v_streak,
        weekly_xp = v_weekly,
        fire_tier = v_tier,
        longest_collective = GREATEST(r.longest_collective, v_streak)
    WHERE id = r.id;

    IF v_tier > r.fire_tier AND v_tier >= 0 THEN
      INSERT INTO tribe_milestones (tribe_id, kind, payload)
      VALUES (r.id, 'tier_up', jsonb_build_object('tier', v_tier, 'streak', v_streak));
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.refresh_tribe_fire() FROM PUBLIC, anon, authenticated;

-- Nightly at 03:20 UTC, right after sync-streaks (03:00) has settled streaks.
DO $$ BEGIN PERFORM cron.unschedule('tribe-fire-refresh');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('tribe-fire-refresh', '20 3 * * *',
    'SELECT public.refresh_tribe_fire()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule tribe-fire-refresh manually';
END $$;

-- Seed the columns immediately so clients see real numbers today.
SELECT public.refresh_tribe_fire();

-- ── Leaderboard v2: read the owned columns ───────────────────
-- Same signature and shape; weekly now O(tribes) instead of scanning
-- every member's every check-in on each call.
CREATE OR REPLACE FUNCTION public.get_tribe_leaderboard(p_period text DEFAULT 'weekly', p_limit int DEFAULT 50)
RETURNS TABLE (
  tribe_id uuid,
  name text,
  slug text,
  cover_url text,
  visibility text,
  member_count int,
  score bigint,
  rank int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF p_period NOT IN ('weekly','all_time') THEN
    RAISE EXCEPTION 'Invalid period';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT t.id, t.name, t.slug, t.cover_url, t.visibility, t.member_count, t.weekly_xp
    FROM tribes t
    WHERE t.visibility = 'public'
       OR (v_user IS NOT NULL AND (
            t.owner_id = v_user
            OR EXISTS (
              SELECT 1 FROM tribe_members tm
              WHERE tm.tribe_id = t.id AND tm.user_id = v_user AND tm.status = 'active'
            )
          ))
  ),
  scored AS (
    SELECT
      e.id, e.name, e.slug, e.cover_url, e.visibility, e.member_count,
      CASE
        WHEN p_period = 'weekly' THEN e.weekly_xp::bigint
        ELSE COALESCE((
          SELECT SUM(p.xp)::bigint FROM profiles p
          WHERE p.user_id IN (
            SELECT tm.user_id FROM tribe_members tm
            WHERE tm.tribe_id = e.id AND tm.status = 'active'
          )
        ), 0)
      END AS score
    FROM eligible e
  )
  SELECT s.id, s.name, s.slug, s.cover_url, s.visibility, s.member_count, s.score,
         ROW_NUMBER() OVER (ORDER BY s.score DESC, s.member_count DESC)::int AS rank
  FROM scored s
  ORDER BY s.score DESC, s.member_count DESC
  LIMIT p_limit;
END $$;

NOTIFY pgrst, 'reload schema';
