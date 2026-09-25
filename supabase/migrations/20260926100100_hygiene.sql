-- Audit round (2026-09-25), batch B — backend hygiene.
--
-- 1. Grants. has_active_access() and the tribe predicates were created
--    without a REVOKE, so Postgres' default EXECUTE TO PUBLIC let the anon key
--    probe any member's access state or tribe membership (the trap the
--    2026-09-19 lockdown header names). Members and the service role keep them.
-- 2. ensure_tribe_challenge() wrote a tribe's weekly row for any caller. A
--    visitor who is not an active member now gets nothing (no error — the
--    tribe page reads the row afterwards and shows no card).
-- 3. Dead features and orphans, with the founder's yes on 2026-09-25: the
--    Pods feature (superseded by tribes), the protocol-habit RPCs behind the
--    retired /coach/habits route, and RPCs with no caller anywhere.
-- 4. update_status_after_checkin fired on the INSERT with xp_earned = 0 —
--    record_checkin and verify_checkin call update_status_tier themselves
--    after score_checkin, so the trigger only doubled the percentile scan.
-- 5. level_for_xp(): one definition of the level, used by both XP writers.
-- 6. profiles: every member can SELECT every column of every profile — held
--    for its own round (see the section).

-- ── 1. Grants ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.has_active_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_access(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_premium(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_tribe_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tribe_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tribe_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_create_tribe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tribe_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tribe_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tribe_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_create_tribe(uuid) TO authenticated, service_role;

-- ── 2. ensure_tribe_challenge: members only ────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_tribe_challenge(p_tribe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week date := date_trunc('week', now())::date;
  v_members int;
  v_done int;
BEGIN
  -- A member of the tribe, or a server-side caller. Anyone else: nothing.
  IF auth.uid() IS NOT NULL AND NOT public.is_tribe_member(p_tribe_id, auth.uid()) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tribes WHERE id = p_tribe_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM tribe_challenges WHERE tribe_id = p_tribe_id AND week_start = v_week) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO v_members FROM tribe_members
  WHERE tribe_id = p_tribe_id AND status = 'active';
  SELECT count(*) INTO v_done
  FROM daily_checkins dc
  JOIN tribe_members tm ON tm.user_id = dc.user_id
  WHERE tm.tribe_id = p_tribe_id
    AND tm.status = 'active'
    AND dc.checked_in_at >= v_week;
  INSERT INTO tribe_challenges (tribe_id, week_start, target, progress)
  VALUES (p_tribe_id, v_week, GREATEST(5, v_members * 5), v_done)
  ON CONFLICT (tribe_id, week_start) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.ensure_tribe_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_tribe_challenge(uuid) TO authenticated, service_role;

-- ── 3. Dead features and orphans ───────────────────────────────────────────
-- Pods (superseded by tribes; no caller in the app since the tribes round).
-- Tables first: their RLS policies reference is_pod_member().
DROP TABLE IF EXISTS public.pod_invites CASCADE;
DROP TABLE IF EXISTS public.pod_members CASCADE;
DROP TABLE IF EXISTS public.pods CASCADE;
DROP FUNCTION IF EXISTS public.create_pod(text) CASCADE;
DROP FUNCTION IF EXISTS public.join_pod(text) CASCADE;
DROP FUNCTION IF EXISTS public.leave_pod() CASCADE;
DROP FUNCTION IF EXISTS public.invite_to_pod(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.accept_pod_invite(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.decline_pod_invite(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.list_pod_invites() CASCADE;
DROP FUNCTION IF EXISTS public.pod_today(integer) CASCADE;
DROP FUNCTION IF EXISTS public.is_pod_member(uuid) CASCADE;
-- The protocol-habit system behind the retired /coach/habits route
-- (log_habit went with XP v3; these were its doors).
DROP TABLE IF EXISTS public.user_habit_logs CASCADE;
DROP TABLE IF EXISTS public.user_habits CASCADE;
DROP FUNCTION IF EXISTS public.add_user_habit(text) CASCADE;
DROP FUNCTION IF EXISTS public.mark_nudge_seen(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.log_preference_signal(text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.complete_coach_mission(uuid, text) CASCADE;
-- No caller anywhere (client, edge functions, cron, other SQL).
DROP FUNCTION IF EXISTS public.revoke_tribe_invite(uuid);
DROP FUNCTION IF EXISTS public.get_rank_score_breakdown(uuid);
DROP FUNCTION IF EXISTS public.get_standings(integer);
DROP FUNCTION IF EXISTS public.join_waitlist(text, text, jsonb);
DROP FUNCTION IF EXISTS public.users_due_for_streak_reminder(integer);

-- ── 4. One tier update per check-in ────────────────────────────────────────
DROP TRIGGER IF EXISTS update_status_after_checkin ON public.daily_checkins;

-- ── 5. level_for_xp ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.level_for_xp(p_xp integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT floor(GREATEST(0, COALESCE(p_xp, 0)) / 500) + 1 $$;
-- score_checkin and record_vault_practice keep their inline floor(xp/500)+1
-- (the client mirror levelForXp() pins the same rule); the function is the
-- reference for the next writer and for audits.

-- ── 6. profiles: held ──────────────────────────────────────────────────────
-- Every member can still SELECT every column of every profile (policy
-- USING (true) from 20260414092928). Tightening it is a column grant plus
-- forty-two client reads (three of them select("*") on the member's own row)
-- routed through a definer RPC — its own round with a full regression walk,
-- not a line in a hygiene batch. Listed in the 2026-09-25 audit report.

NOTIFY pgrst, 'reload schema';
