-- ============================================================
-- Bug purge — security + integrity batch (S1,S6,S7,D1..D4,B7,C4)
-- ============================================================
-- Closes the active exploits found by the full-app audit:
--   S1  protect_profile_columns lost its entitlement-column protection when two
--       later migrations re-pasted the function from a pre-hardening baseline.
--       Any user could self-grant permanent Premium/Apex from the console.
--   S6  profiles.timezone was client-writable, bypassing touch_activity's
--       validation — one bad IANA string aborts users_due_for_streak_reminder /
--       users_lapsed for EVERYONE (global push outage).
--   S7  coach_nudges UPDATE policy was column-unrestricted (created_at
--       rewritable → dedup bypass). No client even uses it (nothing writes
--       seen_at today) — replaced with a narrow mark_nudge_seen RPC.
--   D1  complete_coach_mission trusted client-supplied mission XP (unbounded
--       minting via upsert_daily_plan).
--   D2  log_habit accepted any _date → XP/streak farming across history; and
--       user_habits stat columns were directly writable.
--   D3  verify_checkin wrote xp from a stale read (clobbered concurrent awards).
--   D4  verify_checkin counted UNCLAIMED signals (steps/mindfulness) toward the
--       verified verdict → "Verified ✓" + bonus XP with both real claims failing.
--   B7  missing indexes made every check-in pay a full scan of daily_checkins
--       (rank window aggregate) + a full sort of profiles.
--   C4  analytics_events had no event-size cap and no retention.
--   +   coach_nudges gains a `kind` + unique/day index (dedup backstop for the
--       nudge engines), and the coach plan tables join the realtime publication
--       so the existing useDailyPlan subscription actually receives events.
-- ============================================================

-- ------------------------------------------------------------
-- S1 + S6 — protect_profile_columns: union of ALL protections.
-- ⚠️ EDIT THIS FUNCTION IN PLACE — never re-paste from an older migration.
-- This exact regression (re-pasting from a stale baseline) happened twice
-- (20260707130000, 20260707140000) and silently dropped the entitlement locks.
-- SECURITY DEFINER server functions (touch_activity, set_elite_status, …) are
-- unaffected: they run as the owner, not 'authenticated'.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.xp             IS DISTINCT FROM OLD.xp
    OR NEW.level          IS DISTINCT FROM OLD.level
    OR NEW.streak         IS DISTINCT FROM OLD.streak
    OR NEW.longest_streak IS DISTINCT FROM OLD.longest_streak
    OR NEW.streak_shields IS DISTINCT FROM OLD.streak_shields
    OR NEW.status_tier    IS DISTINCT FROM OLD.status_tier
    OR NEW.tier_division  IS DISTINCT FROM OLD.tier_division
    OR NEW.is_elite       IS DISTINCT FROM OLD.is_elite
    OR NEW.is_premium     IS DISTINCT FROM OLD.is_premium
    OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
    OR NEW.referral_count IS DISTINCT FROM OLD.referral_count
    OR NEW.referral_code  IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by    IS DISTINCT FROM OLD.referred_by
    -- membership / rank columns — server functions only (S1)
    OR NEW.is_apex_subscriber       IS DISTINCT FROM OLD.is_apex_subscriber
    OR NEW.apex_credits_until       IS DISTINCT FROM OLD.apex_credits_until
    OR NEW.membership_credits_until IS DISTINCT FROM OLD.membership_credits_until
    OR NEW.legend_pinned            IS DISTINCT FROM OLD.legend_pinned
    OR NEW.rank_score               IS DISTINCT FROM OLD.rank_score
    OR NEW.trust_multiplier         IS DISTINCT FROM OLD.trust_multiplier
    -- timezone — only via touch_activity's validated write (S6): a raw string
    -- here aborts every set-based AT TIME ZONE query (global push outage)
    OR NEW.timezone                 IS DISTINCT FROM OLD.timezone
    THEN
      RAISE EXCEPTION
        'Protected profile columns can only be changed via server functions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- D1 — complete_coach_mission: clamp XP to the generator's real range (10–80).
