-- ═══════════════════════════════════════════════════════════════════════════
-- XP v3 — Effort, verified.
--
-- One function scores a day. Apple Health scores what it can measure (effort
-- from minutes × heart-rate zone, the night, steps, mindful minutes); a claim
-- without data earns the floor. The client's number is no longer read.
--
--   training   0–50  Health workouts: min × (Z1 0.5 · Z2 1 · Z3 1.5 · Z4–5 2)
--                    zone = avg_hr / (220 − age); no HR = 1/min; cap 50.
--                    App-logged session 35 · tick (or a hand-entered Health
--                    workout) 25.
--   sleep      0–25  Health night: 7–9 h = 25, linear down to 4 h = 0,
--                    9–10 h = 20, over 10 h = 15. A claim: the same curve × 0.6.
--   steps      0–10  Health only, 1 per 1 000.
--   mind        15   Health mindful ≥ 10 min · tick 10.
--   hydration   15   ≥ 3 L · 8 at ≥ 2 L (claim only).
--   habits     0–25  25 × done / max(chosen, 4).
--   perfect     10   trained + 7–9 h + 3 L + mind + every chosen habit.
--   ceiling    150 with Health · 100 without.
--
-- Rank score = W-Rating: the 28-day average of day XP, missed days as 0.
-- profiles.xp = Σ xp_earned (+ Vault practice): referrals, tribe battles and
-- challenges, kudos, likes and 1v1 wins stop writing it. Tribes rank per
-- member. History is rescored at the end of this file.
--
-- Before deploying a change to the scoring: node scripts/xp-parity.mjs on the
-- local PG (src/lib/__fixtures__/day-score-cases.json must match SQL ↔ TS).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS score_breakdown jsonb;
ALTER TABLE public.tribes ADD COLUMN IF NOT EXISTS weekly_score numeric NOT NULL DEFAULT 0;

-- ── 1. Helpers (pure; the TS mirror is src/lib/checkin-xp.ts) ──────────────

-- The calendar day a check-in belongs to, on the clock it was made with.
CREATE OR REPLACE FUNCTION public.checkin_local_day(dc public.daily_checkins)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ((dc.checked_in_at AT TIME ZONE 'UTC') - make_interval(mins => COALESCE(dc.tz_offset_minutes, 0)))::date
$$;

