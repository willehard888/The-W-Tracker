-- 1v1 battles: scored and resolved on the server, on calendar days, with the
-- three Apple Health disciplines.
--
-- Why: for five of six disciplines nothing ever wrote a score (every battle
-- read "Dead even." and resolved 0–0), a statement-level trigger from March
-- resolved expired battles into a community vote that RLS made impossible to
-- cast, the resolver cron lived only in a runbook, and the win notification
-- promised +50 XP that was never awarded. This migration lifts the tribe
-- resolver's shape (SQL scoring, compare-and-swap, XP in the same statement,
-- the cron scheduled here) onto 1v1 battles.

-- ── 1. Legacy resolver off, before anything touches battles ───────────────
DROP TRIGGER IF EXISTS check_expired_battles ON public.battles;
DROP FUNCTION IF EXISTS public.auto_resolve_expired_battles();

-- ── 2. Schema: calendar days, numeric scores, the discipline list ─────────
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS tz_offset_minutes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS halfway_notified_at timestamptz;

ALTER TABLE public.battles
  ALTER COLUMN challenger_score TYPE numeric USING challenger_score::numeric,
  ALTER COLUMN opponent_score TYPE numeric USING opponent_score::numeric;

ALTER TABLE public.battles DROP CONSTRAINT IF EXISTS battles_type_check;
ALTER TABLE public.battles ADD CONSTRAINT battles_type_check
  CHECK (battle_type IN ('xp','cold_shower','workout','meditation','hydration','streak','steps','sleep','active_kcal')) NOT VALID;

ALTER TABLE public.battles DROP CONSTRAINT IF EXISTS battles_duration_check;
ALTER TABLE public.battles ADD CONSTRAINT battles_duration_check
  CHECK (duration_days IN (3, 7, 14, 30)) NOT VALID;

-- Battles already running keep their window, counted from the day they started.
UPDATE public.battles
   SET start_date = (started_at AT TIME ZONE 'UTC')::date,
       end_date = (started_at AT TIME ZONE 'UTC')::date + duration_days - 1
 WHERE status = 'active' AND start_date IS NULL AND started_at IS NOT NULL;

-- Community voting is retired: nobody could ever cast a vote (participant-only
-- RLS), so every tied battle sat in 'voting' forever. Draws are draws.
UPDATE public.battles
   SET status = 'completed', winner_id = NULL, ended_at = COALESCE(ended_at, now())
 WHERE status = 'voting';

-- ── 3. Accepting a challenge starts it tomorrow, on the accepter's calendar ─
-- The old two-argument overload must go: a second signature would make the
-- existing client call {battle_id, accept} ambiguous at PostgREST.
DROP FUNCTION IF EXISTS public.respond_to_battle(uuid, boolean);