-- upsert_daily_plan accepts client missions verbatim, so the award side must
-- never trust the stored value.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_coach_mission(_plan_id uuid, _mission_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan record;
  v_mission jsonb;
  v_xp integer := 0;
  v_already boolean;
  v_new_xp integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_plan FROM public.coach_daily_plans WHERE id = _plan_id;
  IF NOT FOUND OR v_plan.user_id <> v_user THEN
    RETURN jsonb_build_object('error', 'plan_not_found');
  END IF;

  SELECT m INTO v_mission
  FROM jsonb_array_elements(v_plan.missions) m
  WHERE m->>'id' = _mission_id
  LIMIT 1;

  IF v_mission IS NULL THEN
    RETURN jsonb_build_object('error', 'mission_not_found');
  END IF;

  -- Anti-mint clamp: plan missions can be written by the client via
  -- upsert_daily_plan, so the stored xp is untrusted. 80 = generator max.
  v_xp := LEAST(GREATEST(COALESCE((v_mission->>'xp')::int, 15), 0), 80);

  SELECT EXISTS(
    SELECT 1 FROM public.coach_mission_logs
    WHERE daily_plan_id = _plan_id AND mission_id = _mission_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  INSERT INTO public.coach_mission_logs(user_id, daily_plan_id, mission_id, xp_awarded)
  VALUES (v_user, _plan_id, _mission_id, v_xp);

  UPDATE public.profiles
  SET xp = xp + v_xp,
      updated_at = now()
  WHERE user_id = v_user
  RETURNING xp INTO v_new_xp;

  RETURN jsonb_build_object(
    'ok', true,
    'xp_awarded', v_xp,
    'new_xp', v_new_xp
  );
END;
$$;

-- ------------------------------------------------------------
-- D2a — log_habit: bound _date to [utc_today-1, utc_today+1].
-- The client sends its LOCAL date (may be UTC±1); anything further back/forward
-- is a farming attempt (each distinct date = 8–16 XP + fabricated streaks).
-- Only the date guard changes — streak/XP logic is reproduced verbatim.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_habit(_habit_id uuid, _date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_habit public.user_habits%ROWTYPE;
  v_logged_on date := COALESCE(_date, (now() AT TIME ZONE 'UTC')::date);
  v_already uuid;
  v_base_xp int := 8;
  v_level_mult numeric := 1.0;
  v_xp int;
  v_new_streak int;
  v_new_level int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Anti-farm bound: local "today" can differ from UTC by at most a day.
  IF v_logged_on < (now() AT TIME ZONE 'UTC')::date - 1
     OR v_logged_on > (now() AT TIME ZONE 'UTC')::date + 1 THEN
    RETURN jsonb_build_object('error', 'invalid_date');
  END IF;

  IF NOT public.has_premium(v_user) THEN
    RETURN jsonb_build_object('error', 'premium_required');
  END IF;

  SELECT * INTO v_habit FROM public.user_habits
   WHERE id = _habit_id AND user_id = v_user AND archived_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'habit_not_found');
  END IF;

  SELECT id INTO v_already FROM public.user_habit_logs
   WHERE habit_id = _habit_id AND logged_on = v_logged_on;
  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_logged');
  END IF;

  -- Streak logic: consecutive days
  IF v_habit.last_logged_on IS NULL THEN
    v_new_streak := 1;
  ELSIF v_habit.last_logged_on = v_logged_on - INTERVAL '1 day' THEN
    v_new_streak := v_habit.current_streak + 1;
  ELSIF v_habit.last_logged_on = v_logged_on THEN
    v_new_streak := v_habit.current_streak;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Level from streak (habit maturity ladder)
  v_new_level := CASE
    WHEN v_new_streak >= 120 THEN 5
    WHEN v_new_streak >= 60  THEN 4
    WHEN v_new_streak >= 21  THEN 3
    WHEN v_new_streak >= 7   THEN 2
    ELSE 1
  END;

  v_level_mult := CASE v_new_level
    WHEN 1 THEN 1.0
    WHEN 2 THEN 1.25
    WHEN 3 THEN 1.5
    WHEN 4 THEN 1.75
    WHEN 5 THEN 2.0
  END;

  v_xp := GREATEST(5, ROUND(v_base_xp * v_level_mult));

  INSERT INTO public.user_habit_logs (habit_id, user_id, logged_on, xp_awarded)
  VALUES (_habit_id, v_user, v_logged_on, v_xp);

  UPDATE public.user_habits
     SET current_streak = v_new_streak,
         best_streak = GREATEST(best_streak, v_new_streak),
         level = v_new_level,
         last_logged_on = v_logged_on,
         updated_at = now()
   WHERE id = _habit_id;

  UPDATE public.profiles
     SET xp = xp + v_xp,
         updated_at = now()
   WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'xp_awarded', v_xp,
    'streak', v_new_streak,
    'level', v_new_level
  );
END;
$$;

-- ------------------------------------------------------------
-- D2b — user_habits stat columns: the UPDATE policy can't restrict columns
-- (client legitimately archives via a direct UPDATE of archived_at), so guard
-- the server-owned stats with a trigger — same pattern as profiles.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_habit_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.current_streak IS DISTINCT FROM OLD.current_streak
    OR NEW.best_streak    IS DISTINCT FROM OLD.best_streak
    OR NEW.level          IS DISTINCT FROM OLD.level
    OR NEW.last_logged_on IS DISTINCT FROM OLD.last_logged_on
    OR NEW.protocol_id    IS DISTINCT FROM OLD.protocol_id
    THEN
      RAISE EXCEPTION
        'Habit stats can only be changed via log_habit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_habit_stats_trg ON public.user_habits;
CREATE TRIGGER protect_user_habit_stats_trg
  BEFORE UPDATE ON public.user_habits
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_habit_stats();

-- ------------------------------------------------------------
-- D3 + D4 — verify_checkin:
--   * Only CLAIMED signals count toward the verdict (steps becomes display-only;
--     meditation is claim-counted). No more "Verified ✓" while every actual
--     claim failed.
--   * XP write is relative (xp = xp + delta) — no stale-read clobber of a
--     concurrent record_checkin / mission award.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_checkin(uuid, date);

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
  v_user      uuid := auth.uid();
  v_checkin   daily_checkins;
  v_snapshot  health_sync_snapshots;
  v_target_date date;
  v_signals   jsonb := '{}'::jsonb;
  v_match_count int := 0;      -- matched CLAIMS only
  v_total_claims int := 0;     -- claims the user actually made
  v_verified bool := false;
  v_bonus_target int := 0;     -- 10 XP per verified claimed signal
  v_bonus_delta  int := 0;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_checkin FROM public.daily_checkins
   WHERE id = _checkin_id AND user_id = v_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'checkin_not_found'); END IF;

  v_target_date := COALESCE(_snapshot_date, (v_checkin.checked_in_at AT TIME ZONE 'UTC')::date);

  SELECT * INTO v_snapshot FROM public.health_sync_snapshots
   WHERE user_id = v_user
     AND snapshot_date BETWEEN v_target_date - 1 AND v_target_date + 1
   ORDER BY (snapshot_date = v_target_date) DESC, snapshot_date DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_healthkit_snapshot');
  END IF;

  -- Workout claim
  IF v_checkin.workout = true THEN
    v_total_claims := v_total_claims + 1;
    IF COALESCE(v_snapshot.workout_count,0) >= 1 OR COALESCE(v_snapshot.workout_minutes,0) >= 15 THEN
      v_match_count := v_match_count + 1;
      v_bonus_target := v_bonus_target + 10;
      v_signals := v_signals || jsonb_build_object('workout', jsonb_build_object(
        'matched', true,
        'workout_count', v_snapshot.workout_count,
        'workout_minutes', v_snapshot.workout_minutes
      ));
    ELSE
      v_signals := v_signals || jsonb_build_object('workout', jsonb_build_object('matched', false));
    END IF;
  END IF;

  -- Sleep claim (±1h tolerance)
  IF v_checkin.sleep_hours IS NOT NULL AND v_snapshot.sleep_hours IS NOT NULL THEN
    v_total_claims := v_total_claims + 1;
    IF abs(v_checkin.sleep_hours - v_snapshot.sleep_hours) <= 1.0 THEN
      v_match_count := v_match_count + 1;
      v_bonus_target := v_bonus_target + 10;
      v_signals := v_signals || jsonb_build_object('sleep', jsonb_build_object(
        'matched', true, 'claimed_h', v_checkin.sleep_hours, 'healthkit_h', v_snapshot.sleep_hours
      ));
    ELSE
      v_signals := v_signals || jsonb_build_object('sleep', jsonb_build_object(
        'matched', false, 'claimed_h', v_checkin.sleep_hours, 'healthkit_h', v_snapshot.sleep_hours
      ));
    END IF;
  END IF;

  -- Meditation claim — now properly claim-counted (was match-only, which let an
  -- unclaimed signal carry the verdict).
  IF v_checkin.meditation_morning = true OR v_checkin.meditation_evening = true THEN
    v_total_claims := v_total_claims + 1;
    IF COALESCE(v_snapshot.mindful_minutes,0) > 0 THEN
      v_match_count := v_match_count + 1;
      v_bonus_target := v_bonus_target + 10;
      v_signals := v_signals || jsonb_build_object('mindfulness', jsonb_build_object(
        'matched', true, 'minutes', v_snapshot.mindful_minutes
      ));
    ELSE
      v_signals := v_signals || jsonb_build_object('mindfulness', jsonb_build_object('matched', false));
    END IF;
  END IF;

  -- Steps: DISPLAY-ONLY context. Never counts toward the verdict and never
  -- awards bonus XP — walking 8k steps must not "verify" a failed workout claim.
  IF v_snapshot.steps IS NOT NULL AND v_snapshot.steps >= 8000 THEN
    v_signals := v_signals || jsonb_build_object('steps', jsonb_build_object(
      'matched', true, 'count', v_snapshot.steps
    ));
  END IF;

  -- Verdict over CLAIMS only: two matched claims, or a lone claim that matched.
  v_verified := v_match_count >= 2 OR (v_total_claims = 1 AND v_match_count >= 1);

  IF v_verified THEN
    v_bonus_delta := GREATEST(0, v_bonus_target - COALESCE(v_checkin.verified_bonus_xp, 0));
  ELSE
    v_bonus_delta := 0;
  END IF;

  UPDATE public.daily_checkins
     SET verified_at = CASE WHEN v_verified THEN now() ELSE NULL END,
         verified_signals = v_signals,
         verified_bonus_xp = CASE WHEN v_verified THEN v_bonus_target ELSE COALESCE(verified_bonus_xp,0) END
   WHERE id = _checkin_id;

  IF v_bonus_delta > 0 THEN
    -- Relative update — atomic against concurrent XP awards (D3).
    UPDATE public.profiles
       SET xp = xp + v_bonus_delta,
           level = floor((xp + v_bonus_delta) / 500) + 1,
           updated_at = now()
     WHERE user_id = v_user;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'verified', v_verified,
    'matches', v_match_count,
    'claims', v_total_claims,
    'bonus_xp', v_bonus_target,
    'bonus_awarded', v_bonus_delta,
    'signals', v_signals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_checkin(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_checkin(uuid, date) TO authenticated;

-- ------------------------------------------------------------
-- S7 + nudge dedup — coach_nudges:
--   * `kind` distinguishes the daily slot from the evening streak-save, so the
--     morning nudge no longer suppresses the streak-risk push (and vice versa).
--   * unique per (user, kind, day) is the race-proof dedup backstop for both
--     nudge engines (their SELECT-then-INSERT raced).
--   * the column-unrestricted UPDATE policy (created_at rewritable → dedup
--     bypass) is dropped; seen-marking goes through a narrow RPC.
-- ------------------------------------------------------------
ALTER TABLE public.coach_nudges
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'daily';

-- Dedupe history first (the maybeSingle dedup bug produced same-day duplicates
-- which would make the unique index fail): keep the newest per user+kind+day.
DELETE FROM public.coach_nudges cn
USING public.coach_nudges newer
WHERE cn.user_id = newer.user_id
  AND cn.kind = newer.kind
  AND (cn.created_at AT TIME ZONE 'UTC')::date = (newer.created_at AT TIME ZONE 'UTC')::date
  AND newer.created_at > cn.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS coach_nudges_user_kind_day_unique
  ON public.coach_nudges (user_id, kind, ((created_at AT TIME ZONE 'UTC')::date));

DROP POLICY IF EXISTS "Users can mark own nudges seen" ON public.coach_nudges;

CREATE OR REPLACE FUNCTION public.mark_nudge_seen(_nudge_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coach_nudges
     SET seen_at = COALESCE(seen_at, now())
   WHERE id = _nudge_id AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.mark_nudge_seen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_nudge_seen(uuid) TO authenticated;

-- ------------------------------------------------------------
-- B7 — the two missing indexes. calculate_rank_score aggregates the last 7 days
-- of daily_checkins ACROSS ALL USERS (needs checked_in_at leading), and
-- update_status_tier sorts/counts profiles by rank_score. Without these, every
-- check-in paid a full scan of daily_checkins while holding the profile lock.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_at
  ON public.daily_checkins (checked_in_at);

CREATE INDEX IF NOT EXISTS idx_profiles_rank_score
  ON public.profiles (rank_score DESC)
  WHERE rank_score > 0;

-- ------------------------------------------------------------
-- C4 — analytics_events hygiene: cap event size, add retention.
-- NOT VALID = applies to new rows only (no full-table validation at apply time).
-- ------------------------------------------------------------
ALTER TABLE public.analytics_events
  DROP CONSTRAINT IF EXISTS analytics_event_len;
ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_event_len
  CHECK (char_length(event) <= 64 AND pg_column_size(props) <= 8192) NOT VALID;

DO $$
BEGIN
  PERFORM cron.schedule(
    'analytics-retention',
    '30 4 * * *',
    $job$ DELETE FROM public.analytics_events WHERE created_at < now() - interval '180 days' $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule analytics-retention manually';
END $$;

-- ------------------------------------------------------------
-- Realtime — the useDailyPlan subscription listens on these tables but they
-- were never added to the publication, so no event ever arrived.
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_daily_plans;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_mission_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.coach_daily_plans REPLICA IDENTITY FULL;
ALTER TABLE public.coach_mission_logs REPLICA IDENTITY FULL;
