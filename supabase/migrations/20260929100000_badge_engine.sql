-- Badge round (2026-09-29), batch 1 — one badge engine.
--
-- Three stat computations had drifted apart: user_badge_stats() (the client's
-- gate), award_badge_if_earned() (the server's re-check — still the old core-8
-- "perfect day" while the gate read score_breakdown, so a perfect-day badge
-- was offered and then silently refused), and the client mirror in
-- src/lib/badge-awards.ts (two maps that disagreed; level badges showed 0 %).
-- Trigger-awarded badges (likes, comments, kudos, season, paid referrals)
-- carried their own thresholds and told the member nothing. Top 1/5/10 % had
-- no producer at all. "Iron Mind" measured the meditation total, not a run.
--
-- Now: badge_stats() is the one computation, award_earned_badges_for() the
-- one award pass (every path calls it, so a new badge is a catalogue row),
-- and an AFTER INSERT trigger on user_badges writes the bell row. The old
-- RPC names stay as wrappers for builds in the field; drop them next round.
--
-- Order matters at the end: the silent backfill runs BEFORE the bell trigger
-- exists, or every member wakes up to a burst of "unlocked" rows for badges
-- the new definitions award retroactively.

-- ── 0. The catalogue's keys, normalised ────────────────────────────────────
-- streak and personal_streak both meant profiles.longest_streak.
UPDATE public.badges SET requirement_type = 'longest_streak'
 WHERE requirement_type IN ('streak', 'personal_streak');
UPDATE public.badges SET requirement_type = 'cold_shower'  WHERE requirement_type = 'cold_showers';
UPDATE public.badges SET requirement_type = 'workouts'     WHERE requirement_type IN ('combat_workouts', 'run_workouts');
UPDATE public.badges SET requirement_type = 'xp'           WHERE requirement_type = 'total_xp';
UPDATE public.badges SET requirement_type = 'leaderboard_percentile' WHERE requirement_type = 'percentile';
-- Enlightened: 300 sessions (morning + evening count separately, as they
-- always have) — the founder's number, 2026-09-29.
UPDATE public.badges
   SET requirement_value = 300, description = '300 meditation sessions. Morning and evening both count.'
 WHERE name = 'Enlightened' AND requirement_type = 'meditation';