CREATE OR REPLACE FUNCTION public.respond_to_battle(
  battle_id uuid,
  accept boolean,
  p_tz_offset_minutes int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  c_xp integer;
  o_xp integer;
  v_tz int := COALESCE(p_tz_offset_minutes, 0);
  v_start date;
BEGIN
  SELECT * INTO b FROM battles WHERE id = battle_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found or not pending';
  END IF;
  IF auth.uid() IS DISTINCT FROM b.opponent_id THEN
    RAISE EXCEPTION 'Only the opponent can respond';
  END IF;

  IF accept THEN
    IF b.battle_type IN ('steps','sleep','active_kcal') AND NOT EXISTS (
      SELECT 1 FROM health_sync_snapshots
       WHERE user_id = b.opponent_id AND last_synced_at > now() - interval '48 hours'
    ) THEN
      RAISE EXCEPTION 'health_sync_required';
    END IF;

    -- Same clamp as record_checkin: UTC-14h .. UTC+12h, else treat as UTC.
    IF v_tz < -840 OR v_tz > 720 THEN v_tz := 0; END IF;
    -- Tomorrow on the accepter's calendar, so both sides get a whole first day.
    v_start := ((now() AT TIME ZONE 'UTC') - make_interval(mins => v_tz))::date + 1;

    SELECT xp INTO c_xp FROM profiles WHERE user_id = b.challenger_id;
    SELECT xp INTO o_xp FROM profiles WHERE user_id = b.opponent_id;

    UPDATE battles
       SET status = 'active',
           started_at = now(),
           start_date = v_start,
           end_date = v_start + b.duration_days - 1,
           tz_offset_minutes = v_tz,
           challenger_start_xp = COALESCE(c_xp, 0),
           opponent_start_xp = COALESCE(o_xp, 0)
     WHERE id = battle_id;
  ELSE
    UPDATE battles SET status = 'declined' WHERE id = battle_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_battle(uuid, boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_battle(uuid, boolean, int) TO authenticated;

-- ── 4. A challenge in a health discipline needs synced health data ─────────
CREATE OR REPLACE FUNCTION public.create_battle(p_opponent uuid, p_battle_type text, p_duration_days int)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid; v_type text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_opponent = uid THEN RAISE EXCEPTION 'self_battle'; END IF;
  IF NOT public.are_friends(uid, p_opponent) THEN RAISE EXCEPTION 'not_friends'; END IF;
  v_type := COALESCE(NULLIF(trim(p_battle_type), ''), 'xp');
  IF v_type NOT IN ('xp','cold_shower','workout','meditation','hydration','streak','steps','sleep','active_kcal') THEN
    RAISE EXCEPTION 'unknown_type';
  END IF;
  IF COALESCE(p_duration_days, 7) NOT IN (3, 7, 14, 30) THEN RAISE EXCEPTION 'unknown_duration'; END IF;
  IF v_type IN ('steps','sleep','active_kcal') AND NOT EXISTS (
    SELECT 1 FROM health_sync_snapshots WHERE user_id = uid AND last_synced_at > now() - interval '48 hours'
  ) THEN RAISE EXCEPTION 'health_sync_required'; END IF;
  IF EXISTS (
    SELECT 1 FROM battles
    WHERE status IN ('pending','active')
      AND ( (challenger_id = uid AND opponent_id = p_opponent)
         OR (challenger_id = p_opponent AND opponent_id = uid) )
  ) THEN RAISE EXCEPTION 'battle_exists'; END IF;
  INSERT INTO battles (challenger_id, opponent_id, battle_type, duration_days, status)
    VALUES (uid, p_opponent, v_type, COALESCE(p_duration_days, 7), 'pending')
    RETURNING id INTO v_id;
  RETURN json_build_object('battle_id', v_id);
END; $$;

-- ── 5. One scoring kernel ─────────────────────────────────────────────────
-- One row per calendar day of the window, from the user's own rows. Check-in
-- days are the same local-date expression record_checkin uses; Apple Health
-- days are the snapshot's own local date. Internal: revoked from clients.
CREATE OR REPLACE FUNCTION public.battle_day_scores(p_user uuid, p_type text, p_from date, p_to date)
RETURNS TABLE(day date, value numeric, verified boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT d::date AS day FROM generate_series(p_from, p_to, interval '1 day') AS d
  ),
  ci AS (
    SELECT ((dc.checked_in_at AT TIME ZONE 'UTC') - make_interval(mins => COALESCE(dc.tz_offset_minutes, 0)))::date AS day,
           (CASE p_type
              WHEN 'xp'          THEN COALESCE(dc.xp_earned, 0) + COALESCE(dc.verified_bonus_xp, 0)
              WHEN 'workout'     THEN (dc.workout IS TRUE)::int
              WHEN 'cold_shower' THEN (dc.cold_shower IS TRUE)::int
              WHEN 'meditation'  THEN (dc.meditation_morning IS TRUE OR dc.meditation_evening IS TRUE)::int
              WHEN 'hydration'   THEN COALESCE(dc.hydration_liters, 0)
              WHEN 'streak'      THEN 1
              ELSE 0 END)::numeric AS value,
           (dc.verified_at IS NOT NULL) AS verified
      FROM daily_checkins dc
     WHERE dc.user_id = p_user
       AND p_type NOT IN ('steps','sleep','active_kcal')
  ),
  hk AS (
    SELECT hs.snapshot_date AS day,
           (CASE p_type
              WHEN 'steps'       THEN COALESCE(hs.steps, 0)
              WHEN 'sleep'       THEN COALESCE(hs.sleep_hours, 0)
              WHEN 'active_kcal' THEN COALESCE(hs.active_kcal, 0)
              ELSE 0 END)::numeric AS value,
           true AS verified
      FROM health_sync_snapshots hs
     WHERE hs.user_id = p_user
       AND p_type IN ('steps','sleep','active_kcal')
  ),
  src AS (SELECT * FROM ci UNION ALL SELECT * FROM hk)
  SELECT days.day,
         COALESCE(sum(src.value), 0) AS value,
         (bool_or(src.verified) IS TRUE) AS verified
    FROM days
    LEFT JOIN src ON src.day = days.day
   GROUP BY days.day
   ORDER BY days.day
$$;

-- The participant's view: only the battle's own metric, per side, per day.
-- Never the opponent's other columns, never raw rows.
CREATE OR REPLACE FUNCTION public.battle_scores(p_battle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  v_c jsonb;
  v_o jsonb;
BEGIN
  SELECT * INTO b FROM battles WHERE id = p_battle_id;
  IF NOT FOUND OR (auth.uid() IS DISTINCT FROM b.challenger_id AND auth.uid() IS DISTINCT FROM b.opponent_id) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;
  IF b.start_date IS NULL OR b.end_date IS NULL THEN
    RETURN jsonb_build_object('battle_id', b.id, 'status', b.status);
  END IF;

  SELECT jsonb_build_object(
           'user_id', b.challenger_id,
           'total', COALESCE(sum(value), 0),
           'days', COALESCE(jsonb_agg(jsonb_build_object('d', day, 'v', value, 'verified', verified) ORDER BY day), '[]'::jsonb))
    INTO v_c
    FROM battle_day_scores(b.challenger_id, b.battle_type, b.start_date, LEAST(b.end_date, current_date));
  SELECT jsonb_build_object(
           'user_id', b.opponent_id,
           'total', COALESCE(sum(value), 0),
           'days', COALESCE(jsonb_agg(jsonb_build_object('d', day, 'v', value, 'verified', verified) ORDER BY day), '[]'::jsonb))
    INTO v_o
    FROM battle_day_scores(b.opponent_id, b.battle_type, b.start_date, LEAST(b.end_date, current_date));

  RETURN jsonb_build_object(
    'battle_id', b.id, 'status', b.status, 'battle_type', b.battle_type,
    'start_date', b.start_date, 'end_date', b.end_date,
    'challenger', v_c, 'opponent', v_o);
END;
$$;

-- A member's clock: the offset their latest check-in was recorded with (what
-- record_checkin will clamp the next one to). NULL until they have checked in.
CREATE OR REPLACE FUNCTION public.user_tz_offset(p_user uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tz_offset_minutes FROM daily_checkins
   WHERE user_id = p_user AND tz_offset_minutes IS NOT NULL
   ORDER BY checked_in_at DESC LIMIT 1
$$;

-- ── 5b. Copy helpers ───────────────────────────────────────────────────
-- The unit a score is read in, shared by the halfway and the result copy.
CREATE OR REPLACE FUNCTION public.battle_unit(p_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'xp' THEN 'XP' WHEN 'cold_shower' THEN 'cold showers' WHEN 'workout' THEN 'workouts'
    WHEN 'meditation' THEN 'meditation days' WHEN 'hydration' THEN 'litres' WHEN 'streak' THEN 'days'
    WHEN 'steps' THEN 'steps' WHEN 'sleep' THEN 'hours of sleep' WHEN 'active_kcal' THEN 'kcal'
    ELSE p_type END
$$;

-- 61204 → "61204", 1.25 → "1.3", 7 → "7": one decimal at most, no trailing zero.
CREATE OR REPLACE FUNCTION public.battle_num(p numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT rtrim(rtrim(to_char(COALESCE(p, 0), 'FM999999990.9'), '0'), '.')
$$;

-- "You lead by 2 workouts." / "You trail by 1.2 hours of sleep." / "Dead even."
CREATE OR REPLACE FUNCTION public.battle_standing(p_mine numeric, p_theirs numeric, p_unit text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_mine = p_theirs THEN 'Dead even at ' || public.battle_num(p_mine) || ' ' || p_unit || '.'
    WHEN p_mine > p_theirs THEN 'You lead by ' || public.battle_num(p_mine - p_theirs) || ' ' || p_unit || '.'
    ELSE 'You trail by ' || public.battle_num(p_theirs - p_mine) || ' ' || p_unit || '.' END
$$;

-- ── 6. The resolver (cron, every 15 minutes) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_expired_battles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  v_c numeric;
  v_o numeric;
  v_winner uuid;
  v_verified boolean;
  v_claimed int;
  v_unit text;
BEGIN
  -- Halfway: one standing per battle, on the battle's own calendar.
  FOR b IN
    SELECT * FROM battles
     WHERE status = 'active' AND halfway_notified_at IS NULL AND start_date IS NOT NULL
       AND ((now() AT TIME ZONE 'UTC') - make_interval(mins => tz_offset_minutes))::date >= start_date + duration_days / 2
       AND duration_days >= 7
  LOOP
    UPDATE battles SET halfway_notified_at = now() WHERE id = b.id AND halfway_notified_at IS NULL;
    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN CONTINUE; END IF;
    SELECT COALESCE(sum(value), 0) INTO v_c FROM battle_day_scores(b.challenger_id, b.battle_type, b.start_date, b.end_date);
    SELECT COALESCE(sum(value), 0) INTO v_o FROM battle_day_scores(b.opponent_id, b.battle_type, b.start_date, b.end_date);
    v_unit := public.battle_unit(b.battle_type);
    BEGIN
      PERFORM notify_user(b.challenger_id, 'battle_halfway', 'Halfway there',
        public.battle_standing(v_c, v_o, v_unit), '/battles', b.opponent_id, b.id);
      PERFORM notify_user(b.opponent_id, 'battle_halfway', 'Halfway there',
        public.battle_standing(v_o, v_c, v_unit), '/battles', b.challenger_id, b.id);
      PERFORM dispatch_social_push('battle_halfway', b.challenger_id, b.opponent_id, b.id);
      PERFORM dispatch_social_push('battle_halfway', b.opponent_id, b.challenger_id, b.id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  -- Resolution: once the last day has ended on the later of the two clocks.
  FOR b IN
    SELECT * FROM battles
     WHERE status = 'active' AND end_date IS NOT NULL
       AND now() >= ((end_date + 1)::timestamp AT TIME ZONE 'UTC')
                    + make_interval(mins => GREATEST(COALESCE(user_tz_offset(challenger_id), tz_offset_minutes),
                                                     COALESCE(user_tz_offset(opponent_id), tz_offset_minutes)))
  LOOP
    SELECT COALESCE(sum(value), 0) INTO v_c FROM battle_day_scores(b.challenger_id, b.battle_type, b.start_date, b.end_date);
    SELECT COALESCE(sum(value), 0) INTO v_o FROM battle_day_scores(b.opponent_id, b.battle_type, b.start_date, b.end_date);
    v_winner := CASE WHEN v_c > v_o THEN b.challenger_id WHEN v_o > v_c THEN b.opponent_id END;
    v_verified := CASE
      WHEN v_winner IS NULL THEN NULL
      WHEN b.battle_type IN ('steps','sleep','active_kcal') THEN true
      WHEN b.battle_type IN ('xp','workout','streak') THEN EXISTS (
        SELECT 1 FROM health_sync_snapshots
         WHERE user_id = v_winner
           AND snapshot_date BETWEEN b.start_date AND b.end_date
           AND (COALESCE(workout_count, 0) >= 1 OR COALESCE(workout_minutes, 0) >= 15 OR COALESCE(steps, 0) >= 8000))
      ELSE NULL END;

    -- Compare-and-swap: only the transaction that flips active→completed pays.
    UPDATE battles
       SET status = 'completed', ended_at = now(),
           challenger_score = v_c, opponent_score = v_o,
           winner_id = v_winner, winner_verified = v_verified
     WHERE id = b.id AND status = 'active';
    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN CONTINUE; END IF;

    IF v_winner IS NOT NULL THEN
      UPDATE profiles
         SET xp = COALESCE(xp, 0) + 50,
             level = floor((COALESCE(xp, 0) + 50) / 500) + 1,
             updated_at = now()
       WHERE user_id = v_winner;
    END IF;
    -- status_tier for both: trigger update_status_after_battle.
    -- notifications + push: trigger battles_notify.
  END LOOP;
END;
$$;

-- ── 7. Notifications: accepted, declined, decided (with the score) ─────────
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
               THEN 'You won ' || v_label || ', ' || public.battle_num(NEW.challenger_score) || ' to ' || public.battle_num(NEW.opponent_score) || ' ' || v_unit || '. +50 XP.'
             WHEN NEW.winner_id IS NULL
               THEN 'A draw at ' || public.battle_num(NEW.challenger_score) || ' ' || v_unit || ' each.'
             ELSE 'Lost ' || v_label || ', ' || public.battle_num(NEW.challenger_score) || ' to ' || public.battle_num(NEW.opponent_score) || ' ' || v_unit || '. Run it back?' END,
        '/battles', NEW.opponent_id, NEW.id);
      PERFORM notify_user(NEW.opponent_id, 'battle_resolved', 'Battle decided',
        CASE WHEN NEW.winner_id = NEW.opponent_id
               THEN 'You won ' || v_label || ', ' || public.battle_num(NEW.opponent_score) || ' to ' || public.battle_num(NEW.challenger_score) || ' ' || v_unit || '. +50 XP.'
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

-- ── 8. Grants ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.battle_day_scores(uuid, text, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_tz_offset(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_expired_battles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.battle_scores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.battle_scores(uuid) TO authenticated;

-- ── 9. Cron: the same job name replaces the http_post to the edge function ─
DO $$ BEGIN
  PERFORM cron.schedule('resolve-battles', '*/15 * * * *', 'SELECT public.resolve_expired_battles()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule resolve-battles manually';
END $$;

NOTIFY pgrst, 'reload schema';