CREATE OR REPLACE FUNCTION public.sleep_curve(h numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN h IS NULL OR h < 4 THEN 0
    WHEN h <= 7  THEN 25 * (h - 4) / 3
    WHEN h <= 9  THEN 25
    WHEN h <= 10 THEN 20
    ELSE 15 END
$$;

-- The chosen-habit catalog (src/lib/checkin-habits.ts minus the four core
-- rows). A key outside this list is never chosen and never done.
-- The claimed night: the curve at 60 %, written as its own integers so the
-- half-way cases (6.5 h → 12.5 → 13) round the same here and in JS.
CREATE OR REPLACE FUNCTION public.sleep_claim(h numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN h IS NULL OR h < 4 THEN 0
    WHEN h <= 7  THEN 5 * (h - 4)
    WHEN h <= 9  THEN 15
    WHEN h <= 10 THEN 12
    ELSE 9 END
$$;

CREATE OR REPLACE FUNCTION public.checkin_habit_keys()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY[
    'extra_workout','mobility','sunlight',
    'healthy_food','protein','no_alcohol','no_sugar','caffeine_cutoff','creatine',
    'meditation_pm','breathwork','no_phone_am','no_phone_pm','reading','journaling','gratitude',
    'cold_shower','sauna','early_bed',
    'connection'
  ]::text[]
$$;

CREATE OR REPLACE FUNCTION public.checkin_default_keys()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY['extra_workout','cold_shower','healthy_food','protein','meditation_pm','no_phone_am','no_phone_pm','reading']::text[]
$$;

-- Did this chosen habit happen on the row? Column-backed keys read their
-- column, the rest the habits jsonb (completion-only writes).
CREATE OR REPLACE FUNCTION public.checkin_habit_done(dc public.daily_checkins, key text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE key
    WHEN 'extra_workout' THEN dc.extra_workout IS TRUE
    WHEN 'healthy_food'  THEN dc.healthy_food IS TRUE
    WHEN 'protein'       THEN dc.protein_intake IS TRUE
    WHEN 'meditation_pm' THEN dc.meditation_evening IS TRUE
    WHEN 'no_phone_am'   THEN dc.no_phone_morning IS TRUE
    WHEN 'no_phone_pm'   THEN dc.no_phone_evening IS TRUE
    WHEN 'reading'       THEN dc.reading IS TRUE
    WHEN 'cold_shower'   THEN dc.cold_shower IS TRUE
    ELSE COALESCE((dc.habits ->> key)::boolean, false)
  END
$$;

-- ── 2. score_checkin — the only writer of xp_earned ────────────────────────
CREATE OR REPLACE FUNCTION public.score_checkin(p_checkin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dc          public.daily_checkins;
  hs          public.health_sync_snapshots;
  v_day       date;
  v_age       integer;
  v_hr_max    numeric;
  v_keys      text[];
  v_chosen    text[];
  v_n         integer;
  v_done      integer := 0;
  k           text;
  w           jsonb;
  v_min       integer;
  v_hr        numeric;
  v_pm        numeric;
  v_effort    numeric := 0;
  v_effort_min integer := 0;
  v_manual    boolean := false;
  v_app       boolean := false;
  v_training  integer := 0;
  v_train_src text;
  v_sleep_h   numeric;
  v_sleep_src text;
  v_sleep     integer := 0;
  v_steps     integer := 0;
  v_mind      integer := 0;
  v_mind_src  text;
  v_hyd       integer := 0;
  v_habits    integer := 0;
  v_perfect   integer := 0;
  v_total     integer;
  v_prev      integer;
  v_signals   jsonb := '{}'::jsonb;
  v_matches   integer := 0;
  v_bonus     integer := 0;
  v_breakdown jsonb;
  v_has_hs    boolean;
BEGIN
  SELECT * INTO dc FROM public.daily_checkins WHERE id = p_checkin_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_day := public.checkin_local_day(dc);
  SELECT * INTO hs FROM public.health_sync_snapshots
   WHERE user_id = dc.user_id AND snapshot_date = v_day;
  v_has_hs := FOUND;

  SELECT age INTO v_age FROM public.coach_athlete_profile WHERE user_id = dc.user_id;
  v_hr_max := 220 - COALESCE(v_age, 30);

  -- Training: Health effort, else the app's own logged session, else the claim.
  IF v_has_hs THEN
    FOR w IN SELECT value FROM jsonb_array_elements(COALESCE(hs.workouts, '[]'::jsonb)) LOOP
      v_min := COALESCE((w ->> 'duration_min')::integer, 0);
      IF (w ->> 'manual')::boolean IS TRUE THEN
        v_manual := true;
        CONTINUE;
      END IF;
      IF v_min <= 0 THEN CONTINUE; END IF;
      v_hr := (w ->> 'avg_hr')::numeric;
      v_pm := CASE
        WHEN v_hr IS NULL OR v_hr <= 0     THEN 1.0
        WHEN v_hr / v_hr_max < 0.60        THEN 0.5
        WHEN v_hr / v_hr_max < 0.70        THEN 1.0
        WHEN v_hr / v_hr_max < 0.80        THEN 1.5
        ELSE 2.0 END;
      v_effort := v_effort + v_min * v_pm;
      v_effort_min := v_effort_min + v_min;
    END LOOP;
    -- A snapshot from before the list existed: minutes without heart rate.
    IF v_effort = 0 AND NOT v_manual
       AND jsonb_array_length(COALESCE(hs.workouts, '[]'::jsonb)) = 0
       AND COALESCE(hs.workout_minutes, 0) >= 10 THEN
      v_effort := hs.workout_minutes;
      v_effort_min := hs.workout_minutes;
    END IF;
  END IF;
  v_effort := LEAST(50, round(v_effort));

  SELECT EXISTS (
    SELECT 1 FROM public.coach_program_logs l
     WHERE l.user_id = dc.user_id AND l.completed IS TRUE
       AND ((l.logged_at AT TIME ZONE 'UTC') - make_interval(mins => COALESCE(dc.tz_offset_minutes, 0)))::date = v_day
  ) INTO v_app;

  -- The best evidence wins. A recorded session never scores under the tick
  -- (a slow 20-minute walk is still a session Health saw); the app's own
  -- logged session beats a small one; a bare tick is the floor.
  IF v_effort > 0 THEN
    v_training := GREATEST(v_effort, 25); v_train_src := 'health';
  END IF;
  IF v_app AND 35 > v_training THEN
    v_training := 35; v_train_src := 'app';
  END IF;
  IF v_train_src IS NULL AND (dc.workout IS TRUE OR v_manual) THEN
    v_training := 25; v_train_src := 'claim';
  END IF;

  -- Sleep: the recorded night when Health has one, else the claim at 60 %.
  IF v_has_hs AND hs.sleep_hours IS NOT NULL AND hs.sleep_hours >= 3 THEN
    v_sleep_h := hs.sleep_hours; v_sleep_src := 'health';
    v_sleep := round(public.sleep_curve(v_sleep_h));
  ELSIF dc.sleep_hours IS NOT NULL THEN
    v_sleep_h := dc.sleep_hours; v_sleep_src := 'claim';
    v_sleep := round(public.sleep_claim(v_sleep_h));
  END IF;

  IF v_has_hs AND hs.steps IS NOT NULL THEN
    v_steps := LEAST(10, floor(hs.steps / 1000.0));
  END IF;

  IF v_has_hs AND COALESCE(hs.mindful_minutes, 0) >= 10 THEN
    v_mind := 15; v_mind_src := 'health';
  ELSIF dc.meditation_morning IS TRUE OR dc.meditation_evening IS TRUE
     OR (v_has_hs AND COALESCE(hs.mindful_minutes, 0) > 0) THEN
    v_mind := 10; v_mind_src := 'claim';
  END IF;

  v_hyd := CASE WHEN COALESCE(dc.hydration_liters, 0) >= 3 THEN 15
                WHEN COALESCE(dc.hydration_liters, 0) >= 2 THEN 8 ELSE 0 END;

  -- Chosen habits ∪ habits claimed on the row, catalog keys only.
  SELECT checkin_habits INTO v_chosen FROM public.profiles WHERE user_id = dc.user_id;
  IF v_chosen IS NULL OR cardinality(v_chosen) = 0 THEN v_chosen := public.checkin_default_keys(); END IF;
  v_keys := ARRAY(
    SELECT DISTINCT x FROM unnest(public.checkin_habit_keys()) AS x
     WHERE x = ANY (v_chosen) OR public.checkin_habit_done(dc, x)
  );
  FOREACH k IN ARRAY v_keys LOOP
    IF public.checkin_habit_done(dc, k) THEN v_done := v_done + 1; END IF;
  END LOOP;
  v_n := GREATEST(cardinality(v_keys), 4);
  v_habits := round(25.0 * v_done / v_n);

  IF v_training > 0 AND v_sleep_h IS NOT NULL AND v_sleep_h >= 7 AND v_sleep_h <= 9
     AND v_hyd = 15 AND v_mind > 0 AND cardinality(v_keys) > 0 AND v_done = cardinality(v_keys) THEN
    v_perfect := 10;
  END IF;

  v_total := v_training + v_sleep + v_steps + v_mind + v_hyd + v_habits + v_perfect;

  -- Verified day: two Health-recorded signals (the shield on the boards).
  IF v_effort > 0 THEN
    v_matches := v_matches + 1;
    IF v_train_src = 'health' THEN v_bonus := v_bonus + GREATEST(0, v_training - 25); END IF;
    v_signals := v_signals || jsonb_build_object('workout', jsonb_build_object('matched', true, 'workout_minutes', v_effort_min, 'effort', v_effort));
  END IF;
  IF v_sleep_src = 'health' THEN
    v_matches := v_matches + 1;
    v_bonus := v_bonus + GREATEST(0, v_sleep - round(public.sleep_claim(v_sleep_h)));
    v_signals := v_signals || jsonb_build_object('sleep', jsonb_build_object('matched', true, 'healthkit_h', v_sleep_h));
  END IF;
  IF v_has_hs AND COALESCE(hs.steps, 0) >= 5000 THEN
    v_matches := v_matches + 1;
    v_signals := v_signals || jsonb_build_object('steps', jsonb_build_object('matched', true, 'count', hs.steps));
  END IF;
  v_bonus := v_bonus + v_steps;
  IF v_mind_src = 'health' THEN
    v_matches := v_matches + 1;
    v_bonus := v_bonus + 5;
    v_signals := v_signals || jsonb_build_object('mindfulness', jsonb_build_object('matched', true, 'minutes', hs.mindful_minutes));
  END IF;

  v_breakdown := jsonb_build_object(
    'v', 3,
    'day', v_day,
    'total', v_total,
    'max', CASE WHEN v_has_hs THEN 150 ELSE 100 END,
    'hr_max', v_hr_max,
    'verified', v_matches >= 2,
    'lines', jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object('k', 'training',  'pts', v_training, 'max', 50, 'src', v_train_src,
        'minutes', CASE WHEN v_train_src = 'health' THEN v_effort_min END, 'manual', CASE WHEN v_manual THEN true END)),
      jsonb_strip_nulls(jsonb_build_object('k', 'sleep',     'pts', v_sleep,    'max', 25, 'src', v_sleep_src, 'hours', v_sleep_h)),
      jsonb_strip_nulls(jsonb_build_object('k', 'steps',     'pts', v_steps,    'max', 10, 'src', CASE WHEN v_has_hs AND hs.steps IS NOT NULL THEN 'health' END, 'count', CASE WHEN v_has_hs THEN hs.steps END)),
      jsonb_strip_nulls(jsonb_build_object('k', 'mind',      'pts', v_mind,     'max', 15, 'src', v_mind_src, 'minutes', CASE WHEN v_has_hs THEN hs.mindful_minutes END)),
      jsonb_strip_nulls(jsonb_build_object('k', 'hydration', 'pts', v_hyd,      'max', 15, 'src', CASE WHEN v_hyd > 0 THEN 'claim' END, 'liters', dc.hydration_liters)),
      jsonb_build_object('k', 'habits',    'pts', v_habits,   'max', 25, 'done', v_done, 'of', cardinality(v_keys)),
      jsonb_build_object('k', 'perfect',   'pts', v_perfect,  'max', 10)
    )
  );

  v_prev := COALESCE(dc.xp_earned, 0);
  UPDATE public.daily_checkins
     SET xp_earned = v_total,
         score_breakdown = v_breakdown,
         verified_at = CASE WHEN v_matches >= 2 THEN COALESCE(verified_at, now()) ELSE NULL END,
         verified_signals = v_signals,
         verified_bonus_xp = v_bonus
   WHERE id = p_checkin_id;

  IF v_total <> v_prev THEN
    UPDATE public.profiles
       SET xp = GREATEST(0, COALESCE(xp, 0) + (v_total - v_prev)),
           level = floor(GREATEST(0, COALESCE(xp, 0) + (v_total - v_prev)) / 500) + 1,
           updated_at = now()
     WHERE user_id = dc.user_id;
  END IF;

  RETURN v_breakdown;
END;
$$;

REVOKE ALL ON FUNCTION public.score_checkin(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. record_checkin — same signature; the ceiling is gone ────────────────
CREATE OR REPLACE FUNCTION public.record_checkin(
  p_sleep_hours numeric,
  p_workout boolean,
  p_extra_workout boolean,
  p_cold_shower boolean,
  p_healthy_food boolean,
  p_protein_intake boolean,
  p_meditation_morning boolean,
  p_meditation_evening boolean,
  p_hydration_liters numeric,
  p_no_phone_morning boolean,
  p_no_phone_evening boolean,
  p_reading boolean,
  p_xp_earned integer,
  p_proof_photo_url text DEFAULT NULL,
  p_journal_entry text DEFAULT NULL,
  p_tz_offset_minutes integer DEFAULT 0,
  p_habits jsonb DEFAULT '{}'::jsonb,
  p_sport text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_offset interval;
  v_local_today date;
  v_prev timestamptz;
  v_prev_local date;
  v_prev_tz integer;
  v_profile public.profiles;
  v_checkin_id uuid;
  v_score jsonb;
  v_xp_earned integer;
  v_new_xp integer;
  v_new_level integer;
  v_new_streak integer;
  v_longest integer;
  v_streak_broken boolean := false;
  v_shields integer;
  v_missed integer;
  v_shield_used integer := 0;
  v_shield_earned boolean := false;
  v_tz integer;
  v_habits jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Clamp the tz offset to the real-world range (UTC-14h .. UTC+12h).
  v_tz := COALESCE(p_tz_offset_minutes, 0);
  IF v_tz < -840 OR v_tz > 720 THEN
    v_tz := 0;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = uid FOR UPDATE;

  SELECT checked_in_at, tz_offset_minutes INTO v_prev, v_prev_tz
  FROM public.daily_checkins
  WHERE user_id = uid
  ORDER BY checked_in_at DESC
  LIMIT 1;

  -- An offset swinging more than 120 min from the previous check-in's is not
  -- a real timezone move — clamp it to the previous (the midnight-shift farm).
  IF v_prev_tz IS NOT NULL AND abs(v_tz - v_prev_tz) > 120 THEN
    v_tz := v_prev_tz;
  END IF;

  v_offset := make_interval(mins => v_tz);
  v_local_today := (now() - v_offset)::date;

  IF v_prev IS NOT NULL
     AND (v_prev - v_offset)::date = v_local_today THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY';
  END IF;

  v_shields := COALESCE(v_profile.streak_shields, 0);

  -- Self-scoped, but cap runaway jsonb so a crafted client can't bloat the row.
  v_habits := COALESCE(p_habits, '{}'::jsonb);
  IF length(v_habits::text) > 4096 THEN
    v_habits := '{}'::jsonb;
  END IF;

  -- p_xp_earned is the client's preview; the server scores the row itself.
  INSERT INTO public.daily_checkins (
    user_id, checked_in_at, sleep_hours, workout, extra_workout, cold_shower,
    healthy_food, protein_intake, meditation_morning, meditation_evening,
    hydration_liters, no_phone_morning, no_phone_evening, reading,
    xp_earned, proof_photo_url, journal_entry, habits, sport, tz_offset_minutes
  ) VALUES (
    uid, now(), p_sleep_hours, p_workout, p_extra_workout, p_cold_shower,
    p_healthy_food, p_protein_intake, p_meditation_morning, p_meditation_evening,
    p_hydration_liters, p_no_phone_morning, p_no_phone_evening, p_reading,
    0, p_proof_photo_url, p_journal_entry, v_habits,
    NULLIF(left(COALESCE(p_sport, ''), 32), ''), v_tz
  )
  RETURNING id INTO v_checkin_id;

  v_score := public.score_checkin(v_checkin_id);
  v_xp_earned := COALESCE((v_score ->> 'total')::integer, 0);

  IF v_prev IS NULL THEN
    v_new_streak := 1;
  ELSE
    v_prev_local := (v_prev - v_offset)::date;
    IF v_prev_local = v_local_today - 1 THEN
      v_new_streak := COALESCE(v_profile.streak, 0) + 1;
    ELSIF v_prev_local >= v_local_today THEN
      v_new_streak := GREATEST(COALESCE(v_profile.streak, 0), 1);
    ELSE
      v_missed := (v_local_today - v_prev_local) - 1;
      IF v_missed >= 1 AND v_shields >= v_missed THEN
        v_shield_used := v_missed;
        v_shields := v_shields - v_missed;
        v_new_streak := COALESCE(v_profile.streak, 0) + 1;
      ELSE
        v_streak_broken := true;
        v_new_streak := 1;
      END IF;
    END IF;
  END IF;

  IF v_new_streak > 0 AND v_new_streak % 7 = 0 AND v_shields < 3 THEN
    v_shields := v_shields + 1;
    v_shield_earned := true;
  END IF;

  v_longest := GREATEST(COALESCE(v_profile.longest_streak, 0), v_new_streak);

  -- xp and level were written by score_checkin; the streak is this function's.
  UPDATE public.profiles
     SET streak = v_new_streak,
         longest_streak = v_longest,
         streak_shields = v_shields,
         updated_at = now()
   WHERE user_id = uid
  RETURNING xp, level INTO v_new_xp, v_new_level;

  -- The AFTER INSERT trigger scored the tier before the row had its points.
  PERFORM public.update_status_tier(uid);

  RETURN json_build_object(
    'checkin_id', v_checkin_id,
    'xp_earned', v_xp_earned,
    'day_score', v_score,
    'new_xp', v_new_xp,
    'old_level', COALESCE(v_profile.level, 1),
    'new_level', v_new_level,
    'old_streak', COALESCE(v_profile.streak, 0),
    'new_streak', v_new_streak,
    'streak_broken', v_streak_broken,
    'shield_used', v_shield_used,
    'shield_earned', v_shield_earned,
    'shields_remaining', v_shields
  );
END;
$$;

-- ── 4. verify_checkin — same signature; a re-score of the day ──────────────
CREATE OR REPLACE FUNCTION public.verify_checkin(
  _checkin_id uuid,
  _snapshot_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_checkin daily_checkins;
  v_score   jsonb;
  v_prev    integer;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_checkin FROM public.daily_checkins
   WHERE id = _checkin_id AND user_id = v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'checkin_not_found'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.health_sync_snapshots
     WHERE user_id = v_user AND snapshot_date = public.checkin_local_day(v_checkin)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_healthkit_snapshot');
  END IF;

  v_prev := COALESCE(v_checkin.verified_bonus_xp, 0);
  v_score := public.score_checkin(_checkin_id);
  SELECT * INTO v_checkin FROM public.daily_checkins WHERE id = _checkin_id;

  RETURN jsonb_build_object(
    'ok', true,
    'verified', v_checkin.verified_at IS NOT NULL,
    'matches', (SELECT count(*) FROM jsonb_each(COALESCE(v_checkin.verified_signals, '{}'::jsonb)) s WHERE (s.value ->> 'matched')::boolean),
    'bonus_xp', COALESCE(v_checkin.verified_bonus_xp, 0),
    'bonus_awarded', GREATEST(0, COALESCE(v_checkin.verified_bonus_xp, 0) - v_prev),
    'signals', COALESCE(v_checkin.verified_signals, '{}'::jsonb),
    'day_score', v_score
  );
END;
$$;

-- ── 5. upsert_health_snapshot — keeps `manual`, re-scores the day ──────────
CREATE OR REPLACE FUNCTION public.upsert_health_snapshot(
  _date date,
  _steps int DEFAULT NULL,
  _workout_minutes int DEFAULT NULL,
  _workout_count int DEFAULT NULL,
  _sleep_hours numeric DEFAULT NULL,
  _active_kcal int DEFAULT NULL,
  _source text DEFAULT 'healthkit',
  _mindful_minutes int DEFAULT NULL,
  _distance_m int DEFAULT NULL,
  _flights int DEFAULT NULL,
  _body_mass_kg numeric DEFAULT NULL,
  _body_fat_pct numeric DEFAULT NULL,
  _vo2max numeric DEFAULT NULL,
  _sources text[] DEFAULT NULL,
  _primary_sport text DEFAULT NULL,
  _workouts jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row health_sync_snapshots;
  v_workouts jsonb;
  v_checkin uuid;
  v_score jsonb;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF _date IS NULL THEN RETURN jsonb_build_object('error', 'invalid_date'); END IF;

  -- Re-shape the client's list: known keys, bounded numbers, short strings.
  IF _workouts IS NOT NULL AND jsonb_typeof(_workouts) = 'array' THEN
    SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'sport',        left(w->>'sport', 32),
      'hk_type',      left(w->>'hk_type', 48),
      'duration_min', LEAST(1440, GREATEST(1, COALESCE((w->>'duration_min')::int, 1))),
      'kcal',         CASE WHEN (w->>'kcal') ~ '^\d+$' THEN LEAST(10000, (w->>'kcal')::int) END,
      'distance_m',   CASE WHEN (w->>'distance_m') ~ '^\d+$' THEN LEAST(500000, (w->>'distance_m')::int) END,
      'avg_hr',       CASE WHEN (w->>'avg_hr') ~ '^\d+$' THEN LEAST(250, (w->>'avg_hr')::int) END,
      'source',       left(w->>'source', 64),
      'start',        left(w->>'start', 40),
      'manual',       CASE WHEN (w->>'manual') = 'true' THEN true END
    ))), '[]'::jsonb)
    INTO v_workouts
    FROM (SELECT w FROM jsonb_array_elements(_workouts) AS w WHERE w ? 'sport' LIMIT 20) AS t;
  END IF;

  INSERT INTO public.health_sync_snapshots
    (user_id, snapshot_date, steps, workout_minutes, workout_count, sleep_hours,
     active_kcal, source, mindful_minutes, distance_m, flights,
     body_mass_kg, body_fat_pct, vo2max, sources, primary_sport, workouts, last_synced_at)
  VALUES
    (v_user, _date, _steps, _workout_minutes, _workout_count, _sleep_hours,
     _active_kcal, _source, _mindful_minutes, _distance_m, _flights,
     _body_mass_kg, _body_fat_pct, _vo2max, COALESCE(_sources, '{}'),
     left(_primary_sport, 32), COALESCE(v_workouts, '[]'::jsonb), now())
  ON CONFLICT (user_id, snapshot_date) DO UPDATE
  SET steps           = COALESCE(EXCLUDED.steps, health_sync_snapshots.steps),
      workout_minutes = COALESCE(EXCLUDED.workout_minutes, health_sync_snapshots.workout_minutes),
      workout_count   = COALESCE(EXCLUDED.workout_count, health_sync_snapshots.workout_count),
      sleep_hours     = COALESCE(EXCLUDED.sleep_hours, health_sync_snapshots.sleep_hours),
      active_kcal     = COALESCE(EXCLUDED.active_kcal, health_sync_snapshots.active_kcal),
      mindful_minutes = COALESCE(EXCLUDED.mindful_minutes, health_sync_snapshots.mindful_minutes),
      distance_m      = COALESCE(EXCLUDED.distance_m, health_sync_snapshots.distance_m),
      flights         = COALESCE(EXCLUDED.flights, health_sync_snapshots.flights),
      body_mass_kg    = COALESCE(EXCLUDED.body_mass_kg, health_sync_snapshots.body_mass_kg),
      body_fat_pct    = COALESCE(EXCLUDED.body_fat_pct, health_sync_snapshots.body_fat_pct),
      vo2max          = COALESCE(EXCLUDED.vo2max, health_sync_snapshots.vo2max),
      sources         = ARRAY(SELECT DISTINCT unnest(health_sync_snapshots.sources || EXCLUDED.sources) ORDER BY 1),
      primary_sport   = COALESCE(EXCLUDED.primary_sport, health_sync_snapshots.primary_sport),
      workouts        = CASE WHEN v_workouts IS NULL THEN health_sync_snapshots.workouts ELSE EXCLUDED.workouts END,
      source          = EXCLUDED.source,
      last_synced_at  = now()
  RETURNING * INTO v_row;

  -- A session that reaches Health after the check-in re-scores the day here,
  -- without the client asking.
  SELECT dc.id INTO v_checkin FROM public.daily_checkins dc
   WHERE dc.user_id = v_user AND public.checkin_local_day(dc) = _date
   ORDER BY dc.checked_in_at DESC LIMIT 1;
  IF v_checkin IS NOT NULL THEN
    v_score := public.score_checkin(v_checkin);
  END IF;

  RETURN jsonb_build_object('ok', true, 'snapshot_id', v_row.id, 'day_score', v_score);
END;
$$;

-- ── 6. battle_day_scores: the bonus lives inside xp_earned now ─────────────
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
              WHEN 'xp'          THEN COALESCE(dc.xp_earned, 0)
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

-- ── 7. W-Rating: the 28-day average of day XP ──────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_rank_score(p_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sum numeric;
  total_score numeric;
BEGIN
  -- Callable by members for THEMSELVES only. Triggers (a battle settling the
  -- opponent's tier), cron and the service role pass: inside SECURITY DEFINER
  -- current_user is the owner, so the caller is read from the JWT role.
  IF pg_trigger_depth() = 0 AND auth.role() IN ('anon', 'authenticated') AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id) THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(xp_earned), 0) INTO v_sum
  FROM daily_checkins
  WHERE user_id = p_user_id AND checked_in_at >= now() - interval '28 days';

  total_score := ROUND(v_sum / 28.0, 1);

  UPDATE profiles
  SET rank_score = total_score, rank_score_updated_at = now()
  WHERE user_id = p_user_id;

  RETURN total_score;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_rank_score_breakdown(uuid);
CREATE OR REPLACE FUNCTION public.get_rank_score_breakdown(p_user_id uuid)
RETURNS TABLE(
  days_logged integer,
  avg_xp numeric,
  best_day integer,
  total numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Own data only (or service role).
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND current_setting('role', true) IN ('authenticated', 'anon') THEN
    RETURN;
  END IF;
  SELECT count(*)::integer, ROUND(COALESCE(SUM(xp_earned), 0) / 28.0, 1), COALESCE(MAX(xp_earned), 0)::integer
    INTO days_logged, avg_xp, best_day
    FROM daily_checkins
   WHERE user_id = p_user_id AND checked_in_at >= now() - interval '28 days';
  total := avg_xp;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.get_rank_score_breakdown(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rank_score_breakdown(uuid) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Batch 2 — the boards rank days, not networks
-- ═══════════════════════════════════════════════════════════════════════════

-- claim_referral: the link, no XP (bodies otherwise as 20260826140000).
CREATE OR REPLACE FUNCTION public.claim_referral(p_referrer_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_me public.profiles;
  v_inserted boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_referrer_code IS NULL OR length(trim(p_referrer_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code');
  END IF;

  SELECT * INTO v_me FROM profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_me.created_at IS NOT NULL AND v_me.created_at < now() - interval '7 days' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'account_too_old');
  END IF;

  IF v_me.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  SELECT user_id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = trim(p_referrer_code)
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
  END IF;

  UPDATE profiles SET referred_by = v_referrer_id, updated_at = now()
  WHERE user_id = v_user_id AND referred_by IS NULL;

  INSERT INTO referrals (referrer_id, referred_id, converted)
  VALUES (v_referrer_id, v_user_id, false)
  ON CONFLICT (referred_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
  END IF;

  RETURN jsonb_build_object('success', false, 'reason', 'duplicate');
END;
$$;

-- reward_referral_conversion: free months + badges, no XP (as 20260824120000).
CREATE OR REPLACE FUNCTION public.reward_referral_conversion(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_id uuid;
  v_paid_count integer;
  v_milestones jsonb;
  v_badge_id uuid;
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
    SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = 1 LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
    END IF;
    v_rewards := v_rewards || '["first_recruit"]'::jsonb;
  END IF;

  FOREACH v_badge_count IN ARRAY ARRAY[5, 10, 25, 50] LOOP
    IF v_paid_count >= v_badge_count AND NOT (v_milestones ? v_badge_count::text) THEN
      UPDATE profiles
      SET referral_milestones_hit = referral_milestones_hit || jsonb_build_array(v_badge_count::text)
      WHERE user_id = v_referrer_id;
      SELECT id INTO v_badge_id FROM badges WHERE requirement_type = 'paid_referrals' AND requirement_value = v_badge_count LIMIT 1;
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO user_badges (user_id, badge_id) VALUES (v_referrer_id, v_badge_id) ON CONFLICT DO NOTHING;
      END IF;
      v_rewards := v_rewards || jsonb_build_array('badge_' || v_badge_count::text);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'paid_count', v_paid_count, 'rewards', v_rewards);
END;
$function$;

-- tg_referral_activation: the recruit's 3rd check-in still notifies, no XP.
CREATE OR REPLACE FUNCTION public.tg_referral_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkins integer;
  v_referrer uuid;
BEGIN
  BEGIN
    SELECT referrer_id INTO v_referrer
    FROM referrals
    WHERE referred_id = NEW.user_id AND activated_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_referrer IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT count(*) INTO v_checkins FROM daily_checkins WHERE user_id = NEW.user_id;
    IF v_checkins < 3 THEN
      RETURN NEW;
    END IF;

    UPDATE referrals SET activated_at = now()
    WHERE referred_id = NEW.user_id AND activated_at IS NULL;

    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/notify-referral',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'referrer_id', v_referrer,
        'referred_id', NEW.user_id,
        'kind', 'activated'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

-- Kudos and likes keep their counts and badge; XP no longer moves.
CREATE OR REPLACE FUNCTION public.handle_kudos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_kudos integer;
  badge_id_val uuid;
BEGIN
  UPDATE feed_posts SET kudos_count = kudos_count + 1 WHERE id = NEW.post_id;

  SELECT count(*) INTO total_kudos FROM kudos WHERE receiver_id = NEW.receiver_id;
  IF total_kudos >= 10 THEN
    SELECT id INTO badge_id_val FROM badges WHERE requirement_type = 'total_kudos' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (NEW.receiver_id, badge_id_val)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_kudos_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE feed_posts SET kudos_count = GREATEST(kudos_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_tribe_kudos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tribe_posts SET kudos_count = kudos_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_tribe_kudos_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tribe_posts SET kudos_count = GREATEST(kudos_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_feed_reaction_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id INTO post_owner_id FROM feed_posts WHERE id = NEW.post_id;
    IF post_owner_id IS NOT NULL AND post_owner_id != NEW.user_id THEN
      UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT user_id INTO post_owner_id FROM feed_posts WHERE id = OLD.post_id;
    IF post_owner_id IS NOT NULL AND post_owner_id != OLD.user_id THEN
      UPDATE feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 1v1: the winner takes the W on the record (battles.winner_id), not XP.
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

    UPDATE battles
       SET status = 'completed', ended_at = now(),
           challenger_score = v_c, opponent_score = v_o,
           winner_id = v_winner, winner_verified = v_verified
     WHERE id = b.id AND status = 'active';
    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN CONTINUE; END IF;
    -- status_tier for both: trigger update_status_after_battle.
    -- notifications + push: trigger battles_notify.
  END LOOP;
END;
$$;

-- An orphan XP faucet: granted to authenticated, no caller in the app.
DROP FUNCTION IF EXISTS public.log_habit(uuid, date);

-- season_board: a member you blocked (or who blocked you) is not on your board.
-- DEFINER now: blocked_users only shows a member their own blocks, and the
-- other direction has to hide too. It reads nothing the board did not.
CREATE OR REPLACE FUNCTION public.season_board(p_season_id uuid, p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH scored AS (
    SELECT p.user_id, p.username, p.xp, p.level, p.streak, p.avatar_url, p.status_tier,
           GREATEST(p.xp - COALESCE(b.baseline_xp, p.xp), 0) AS season_points
    FROM profiles p
    LEFT JOIN leaderboard_season_baselines b ON b.season_id = p_season_id AND b.user_id = p.user_id
    WHERE p.xp > 0
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users bu
         WHERE (bu.blocker_id = auth.uid() AND bu.blocked_id = p.user_id)
            OR (bu.blocker_id = p.user_id AND bu.blocked_id = auth.uid())
      )
  ), ranked AS (
    SELECT s.*, row_number() OVER (ORDER BY s.season_points DESC, s.xp DESC, s.user_id) AS rn
    FROM scored s WHERE s.season_points > 0
  )
  SELECT jsonb_build_object(
    'top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', r.user_id, 'username', r.username, 'xp', r.xp, 'level', r.level, 'streak', r.streak,
        'avatar_url', r.avatar_url, 'status_tier', r.status_tier, 'season_points', r.season_points
      ) ORDER BY r.rn)
      FROM ranked r WHERE r.rn <= LEAST(GREATEST(p_limit, 1), 200)
    ), '[]'::jsonb),
    'my_rank', (SELECT r.rn FROM ranked r WHERE r.user_id = auth.uid()),
    'total', (SELECT count(*) FROM ranked)
  );
$$;
REVOKE ALL ON FUNCTION public.season_board(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.season_board(uuid, int) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Batch 3 — tribes rank per member
-- ═══════════════════════════════════════════════════════════════════════════

-- Average day XP per active member per day over a window: a 5-member tribe can
-- beat a 50-member one.
CREATE OR REPLACE FUNCTION public.tribe_member_avg(p_tribe uuid, p_from timestamptz, p_to timestamptz)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH m AS (SELECT user_id FROM tribe_members WHERE tribe_id = p_tribe AND status = 'active'),
       n AS (SELECT count(*) AS c FROM m),
       d AS (SELECT GREATEST(1, ceil(EXTRACT(EPOCH FROM (p_to - p_from)) / 86400.0)) AS days),
       s AS (SELECT COALESCE(SUM(dc.xp_earned), 0) AS total
               FROM daily_checkins dc JOIN m ON m.user_id = dc.user_id
              WHERE dc.checked_in_at >= p_from AND dc.checked_in_at < p_to)
  SELECT CASE WHEN n.c = 0 THEN 0 ELSE ROUND(s.total / (n.c * d.days), 1) END
    FROM n, d, s
$$;
REVOKE ALL ON FUNCTION public.tribe_member_avg(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

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
  v_score numeric;
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

    v_score := public.tribe_member_avg(r.id, now() - interval '7 days', now());

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
        weekly_score = v_score,
        fire_tier = v_tier,
        longest_collective = GREATEST(r.longest_collective, v_streak)
    WHERE id = r.id;

    IF v_tier > r.fire_tier AND v_tier >= 0 THEN
      INSERT INTO tribe_milestones (tribe_id, kind, payload)
      VALUES (r.id, 'tier_up', jsonb_build_object('tier', v_tier, 'streak', v_streak));
    END IF;
  END LOOP;
END $$;

-- Same signature and shape; score = average XP per member per day (weekly:
-- the owned column; all-time: lifetime XP per active member). Tribes under
-- three members are listed after the ranked field, never above it.
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
    SELECT t.id, t.name, t.slug, t.cover_url, t.visibility, t.member_count, t.weekly_score, t.collective_streak
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
      e.id, e.name, e.slug, e.cover_url, e.visibility, e.member_count, e.collective_streak,
      CASE
        WHEN p_period = 'weekly' THEN round(e.weekly_score)::bigint
        ELSE COALESCE((
          SELECT round(AVG(p.xp))::bigint FROM profiles p
          WHERE p.user_id IN (
            SELECT tm.user_id FROM tribe_members tm
            WHERE tm.tribe_id = e.id AND tm.status = 'active'
          )
        ), 0)
      END AS score,
      (e.member_count >= 3) AS ranked
    FROM eligible e
  )
  SELECT s.id, s.name, s.slug, s.cover_url, s.visibility, s.member_count, s.score,
         ROW_NUMBER() OVER (ORDER BY s.ranked DESC, s.score DESC, s.collective_streak DESC, s.id)::int AS rank
  FROM scored s
  ORDER BY s.ranked DESC, s.score DESC, s.collective_streak DESC, s.id
  LIMIT p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.tribe_battle_standings(p_battle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  v_end timestamptz;
  v_c bigint := 0;
  v_o bigint := 0;
BEGIN
  SELECT * INTO b FROM tribe_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status <> 'active' OR b.started_at IS NULL THEN
    RETURN jsonb_build_object(
      'challenger_score', COALESCE(b.challenger_score, 0),
      'opponent_score', COALESCE(b.opponent_score, 0),
      'live', false
    );
  END IF;

  v_end := b.started_at + (b.duration_days || ' days')::interval;

  v_c := round(public.tribe_member_avg(b.challenger_tribe_id, b.started_at, LEAST(v_end, now())));
  v_o := round(public.tribe_member_avg(b.opponent_tribe_id, b.started_at, LEAST(v_end, now())));

  RETURN jsonb_build_object(
    'challenger_score', v_c,
    'opponent_score', v_o,
    'live', true,
    'seconds_left', GREATEST(0, EXTRACT(EPOCH FROM (v_end - now())))::bigint
  );
END $$;

-- Tribe battles: per-member averages decide; the tribe's fire is the prize.
CREATE OR REPLACE FUNCTION public.resolve_tribe_battle(p_battle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  v_end timestamptz;
  v_challenger_score int := 0;
  v_opponent_score int := 0;
  v_winner uuid;
  v_claimed int;
BEGIN
  SELECT * INTO b FROM tribe_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status <> 'active' THEN RETURN; END IF;
  IF b.started_at IS NULL THEN RETURN; END IF;

  v_end := b.started_at + (b.duration_days || ' days')::interval;
  IF v_end > now() THEN RETURN; END IF;

  v_challenger_score := round(public.tribe_member_avg(b.challenger_tribe_id, b.started_at, v_end));
  v_opponent_score   := round(public.tribe_member_avg(b.opponent_tribe_id, b.started_at, v_end));

  IF v_challenger_score > v_opponent_score THEN
    v_winner := b.challenger_tribe_id;
  ELSIF v_opponent_score > v_challenger_score THEN
    v_winner := b.opponent_tribe_id;
  ELSE
    v_winner := NULL;
  END IF;

  UPDATE tribe_battles
  SET status = 'completed',
      ended_at = now(),
      challenger_score = v_challenger_score,
      opponent_score = v_opponent_score,
      winner_tribe_id = v_winner
  WHERE id = p_battle_id AND status = 'active';
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN RETURN; END IF;
END;
$$;

-- Tribe challenge: the milestone stays, the per-member XP goes.
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
        UPDATE tribe_challenges
        SET status = 'completed', completed_at = now()
        WHERE id = r.id AND status = 'active';
        GET DIAGNOSTICS v_claimed = ROW_COUNT;
        IF v_claimed = 1 THEN
          INSERT INTO tribe_milestones (tribe_id, kind, payload)
          VALUES (r.tribe_id, 'challenge_done',
                  jsonb_build_object('target', r.target, 'week', v_week));
        END IF;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Batch 4 — rescore history, rebase xp / level / baselines / ratings
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.daily_checkins ORDER BY checked_in_at LOOP
    PERFORM public.score_checkin(r.id);
  END LOOP;
END $$;

-- profiles.xp = Σ day XP + 15 per Vault practice day.
WITH days AS (
  SELECT user_id, COALESCE(SUM(xp_earned), 0) AS xp FROM public.daily_checkins GROUP BY user_id
), practice AS (
  SELECT user_id, count(DISTINCT practiced_at::date) * 15 AS xp
    FROM public.vault_lesson_progress WHERE practiced_at IS NOT NULL GROUP BY user_id
)
UPDATE public.profiles p
   SET xp = COALESCE(d.xp, 0) + COALESCE(v.xp, 0),
       level = floor((COALESCE(d.xp, 0) + COALESCE(v.xp, 0)) / 500) + 1,
       updated_at = now()
  FROM public.profiles p2
  LEFT JOIN days d ON d.user_id = p2.user_id
  LEFT JOIN practice v ON v.user_id = p2.user_id
 WHERE p.user_id = p2.user_id;

-- The active season's baselines: what each member had before it started.
UPDATE public.leaderboard_season_baselines b
   SET baseline_xp = COALESCE((
         SELECT SUM(dc.xp_earned) FROM public.daily_checkins dc
          WHERE dc.user_id = b.user_id AND dc.checked_in_at < s.starts_at), 0)
       + COALESCE((
         SELECT count(DISTINCT practiced_at::date) * 15 FROM public.vault_lesson_progress v
          WHERE v.user_id = b.user_id AND v.practiced_at IS NOT NULL AND v.practiced_at < s.starts_at), 0)
  FROM public.leaderboard_seasons s
 WHERE s.id = b.season_id AND s.status = 'active';

SELECT public.refresh_tribe_fire();
SELECT public.update_all_status_tiers();

NOTIFY pgrst, 'reload schema';
