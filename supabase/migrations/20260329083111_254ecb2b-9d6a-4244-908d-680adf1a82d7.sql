-- Seasonal leaderboard infrastructure
CREATE TYPE public.leaderboard_season_status AS ENUM ('active', 'completed');

CREATE TABLE public.leaderboard_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.leaderboard_season_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leaderboard_season_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  baseline_xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

CREATE TABLE public.leaderboard_champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username_snapshot TEXT,
  season_points INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT NOT NULL DEFAULT 'season_champion',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

CREATE INDEX idx_leaderboard_seasons_status_dates ON public.leaderboard_seasons(status, starts_at, ends_at);
CREATE INDEX idx_leaderboard_baselines_season_user ON public.leaderboard_season_baselines(season_id, user_id);
CREATE INDEX idx_leaderboard_champions_user ON public.leaderboard_champions(user_id);

ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_season_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_champions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard seasons viewable by everyone"
ON public.leaderboard_seasons
FOR SELECT
USING (true);

CREATE POLICY "Leaderboard baselines viewable by everyone"
ON public.leaderboard_season_baselines
FOR SELECT
USING (true);

CREATE POLICY "Leaderboard champions viewable by everyone"
ON public.leaderboard_champions
FOR SELECT
USING (true);

-- Champion badge reward
INSERT INTO public.badges (name, description, icon, rarity, category, requirement_type, requirement_value)
VALUES (
  'Season Champion',
  'Finished #1 in a leaderboard season',
  '🏆',
  'legendary',
  'leaderboard',
  'season_champion',
  1
)
ON CONFLICT DO NOTHING;

-- Finalize ended seasons, reward winners, and create the next season
CREATE OR REPLACE FUNCTION public.finalize_expired_leaderboard_seasons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  season_rec RECORD;
  winner_rec RECORD;
  next_season_id UUID;
  champion_badge_id UUID;
BEGIN
  SELECT id INTO champion_badge_id
  FROM public.badges
  WHERE requirement_type = 'season_champion'
  ORDER BY created_at ASC
  LIMIT 1;

  FOR season_rec IN
    SELECT *
    FROM public.leaderboard_seasons
    WHERE status = 'active'
      AND ends_at <= now()
    ORDER BY ends_at ASC
  LOOP
    SELECT
      p.user_id,
      p.username,
      GREATEST(p.xp - COALESCE(b.baseline_xp, p.xp), 0) AS season_points
    INTO winner_rec
    FROM public.profiles p
    LEFT JOIN public.leaderboard_season_baselines b
      ON b.season_id = season_rec.id
     AND b.user_id = p.user_id
    ORDER BY season_points DESC, p.xp DESC, p.created_at ASC
    LIMIT 1;

    IF winner_rec.user_id IS NOT NULL THEN
      INSERT INTO public.leaderboard_champions (season_id, user_id, username_snapshot, season_points, reward_type)
      VALUES (season_rec.id, winner_rec.user_id, winner_rec.username, winner_rec.season_points, 'season_champion')
      ON CONFLICT (season_id, user_id) DO NOTHING;

      IF champion_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (winner_rec.user_id, champion_badge_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    UPDATE public.leaderboard_seasons
    SET status = 'completed'
    WHERE id = season_rec.id;

    INSERT INTO public.leaderboard_seasons (name, starts_at, ends_at, status)
    VALUES (
      CONCAT('Season ', to_char(season_rec.ends_at, 'YYYY-MM-DD')),
      season_rec.ends_at,
      season_rec.ends_at + interval '30 days',
      'active'
    )
    RETURNING id INTO next_season_id;

    INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
    SELECT next_season_id, p.user_id, p.xp
    FROM public.profiles p
    ON CONFLICT (season_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Ensure active season exists and rotate if needed
CREATE OR REPLACE FUNCTION public.ensure_active_leaderboard_season()
RETURNS public.leaderboard_seasons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_season public.leaderboard_seasons%ROWTYPE;
BEGIN
  PERFORM public.finalize_expired_leaderboard_seasons();

  SELECT *
  INTO active_season
  FROM public.leaderboard_seasons
  WHERE status = 'active'
    AND starts_at <= now()
    AND ends_at > now()
  ORDER BY starts_at DESC
  LIMIT 1;

  IF active_season.id IS NULL THEN
    INSERT INTO public.leaderboard_seasons (name, starts_at, ends_at, status)
    VALUES (
      CONCAT('Season ', to_char(now(), 'YYYY-MM-DD')),
      date_trunc('day', now()),
      date_trunc('day', now()) + interval '30 days',
      'active'
    )
    RETURNING * INTO active_season;

    INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
    SELECT active_season.id, p.user_id, p.xp
    FROM public.profiles p
    ON CONFLICT (season_id, user_id) DO NOTHING;
  END IF;

  RETURN active_season;
END;
$$;

-- Add baseline for newly created profiles in active season
CREATE OR REPLACE FUNCTION public.handle_new_profile_leaderboard_baseline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_season_id UUID;
BEGIN
  SELECT id
  INTO active_season_id
  FROM public.leaderboard_seasons
  WHERE status = 'active'
    AND starts_at <= now()
    AND ends_at > now()
  ORDER BY starts_at DESC
  LIMIT 1;

  IF active_season_id IS NOT NULL THEN
    INSERT INTO public.leaderboard_season_baselines (season_id, user_id, baseline_xp)
    VALUES (active_season_id, NEW.user_id, NEW.xp)
    ON CONFLICT (season_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_profile_leaderboard_baseline ON public.profiles;
CREATE TRIGGER trg_new_profile_leaderboard_baseline
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_profile_leaderboard_baseline();

GRANT EXECUTE ON FUNCTION public.finalize_expired_leaderboard_seasons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_active_leaderboard_season() TO authenticated;

-- Initialize first season if missing
SELECT public.ensure_active_leaderboard_season();