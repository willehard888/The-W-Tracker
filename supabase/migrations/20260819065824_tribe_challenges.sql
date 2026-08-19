-- ============================================================
-- Weekly tribe challenge (E3 of the tribe core program).
--
-- Every tribe gets an auto-assigned collective goal each calendar week
-- (Mon–Sun UTC): total check-ins ≥ active members × 5. Progress ticks
-- on every member check-in; hitting the target completes the challenge
-- instantly (+25 XP per active member, milestone). Unfinished weeks
-- are marked failed by a Monday-night cron. This also fixes the cold
-- start: a brand-new tribe is born with a goal on the table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tribe_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id     uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  week_start   date NOT NULL,
  metric       text NOT NULL DEFAULT 'checkins' CHECK (metric IN ('checkins')),
  target       int  NOT NULL CHECK (target > 0),
  progress     int  NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed')),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tribe_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_tribe_challenges_week ON public.tribe_challenges (week_start, status);

ALTER TABLE public.tribe_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenges visible with the tribe" ON public.tribe_challenges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tribes t
      WHERE t.id = tribe_challenges.tribe_id
        AND (t.visibility = 'public' OR public.is_tribe_member(t.id, auth.uid()))
    )
  );
-- All writes via SECURITY DEFINER functions below.

-- Idempotent: give the tribe this week's challenge if it doesn't have one.
-- Target scales with the roster: members × 5 check-ins, floor 5.
CREATE OR REPLACE FUNCTION public.ensure_tribe_challenge(p_tribe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week date := date_trunc('week', now())::date;
  v_members int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tribes WHERE id = p_tribe_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM tribe_challenges WHERE tribe_id = p_tribe_id AND week_start = v_week) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO v_members FROM tribe_members
  WHERE tribe_id = p_tribe_id AND status = 'active';
  INSERT INTO tribe_challenges (tribe_id, week_start, target)
  VALUES (p_tribe_id, v_week, GREATEST(5, v_members * 5))
  ON CONFLICT (tribe_id, week_start) DO NOTHING;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_tribe_challenge(uuid) TO authenticated;

-- New tribes are born with a goal (extends the founded trigger from E2).
CREATE OR REPLACE FUNCTION public.tg_tribe_founded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO tribe_milestones (tribe_id, kind, payload)
  VALUES (NEW.id, 'founded', jsonb_build_object('name', NEW.name));
  PERFORM public.ensure_tribe_challenge(NEW.id);
  RETURN NEW;
END $$;

-- Progress: every check-in feeds every active tribe's current-week
-- challenge. EXCEPTION-guarded — the check-in must never fail on this.
CREATE OR REPLACE FUNCTION public.tg_tribe_challenge_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_week date := date_trunc('week', now())::date;
  v_claimed int;
BEGIN
  BEGIN
    FOR r IN
      UPDATE tribe_challenges c
      SET progress = c.progress + 1
      FROM tribe_members tm
      WHERE tm.user_id = NEW.user_id
        AND tm.status = 'active'
        AND c.tribe_id = tm.tribe_id
        AND c.week_start = v_week
        AND c.status = 'active'
      RETURNING c.id, c.tribe_id, c.progress, c.target
    LOOP
      IF r.progress >= r.target THEN
        -- CAS: only one transaction gets to complete + award.
        UPDATE tribe_challenges
        SET status = 'completed', completed_at = now()
        WHERE id = r.id AND status = 'active';
        GET DIAGNOSTICS v_claimed = ROW_COUNT;
        IF v_claimed = 1 THEN
          INSERT INTO tribe_milestones (tribe_id, kind, payload)
          VALUES (r.tribe_id, 'challenge_done',
                  jsonb_build_object('target', r.target, 'week', v_week));
          UPDATE profiles
          SET xp = xp + 25, updated_at = now()
          WHERE user_id IN (
            SELECT user_id FROM tribe_members
            WHERE tribe_id = r.tribe_id AND status = 'active'
          );
        END IF;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never let challenge bookkeeping break a check-in
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS daily_checkins_tribe_challenge ON public.daily_checkins;
CREATE TRIGGER daily_checkins_tribe_challenge
  AFTER INSERT ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_challenge_progress();

-- Close out past weeks that never hit target.
CREATE OR REPLACE FUNCTION public.close_tribe_challenges()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE tribe_challenges
  SET status = 'failed'
  WHERE status = 'active'
    AND week_start < date_trunc('week', now())::date;
END $$;
REVOKE ALL ON FUNCTION public.close_tribe_challenges() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule('tribe-challenges-close');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('tribe-challenges-close', '10 0 * * 1',
    'SELECT public.close_tribe_challenges()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule tribe-challenges-close manually';
END $$;

-- Seed this week's challenge for every existing tribe.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM tribes LOOP
    PERFORM public.ensure_tribe_challenge(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