-- ── 1. badge_stats ─────────────────────────────────────────────────────────
-- Every key the catalogue can name, in one pass. SECURITY INVOKER: a member
-- asking about another uid sees only what RLS lets them see (their own
-- check-ins are the private part), and the definer callers below see all.
CREATE OR REPLACE FUNCTION public.badge_stats(p_user uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
WITH p AS (SELECT * FROM profiles WHERE user_id = p_user),
dc AS (
  SELECT count(*) AS checkins,
         count(*) FILTER (WHERE d.workout)               AS workouts,
         count(*) FILTER (WHERE d.cold_shower)           AS cold_shower,
         count(*) FILTER (WHERE d.healthy_food)          AS healthy_food,
         count(*) FILTER (WHERE d.protein_intake)        AS protein,
         count(*) FILTER (WHERE d.hydration_liters >= 3) AS hydration,
         count(*) FILTER (WHERE d.no_phone_morning)      AS no_phone_morning,
         count(*) FILTER (WHERE d.no_phone_evening)      AS no_phone_evening,
         count(*) FILTER (WHERE d.reading)               AS reading,
         count(*) FILTER (WHERE d.extra_workout)         AS double_workout,
         count(*) FILTER (WHERE d.meditation_morning) + count(*) FILTER (WHERE d.meditation_evening) AS meditation,
         count(*) FILTER (WHERE d.proof_photo_url IS NOT NULL) AS proofs,
         count(*) FILTER (WHERE d.verified_at IS NOT NULL)     AS verified_days,
         count(*) FILTER (WHERE (d.score_breakdown ->> 'total')::int >= 100) AS full_days,
         count(*) FILTER (WHERE (d.score_breakdown ->> 'total')::int >= 150) AS health_days,
         count(*) FILTER (WHERE ln.perfect > 0)    AS perfect_day,
         count(*) FILTER (WHERE ln.training = 50)  AS max_effort_days,
         count(*) FILTER (WHERE ln.sleep = 25)     AS full_sleep_nights,
         count(*) FILTER (WHERE ln.steps = 10)     AS step_days,
         count(*) FILTER (WHERE ln.mind = 15)      AS mind_days
    FROM daily_checkins d
    LEFT JOIN LATERAL (
      SELECT max((l ->> 'pts')::int) FILTER (WHERE l ->> 'k' = 'perfect')  AS perfect,
             max((l ->> 'pts')::int) FILTER (WHERE l ->> 'k' = 'training') AS training,
             max((l ->> 'pts')::int) FILTER (WHERE l ->> 'k' = 'sleep')    AS sleep,
             max((l ->> 'pts')::int) FILTER (WHERE l ->> 'k' = 'steps')    AS steps,
             max((l ->> 'pts')::int) FILTER (WHERE l ->> 'k' = 'mind')     AS mind
        FROM jsonb_array_elements(COALESCE(d.score_breakdown -> 'lines', '[]'::jsonb)) l
    ) ln ON true
   WHERE d.user_id = p_user
),
-- Longest run of consecutive local days with a meditation tick (gaps and islands).
med AS (
  SELECT COALESCE(max(n), 0) AS longest FROM (
    SELECT count(*) AS n FROM (
      SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp FROM (
        SELECT DISTINCT public.checkin_local_day(d) AS day
          FROM daily_checkins d
         WHERE d.user_id = p_user AND (d.meditation_morning OR d.meditation_evening)) x) y
     GROUP BY grp) z
),
-- The same population update_status_tier ranks; ties share the best rank.
rk AS (
  SELECT count(*) AS total,
         1 + count(*) FILTER (WHERE r.rank_score > COALESCE((SELECT rank_score FROM p), 0)) AS mine
    FROM profiles r WHERE r.rank_score > 0
),
my_tribes AS (SELECT tribe_id FROM tribe_members WHERE user_id = p_user AND status = 'active'),
owned     AS (SELECT id AS tribe_id FROM tribes WHERE owner_id = p_user),
mins AS (
  SELECT tm.tribe_id, min(COALESCE(pr.streak, 0)) AS min_streak
    FROM tribe_members tm JOIN profiles pr ON pr.user_id = tm.user_id
   WHERE tm.status = 'active'
     AND tm.tribe_id IN (SELECT tribe_id FROM my_tribes UNION SELECT tribe_id FROM owned)
   GROUP BY tm.tribe_id
),
-- One key per vault_master:<slugs> row in the catalogue.
vm AS (
  SELECT t.requirement_type AS k,
         (SELECT count(*) FROM vault_lesson_progress vp JOIN vault_articles a ON a.id = vp.article_id
           WHERE vp.user_id = p_user AND vp.practiced_at IS NOT NULL
             AND a.master_slug = ANY (string_to_array(substr(t.requirement_type, 14), ','))) AS v
    FROM (SELECT DISTINCT requirement_type FROM badges WHERE requirement_type LIKE 'vault_master:%') t
)
SELECT jsonb_build_object(
  'checkins', dc.checkins, 'workouts', dc.workouts, 'cold_shower', dc.cold_shower,
  'healthy_food', dc.healthy_food, 'protein', dc.protein, 'hydration', dc.hydration,
  'no_phone_morning', dc.no_phone_morning, 'no_phone_evening', dc.no_phone_evening,
  'reading', dc.reading, 'double_workout', dc.double_workout, 'meditation', dc.meditation,
  'proofs', dc.proofs, 'perfect_day', dc.perfect_day,
  'verified_days', dc.verified_days, 'full_days', dc.full_days, 'health_days', dc.health_days,
  'max_effort_days', dc.max_effort_days, 'full_sleep_nights', dc.full_sleep_nights,
  'step_days', dc.step_days, 'mind_days', dc.mind_days,
  'meditation_streak', med.longest,
  'battles_won',       (SELECT count(*) FROM battles WHERE winner_id = p_user),
  'referrals',         (SELECT count(*) FROM referrals WHERE referrer_id = p_user),
  'paid_referrals',    (SELECT count(*) FROM referrals WHERE referrer_id = p_user AND converted),
  'vault_practices',   (SELECT count(*) FROM vault_lesson_progress WHERE user_id = p_user AND practiced_at IS NOT NULL),
  'total_likes',       (SELECT COALESCE(sum(likes_count), 0) FROM feed_posts WHERE user_id = p_user),
  'single_post_likes', (SELECT COALESCE(max(likes_count), 0) FROM feed_posts WHERE user_id = p_user),
  'total_comments',    (SELECT count(*) FROM feed_comments WHERE user_id = p_user),
  'total_kudos',       (SELECT count(*) FROM kudos WHERE receiver_id = p_user),
  'season_champion',   (SELECT count(*) FROM leaderboard_champions WHERE user_id = p_user),
  'tribe_battles_won', (SELECT count(*) FROM tribe_battles tb
                         WHERE tb.status = 'completed' AND tb.winner_tribe_id IN (SELECT tribe_id FROM my_tribes)),
  'tribe_collective_streak', COALESCE((SELECT max(min_streak) FROM mins WHERE tribe_id IN (SELECT tribe_id FROM my_tribes)), 0),
  'tribe_founder_streak',    COALESCE((SELECT max(min_streak) FROM mins WHERE tribe_id IN (SELECT tribe_id FROM owned)), 0),
  'xp', COALESCE(p.xp, 0), 'level', COALESCE(p.level, 1), 'longest_streak', COALESCE(p.longest_streak, 0),
  'elite_member',     COALESCE(p.is_elite, false)::int,
  'phoenix_recovery', (COALESCE(p.longest_streak, 0) >= 30 AND COALESCE(p.streak, 0) >= 30 AND p.longest_streak > p.streak)::int,
  'apex_reached',     (p.status_tier IN ('apex', 'legend'))::int,
  'legend_reached',   (p.status_tier = 'legend' OR COALESCE(p.legend_pinned, false))::int,
  'apex_founding',    (COALESCE(p.is_apex_subscriber, false) AND p.apex_subscription_started_at IS NOT NULL)::int,
  'apex_held_days',   CASE WHEN p.status_tier IN ('apex', 'legend') AND p.apex_subscription_started_at IS NOT NULL
                           THEN floor(extract(epoch FROM now() - p.apex_subscription_started_at) / 86400) ELSE 0 END,
  'legend_held_days', CASE WHEN (p.status_tier = 'legend' OR COALESCE(p.legend_pinned, false)) AND p.apex_subscription_started_at IS NOT NULL
                           THEN floor(extract(epoch FROM now() - p.apex_subscription_started_at) / 86400) ELSE 0 END,
  -- "Top N %": rank / total × 100, lower is better. Top 1 % needs a hundred ranked members.
  'leaderboard_percentile', CASE WHEN COALESCE(p.rank_score, 0) <= 0 OR rk.total = 0 THEN 100
                                 ELSE round(100.0 * rk.mine / rk.total, 2) END
) || COALESCE((SELECT jsonb_object_agg(k, v) FROM vm), '{}'::jsonb)
-- An unknown uid still answers, with zeros: the audit asks with any uid.
FROM dc CROSS JOIN med CROSS JOIN rk LEFT JOIN p ON true;
$$;
REVOKE ALL ON FUNCTION public.badge_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.badge_stats(uuid) TO authenticated, service_role;

-- ── 2. The award pass ──────────────────────────────────────────────────────
-- Internal: any user, no auth check. Triggers, cron, the webhook and the
-- self wrapper call it. RETURNING yields only rows the INSERT wrote, so the
-- result is exactly what was just earned.
CREATE OR REPLACE FUNCTION public.award_earned_badges_for(p_user uuid)
RETURNS SETOF public.badges
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (SELECT public.badge_stats(p_user) AS j),
  won AS (
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT p_user, b.id
      FROM public.badges b, s
     WHERE p_user IS NOT NULL AND s.j IS NOT NULL
       AND b.requirement_type IS NOT NULL AND b.requirement_value IS NOT NULL
       AND s.j ? b.requirement_type
       AND CASE WHEN b.requirement_type = 'leaderboard_percentile'
                THEN (s.j ->> b.requirement_type)::numeric <= b.requirement_value
                ELSE (s.j ->> b.requirement_type)::numeric >= b.requirement_value END
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id
  )
  SELECT b.* FROM public.badges b JOIN won ON won.badge_id = b.id
   ORDER BY b.rarity DESC, b.requirement_value DESC;
$$;
REVOKE ALL ON FUNCTION public.award_earned_badges_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_earned_badges_for(uuid) TO service_role;

-- The client's door: self only.
CREATE OR REPLACE FUNCTION public.award_earned_badges()
RETURNS SETOF public.badges
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.award_earned_badges_for(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.award_earned_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_earned_badges() TO authenticated;

-- ── 3. Wrappers for builds in the field (drop next round) ──────────────────
CREATE OR REPLACE FUNCTION public.user_badge_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT public.badge_stats(auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.award_vault_badges()
RETURNS SETOF public.badges LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.award_earned_badges() $$;

CREATE OR REPLACE FUNCTION public.award_badge_if_earned(p_user_id uuid, p_badge_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN EXISTS (SELECT 1 FROM public.award_earned_badges_for(p_user_id) b WHERE b.id = p_badge_id);
END $$;

-- ── 4. The paths that award without the client ─────────────────────────────
-- Each ran its own threshold against its own count. Now each runs the pass
-- for the member concerned, inside an exception guard: a broken stat must
-- never cost a like, a comment, a kudos or a season.
CREATE OR REPLACE FUNCTION public.check_influencer_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM feed_posts WHERE id = NEW.post_id;
  IF v_owner IS NOT NULL THEN
    BEGIN PERFORM * FROM public.award_earned_badges_for(v_owner); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.check_commentator_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  BEGIN PERFORM * FROM public.award_earned_badges_for(NEW.user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

-- Same event as the influencer trigger, same pass: one trigger is enough.
DROP TRIGGER IF EXISTS trg_check_viral_badge ON public.feed_reactions;
DROP FUNCTION IF EXISTS public.check_viral_badge();

CREATE OR REPLACE FUNCTION public.handle_kudos_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE feed_posts SET kudos_count = kudos_count + 1 WHERE id = NEW.post_id;
  BEGIN PERFORM * FROM public.award_earned_badges_for(NEW.receiver_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

-- reward_referral_conversion: the free-month and milestone bookkeeping stay
-- exactly as they were; the badge inserts become the pass.
CREATE OR REPLACE FUNCTION public.reward_referral_conversion(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_paid_count integer;
  v_milestones jsonb;
  v_rewards jsonb := '[]'::jsonb;
  v_credit_key text;
  v_badge_count integer;
BEGIN
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referred_id = p_user AND converted = false
  LIMIT 1
  FOR UPDATE;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_pending_referral');
  END IF;

  UPDATE referrals
  SET converted = true, converted_at = now(), rewarded = true
  WHERE referred_id = p_user AND converted = false;

  UPDATE profiles
  SET referral_count = referral_count + 1,
      updated_at = now()
  WHERE user_id = v_referrer_id;

  SELECT count(*) INTO v_paid_count
  FROM referrals
  WHERE referrer_id = v_referrer_id AND converted = true;

  SELECT COALESCE(referral_milestones_hit, '[]'::jsonb) INTO v_milestones
  FROM profiles WHERE user_id = v_referrer_id;

  IF v_paid_count % 3 = 0 THEN
    v_credit_key := 'c' || v_paid_count::text;
    IF NOT (v_milestones ? v_credit_key)
       AND NOT (v_paid_count = 3 AND v_milestones ? '3') THEN
      UPDATE profiles
      SET membership_credits_until = GREATEST(COALESCE(membership_credits_until, now()), now()) + interval '30 days',
          referral_milestones_hit = referral_milestones_hit || jsonb_build_array(v_credit_key)
      WHERE user_id = v_referrer_id;
      v_rewards := v_rewards || '["free_month"]'::jsonb;
    END IF;
  END IF;

  IF v_paid_count >= 1 AND NOT (v_milestones ? '1') THEN
    UPDATE profiles SET
      referral_milestones_hit = referral_milestones_hit || '["1"]'::jsonb
    WHERE user_id = v_referrer_id;
    v_rewards := v_rewards || '["first_recruit"]'::jsonb;
  END IF;

  FOREACH v_badge_count IN ARRAY ARRAY[5, 10, 25, 50] LOOP
    IF v_paid_count >= v_badge_count AND NOT (v_milestones ? v_badge_count::text) THEN
      UPDATE profiles
      SET referral_milestones_hit = referral_milestones_hit || jsonb_build_array(v_badge_count::text)
      WHERE user_id = v_referrer_id;
      v_rewards := v_rewards || jsonb_build_array('badge_' || v_badge_count::text);
    END IF;
  END LOOP;

  BEGIN PERFORM * FROM public.award_earned_badges_for(v_referrer_id); EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'paid_count', v_paid_count, 'rewards', v_rewards);
END;
$$;

-- finalize_expired_leaderboard_seasons: the live body (monthly seasons), the
-- champion badge through the pass.
CREATE OR REPLACE FUNCTION public.finalize_expired_leaderboard_seasons()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  season_rec RECORD;
  winner_rec RECORD;
  next_season_id UUID;
  next_month_start TIMESTAMPTZ;
  next_month_end TIMESTAMPTZ;
BEGIN
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

      BEGIN PERFORM * FROM public.award_earned_badges_for(winner_rec.user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
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

-- ── 5. The public profile carries the title badge ──────────────────────────
-- /u/:username is the one screen strangers see, and it dropped the title.
CREATE OR REPLACE FUNCTION public.get_public_profile(p_username text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'status_tier', p.status_tier,
    'tier_division', p.tier_division,
    'level', p.level,
    'xp', p.xp,
    'streak', p.streak,
    'longest_streak', p.longest_streak,
    'is_elite', p.is_elite,
    'is_apex_subscriber', p.is_apex_subscriber,
    'legend_pinned', p.legend_pinned,
    'champion_wins', (
      SELECT count(*) FROM public.leaderboard_champions c
      WHERE c.user_id = p.user_id
    ),
    'featured_badge', (
      SELECT jsonb_build_object('name', b.name, 'icon', b.icon, 'rarity', b.rarity)
      FROM public.badges b WHERE b.id = p.featured_badge_id
    ),
    'badges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'badge_id', ub.badge_id,
        'earned_at', ub.earned_at,
        'badges', jsonb_build_object('name', b.name, 'icon', b.icon, 'rarity', b.rarity)
      ) ORDER BY ub.earned_at DESC)
      FROM (
        SELECT * FROM public.user_badges ub2
        WHERE ub2.user_id = p.user_id
        ORDER BY ub2.earned_at DESC
        LIMIT 8
      ) ub
      JOIN public.badges b ON b.id = ub.badge_id
    ), '[]'::jsonb)
  )
  FROM public.profiles p
  WHERE lower(p.username) = lower(p_username)
  LIMIT 1;
$$;

-- ── 6. Silent backfill, THEN the bell ──────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles LOOP
    PERFORM * FROM public.award_earned_badges_for(r.user_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tg_user_badge_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE b public.badges;
BEGIN
  BEGIN
    SELECT * INTO b FROM badges WHERE id = NEW.badge_id;
    PERFORM public.notify_user(NEW.user_id, 'badge', b.name || ' unlocked', b.description,
                               '/profile?tab=badges', NULL, NEW.badge_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS user_badges_notify ON public.user_badges;
CREATE TRIGGER user_badges_notify AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_badge_notify();

NOTIFY pgrst, 'reload schema';
