-- Update season rotation to use 1st of each month instead of 30-day rolling windows

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
  next_month_start TIMESTAMPTZ;
  next_month_end TIMESTAMPTZ;
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

    -- Next season starts on 1st of the following month
    next_month_start := date_trunc('month', season_rec.ends_at);
    IF next_month_start <= season_rec.ends_at THEN
      next_month_start := date_trunc('month', season_rec.ends_at + interval '1 day');
    END IF;
    next_month_end := next_month_start + interval '1 month';

    INSERT INTO public.leaderboard_seasons (name, starts_at, ends_at, status)
    VALUES (
      to_char(next_month_start, 'Month YYYY'),
      next_month_start,
      next_month_end,
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

-- Update ensure function to create monthly seasons
CREATE OR REPLACE FUNCTION public.ensure_active_leaderboard_season()
RETURNS public.leaderboard_seasons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_season public.leaderboard_seasons%ROWTYPE;
  month_start TIMESTAMPTZ;
  month_end TIMESTAMPTZ;
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
    month_start := date_trunc('month', now());
    month_end := month_start + interval '1 month';

    INSERT INTO public.leaderboard_seasons (name, starts_at, ends_at, status)
    VALUES (
      to_char(month_start, 'Month YYYY'),
      month_start,
      month_end,
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

-- Fix existing active season to end on 1st of next month
UPDATE public.leaderboard_seasons
SET 
  name = to_char(date_trunc('month', now()), 'Month YYYY'),
  starts_at = date_trunc('month', now()),
  ends_at = date_trunc('month', now()) + interval '1 month'
WHERE status = 'active';