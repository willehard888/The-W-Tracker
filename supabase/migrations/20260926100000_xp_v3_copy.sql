-- XP v3 — the copy and the definitions the model change left behind.
--
-- 1. tg_battle_notify still promised "+50 XP" in the decided-battle push;
--    resolve_expired_battles stopped paying it in 20260925100000. The push
--    now says what happens: the W goes on the record.
-- 2. user_badge_stats() counted a "perfect day" with the old core-8 columns;
--    the server's +10 line in score_breakdown is the one definition now (the
--    weekly briefing reads the same line).
-- 3. "Iron Discipline" asked for level 20 (9 500 XP) when a day could score
--    235; a day scores 100, 150 with Apple Health, so level 12 (5 500 XP,
--    ~45 verified days) is the same ask.

CREATE OR REPLACE FUNCTION public.tg_battle_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_unit text;
  v_label text;
BEGIN
  BEGIN
    v_unit := public.battle_unit(COALESCE(NEW.battle_type, 'xp'));
    v_label := CASE COALESCE(NEW.battle_type, 'xp')
      WHEN 'xp' THEN 'Total XP' WHEN 'cold_shower' THEN 'Cold showers' WHEN 'workout' THEN 'Workouts'
      WHEN 'meditation' THEN 'Meditation' WHEN 'hydration' THEN 'Hydration' WHEN 'streak' THEN 'Days checked in'
      WHEN 'steps' THEN 'Steps' WHEN 'sleep' THEN 'Sleep' WHEN 'active_kcal' THEN 'Active calories'
      ELSE initcap(NEW.battle_type) END;

    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.challenger_id;
      PERFORM notify_user(NEW.opponent_id, 'battle_challenge',
        '@' || COALESCE(v_name, 'someone') || ' challenged you',
        v_label || ', ' || COALESCE(NEW.duration_days, 7) || ' days. Accept from your notifications.',
        '/notifications', NEW.challenger_id, NEW.id);
      PERFORM dispatch_social_push('battle_challenge', NEW.opponent_id, NEW.challenger_id, NEW.id);

    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'active' THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.opponent_id;
      PERFORM notify_user(NEW.challenger_id, 'battle_accepted',
        '@' || COALESCE(v_name, 'someone') || ' accepted',
        v_label || ', ' || COALESCE(NEW.duration_days, 7) || ' days. Starts tomorrow, ends ' || to_char(NEW.end_date, 'FMDD Mon') || '.',
        '/battles', NEW.opponent_id, NEW.id);
      PERFORM dispatch_social_push('battle_accepted', NEW.challenger_id, NEW.opponent_id, NEW.id);

    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'declined' THEN
      SELECT username INTO v_name FROM profiles WHERE user_id = NEW.opponent_id;
      PERFORM notify_user(NEW.challenger_id, 'battle_declined',
        '@' || COALESCE(v_name, 'someone') || ' passed on this one',
        v_label || ', ' || COALESCE(NEW.duration_days, 7) || ' days. Pick another discipline or another friend.',
        '/battles', NEW.opponent_id, NEW.id);
      PERFORM dispatch_social_push('battle_declined', NEW.challenger_id, NEW.opponent_id, NEW.id);

    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
      PERFORM notify_user(NEW.challenger_id, 'battle_resolved', 'Battle decided',
        CASE WHEN NEW.winner_id = NEW.challenger_id
               THEN 'You won ' || v_label || ', ' || public.battle_num(NEW.challenger_score) || ' to ' || public.battle_num(NEW.opponent_score) || ' ' || v_unit || '. The W is yours.'
             WHEN NEW.winner_id IS NULL
               THEN 'A draw at ' || public.battle_num(NEW.challenger_score) || ' ' || v_unit || ' each.'
             ELSE 'Lost ' || v_label || ', ' || public.battle_num(NEW.challenger_score) || ' to ' || public.battle_num(NEW.opponent_score) || ' ' || v_unit || '. Run it back?' END,
        '/battles', NEW.opponent_id, NEW.id);
      PERFORM notify_user(NEW.opponent_id, 'battle_resolved', 'Battle decided',
        CASE WHEN NEW.winner_id = NEW.opponent_id
               THEN 'You won ' || v_label || ', ' || public.battle_num(NEW.opponent_score) || ' to ' || public.battle_num(NEW.challenger_score) || ' ' || v_unit || '. The W is yours.'
             WHEN NEW.winner_id IS NULL
               THEN 'A draw at ' || public.battle_num(NEW.opponent_score) || ' ' || v_unit || ' each.'
             ELSE 'Lost ' || v_label || ', ' || public.battle_num(NEW.opponent_score) || ' to ' || public.battle_num(NEW.challenger_score) || ' ' || v_unit || '. Run it back?' END,
        '/battles', NEW.challenger_id, NEW.id);
      PERFORM dispatch_social_push('battle_resolved', NEW.challenger_id, NEW.opponent_id, NEW.id);
      PERFORM dispatch_social_push('battle_resolved', NEW.opponent_id, NEW.challenger_id, NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- a notification failure must never break the parent write
  END;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.user_badge_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH me AS (
  SELECT auth.uid() AS uid
),
dc AS (
  SELECT
    count(*) AS checkins,
    count(*) FILTER (WHERE workout) AS workouts,
    count(*) FILTER (WHERE cold_shower) AS cold_shower,
    count(*) FILTER (WHERE healthy_food) AS healthy_food,
    count(*) FILTER (WHERE protein_intake) AS protein,
    count(*) FILTER (WHERE hydration_liters >= 3) AS hydration,
    count(*) FILTER (WHERE no_phone_morning) AS no_phone_morning,
    count(*) FILTER (WHERE no_phone_evening) AS no_phone_evening,
    count(*) FILTER (WHERE reading) AS reading,
    count(*) FILTER (WHERE extra_workout) AS double_workout,
    count(*) FILTER (WHERE meditation_morning) + count(*) FILTER (WHERE meditation_evening) AS meditation,
    count(*) FILTER (WHERE proof_photo_url IS NOT NULL) AS proofs,
    -- XP v3: a perfect day is the server's +10 line (trained, 7–9 h, 3 L,
    -- mind, every chosen habit), not the old core-8 columns.
    count(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(score_breakdown -> 'lines', '[]'::jsonb)) l
         WHERE l ->> 'k' = 'perfect' AND COALESCE((l ->> 'pts')::int, 0) > 0
      )
    ) AS perfect_day
  FROM daily_checkins, me
  WHERE user_id = me.uid
),
my_tribes AS (
  SELECT tribe_id FROM tribe_members, me
  WHERE user_id = me.uid AND status = 'active'
),
owned AS (
  SELECT id AS tribe_id FROM tribes, me WHERE owner_id = me.uid
),
mins AS (
  -- Minimum member streak per tribe I'm in or own — the "collective streak"
  -- badge semantics (weakest link defines the tribe's shared streak).
  SELECT tm.tribe_id, min(COALESCE(p.streak, 0)) AS min_streak
  FROM tribe_members tm
  JOIN profiles p ON p.user_id = tm.user_id
  WHERE tm.status = 'active'
    AND tm.tribe_id IN (
      SELECT tribe_id FROM my_tribes
      UNION
      SELECT tribe_id FROM owned
    )
  GROUP BY tm.tribe_id
)
SELECT jsonb_build_object(
  'checkins', dc.checkins,
  'workouts', dc.workouts,
  'cold_shower', dc.cold_shower,
  'healthy_food', dc.healthy_food,
  'protein', dc.protein,
  'hydration', dc.hydration,
  'no_phone_morning', dc.no_phone_morning,
  'no_phone_evening', dc.no_phone_evening,
  'reading', dc.reading,
  'double_workout', dc.double_workout,
  'meditation', dc.meditation,
  'proofs', dc.proofs,
  'perfect_day', dc.perfect_day,
  'battles_won', (SELECT count(*) FROM battles b, me WHERE b.winner_id = me.uid),
  'referrals', (SELECT count(*) FROM referrals r, me WHERE r.referrer_id = me.uid),
  'tribe_battles_won', (
    SELECT count(*) FROM tribe_battles tb
    WHERE tb.status = 'completed'
      AND tb.winner_tribe_id IN (SELECT tribe_id FROM my_tribes)
  ),
  'tribe_collective_streak', COALESCE(
    (SELECT max(min_streak) FROM mins WHERE tribe_id IN (SELECT tribe_id FROM my_tribes)), 0),
  'tribe_founder_streak', COALESCE(
    (SELECT max(min_streak) FROM mins WHERE tribe_id IN (SELECT tribe_id FROM owned)), 0)
)
FROM dc;
$$;

REVOKE ALL ON FUNCTION public.user_badge_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_badge_stats() TO authenticated;

UPDATE public.badges
   SET description = 'Reach Level 12', requirement_value = 12
 WHERE name = 'Iron Discipline' AND requirement_type = 'level' AND requirement_value = 20;

NOTIFY pgrst, 'reload schema';
