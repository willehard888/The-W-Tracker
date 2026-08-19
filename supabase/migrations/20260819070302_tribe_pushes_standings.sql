-- ============================================================
-- Tribe pushes + live battle standings (E4 of the tribe core program).
-- Triggers fan tribe events out to the tribe-notify edge function
-- (pg_net + vault, same pattern as referral notify — EXCEPTION-guarded
-- so a push can never break the underlying write). tribe-nudges runs
-- hourly for event reminders + the 17:00 UTC fire-at-risk nudge.
-- ============================================================

-- ── Trigger → tribe-notify fanout ────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_tribe_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text;
  v_body jsonb;
BEGIN
  IF TG_TABLE_NAME = 'tribe_battles' AND TG_OP = 'INSERT' THEN
    v_kind := 'battle_challenge';
    v_body := jsonb_build_object('battle_id', NEW.id);
  ELSIF TG_TABLE_NAME = 'tribe_battles' AND TG_OP = 'UPDATE'
        AND NEW.status = 'completed' AND OLD.status = 'active' THEN
    v_kind := 'battle_resolved';
    v_body := jsonb_build_object('battle_id', NEW.id);
  ELSIF TG_TABLE_NAME = 'tribe_invites' AND TG_OP = 'INSERT' THEN
    v_kind := 'invite';
    v_body := jsonb_build_object('invite_id', NEW.id);
  ELSIF TG_TABLE_NAME = 'tribe_milestones' AND TG_OP = 'INSERT'
        AND NEW.kind IN ('tier_up','challenge_done') THEN
    v_kind := 'milestone';
    v_body := jsonb_build_object('milestone_id', NEW.id);
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/tribe-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object('kind', v_kind) || v_body
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never let a push failure break the write
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tribe_battles_notify ON public.tribe_battles;
CREATE TRIGGER tribe_battles_notify
  AFTER INSERT OR UPDATE OF status ON public.tribe_battles
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_notify();

DROP TRIGGER IF EXISTS tribe_invites_notify ON public.tribe_invites;
CREATE TRIGGER tribe_invites_notify
  AFTER INSERT ON public.tribe_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_notify();

DROP TRIGGER IF EXISTS tribe_milestones_notify ON public.tribe_milestones;
CREATE TRIGGER tribe_milestones_notify
  AFTER INSERT ON public.tribe_milestones
  FOR EACH ROW EXECUTE FUNCTION public.tg_tribe_notify();

-- ── Hourly nudges cron ───────────────────────────────────────
DO $$ BEGIN PERFORM cron.unschedule('tribe-nudges-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('tribe-nudges-hourly', '5 * * * *', $job$
  select net.http_post(
    url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/tribe-nudges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb);
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule tribe-nudges-hourly manually';
END $$;

-- ── Fire-at-risk set for the evening nudge ───────────────────
-- Members who have NOT checked in today, in tribes where ≥2 others have.
-- One row per (user, tribe); the edge fn dedupes to one push per user.
CREATE OR REPLACE FUNCTION public.tribe_fire_at_risk()
RETURNS TABLE (user_id uuid, tribe_name text, checked int, total int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH today AS (
    SELECT DISTINCT dc.user_id
    FROM daily_checkins dc
    WHERE dc.checked_in_at >= date_trunc('day', now())
  ),
  tribe_stats AS (
    SELECT tm.tribe_id,
           count(*) FILTER (WHERE td.user_id IS NOT NULL) AS checked,
           count(*) AS total
    FROM tribe_members tm
    LEFT JOIN today td ON td.user_id = tm.user_id
    WHERE tm.status = 'active'
    GROUP BY tm.tribe_id
    HAVING count(*) FILTER (WHERE td.user_id IS NOT NULL) >= 2
  )
  SELECT tm.user_id, t.name AS tribe_name, ts.checked::int, ts.total::int
  FROM tribe_stats ts
  JOIN tribes t ON t.id = ts.tribe_id
  JOIN tribe_members tm ON tm.tribe_id = ts.tribe_id AND tm.status = 'active'
  LEFT JOIN today td ON td.user_id = tm.user_id
  WHERE td.user_id IS NULL
  ORDER BY ts.checked DESC;
$$;
REVOKE ALL ON FUNCTION public.tribe_fire_at_risk() FROM PUBLIC, anon, authenticated;

-- ── Live battle standings — kills the 0-0 scoreboard lie ─────
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

  SELECT COALESCE(SUM(dc.xp_earned), 0) INTO v_c
  FROM daily_checkins dc
  WHERE dc.user_id IN (SELECT tm.user_id FROM tribe_members tm WHERE tm.tribe_id = b.challenger_tribe_id AND tm.status = 'active')
    AND dc.checked_in_at >= b.started_at AND dc.checked_in_at < v_end;

  SELECT COALESCE(SUM(dc.xp_earned), 0) INTO v_o
  FROM daily_checkins dc
  WHERE dc.user_id IN (SELECT tm.user_id FROM tribe_members tm WHERE tm.tribe_id = b.opponent_tribe_id AND tm.status = 'active')
    AND dc.checked_in_at >= b.started_at AND dc.checked_in_at < v_end;

  RETURN jsonb_build_object(
    'challenger_score', v_c,
    'opponent_score', v_o,
    'live', true,
    'seconds_left', GREATEST(0, EXTRACT(EPOCH FROM (v_end - now())))::bigint
  );
END $$;
GRANT EXECUTE ON FUNCTION public.tribe_battle_standings(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
