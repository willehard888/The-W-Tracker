-- ============================================================
-- Tribe core fixes — repairs the broken mechanics found in the
-- billion-tier tribe audit (E1 of 4):
--   1. role CHECK never allowed 'admin' → set_tribe_member_role raised
--   2. resolve_tribe_battle: no idempotency lock (double +50 XP) and
--      callable by any authenticated user
--   3. tribe battles resolved only when a client happened to open the
--      page → server cron every 30 min
--   4. join_tribe skipped member_cap for private tribes
--   5. dead Apex-pause subsystem still ran 2 UPDATE scans on EVERY
--      profile update → dropped entirely
--   6. tribe_event_series RLS was USING(true) → member/public scope
--   7. tribe feed tables were never added to supabase_realtime →
--      the live feed channel was silently dead
--   8. founder decisions: any active member can start a battle;
--      kudos open to every member (2/month, now enforced server-side)
-- ============================================================

-- 1 ─ role CHECK: allow 'admin' (set_tribe_member_role already writes it)
ALTER TABLE public.tribe_members DROP CONSTRAINT IF EXISTS tribe_members_role_check;
ALTER TABLE public.tribe_members
  ADD CONSTRAINT tribe_members_role_check CHECK (role IN ('owner','admin','member'));

-- 2 ─ resolve_tribe_battle: compare-and-swap before awarding XP
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

  SELECT COALESCE(SUM(dc.xp_earned), 0) INTO v_challenger_score
  FROM daily_checkins dc
  WHERE dc.user_id IN (
    SELECT user_id FROM tribe_members
    WHERE tribe_id = b.challenger_tribe_id AND status = 'active'
  )
  AND dc.checked_in_at >= b.started_at
  AND dc.checked_in_at <  v_end;

  SELECT COALESCE(SUM(dc.xp_earned), 0) INTO v_opponent_score
  FROM daily_checkins dc
  WHERE dc.user_id IN (
    SELECT user_id FROM tribe_members
    WHERE tribe_id = b.opponent_tribe_id AND status = 'active'
  )
  AND dc.checked_in_at >= b.started_at
  AND dc.checked_in_at <  v_end;

  IF v_challenger_score > v_opponent_score THEN
    v_winner := b.challenger_tribe_id;
  ELSIF v_opponent_score > v_challenger_score THEN
    v_winner := b.opponent_tribe_id;
  ELSE
    v_winner := NULL;
  END IF;

  -- CAS: only the transaction that flips active→completed awards XP.
  UPDATE tribe_battles
  SET status = 'completed',
      ended_at = now(),
      challenger_score = v_challenger_score,
      opponent_score = v_opponent_score,
      winner_tribe_id = v_winner
  WHERE id = p_battle_id AND status = 'active';
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN RETURN; END IF; -- someone else resolved it

  IF v_winner IS NOT NULL THEN
    UPDATE profiles
    SET xp = xp + 50, updated_at = now()
    WHERE user_id IN (
      SELECT user_id FROM tribe_members
      WHERE tribe_id = v_winner AND status = 'active'
    );
  END IF;
END;
$$;

-- Direct resolve is internal-only; clients go through auto_resolve.
REVOKE ALL ON FUNCTION public.resolve_tribe_battle(uuid) FROM PUBLIC, anon, authenticated;

-- 3 ─ server-side battle resolution every 30 min (no more client roulette)
DO $$ BEGIN PERFORM cron.unschedule('tribe-battles-resolve');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('tribe-battles-resolve', '*/30 * * * *',
    'SELECT public.auto_resolve_expired_tribe_battles()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — schedule tribe-battles-resolve manually';
END $$;

-- 4 ─ join_tribe: member_cap applies to private tribes too
CREATE OR REPLACE FUNCTION public.join_tribe(p_tribe_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_visibility text; v_status text; v_count integer; v_cap_tribe integer;
  v_active_memberships integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT visibility, member_count, member_cap INTO v_visibility, v_count, v_cap_tribe
  FROM tribes WHERE id = p_tribe_id;
  IF v_visibility IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;

  IF EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe_id AND user_id = v_user) THEN
    RETURN 'already_member';
  END IF;

  IF v_count >= COALESCE(v_cap_tribe, 100) THEN
    RAISE EXCEPTION 'This club is full';
  END IF;

  SELECT count(*) INTO v_active_memberships
  FROM tribe_members WHERE user_id = v_user AND status = 'active';
  IF v_active_memberships >= 25 THEN
    RAISE EXCEPTION 'You can be in up to 25 clubs — leave one first';
  END IF;

  v_status := CASE WHEN v_visibility = 'public' THEN 'active' ELSE 'pending' END;
  INSERT INTO tribe_members (tribe_id, user_id, role, status)
  VALUES (p_tribe_id, v_user, 'member', v_status);
  IF v_status = 'active' THEN
    UPDATE tribes SET member_count = member_count + 1 WHERE id = p_tribe_id;
  END IF;
  RETURN v_status;
END;
$function$;

-- 5 ─ dead pause subsystem: neutered by open_tribes_to_all, but the trigger
-- still ran two tribes-table UPDATEs on every single profile update.
DROP TRIGGER IF EXISTS profiles_reconcile_tribe_pause ON public.profiles;
DROP FUNCTION IF EXISTS public.trg_reconcile_owned_tribes_pause();
DROP FUNCTION IF EXISTS public.sync_tribe_pause_state();
DROP FUNCTION IF EXISTS public.claim_paused_tribe(uuid);
DROP FUNCTION IF EXISTS public.is_valid_tribe_owner(uuid);

-- 6 ─ event series metadata: same visibility scope as the tribe itself
DROP POLICY IF EXISTS "tribe_event_series readable" ON public.tribe_event_series;
CREATE POLICY "tribe_event_series readable" ON public.tribe_event_series
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tribes t
      WHERE t.id = tribe_event_series.tribe_id
        AND (t.visibility = 'public' OR public.is_tribe_member(t.id, auth.uid()))
    )
  );

-- 7 ─ realtime publication: the tribe feed channel subscribed to tables that
-- were never published (same bug class as the coach tables, 20260810144606).
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tribe_posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tribe_post_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tribe_post_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tribe_post_kudos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8a ─ any active member can start a battle (opponent owner still accepts)
CREATE OR REPLACE FUNCTION public.create_tribe_battle(
  p_challenger_tribe_id uuid,
  p_opponent_tribe_id uuid,
  p_duration_days int DEFAULT 7
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_challenger_owner uuid;
  v_opponent_owner uuid;
  v_challenger_members int;
  v_opponent_members int;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_challenger_tribe_id = p_opponent_tribe_id THEN
    RAISE EXCEPTION 'Cannot challenge your own tribe';
  END IF;
  IF p_duration_days NOT IN (3,7,14) THEN
    RAISE EXCEPTION 'Duration must be 3, 7 or 14 days';
  END IF;

  SELECT owner_id INTO v_challenger_owner FROM tribes WHERE id = p_challenger_tribe_id;
  SELECT owner_id INTO v_opponent_owner FROM tribes WHERE id = p_opponent_tribe_id;

  IF v_challenger_owner IS NULL OR v_opponent_owner IS NULL THEN
    RAISE EXCEPTION 'Tribe not found';
  END IF;

  -- Founder decision: any active member may raise the challenge — the old
  -- owner-only gate left every other member staring at empty battle tabs.
  IF NOT public.is_tribe_member(p_challenger_tribe_id, v_user) THEN
    RAISE EXCEPTION 'Only tribe members can challenge';
  END IF;

  SELECT count(*) INTO v_challenger_members FROM tribe_members
    WHERE tribe_id = p_challenger_tribe_id AND status = 'active';
  SELECT count(*) INTO v_opponent_members FROM tribe_members
    WHERE tribe_id = p_opponent_tribe_id AND status = 'active';

  IF v_challenger_members < 2 OR v_opponent_members < 2 THEN
    RAISE EXCEPTION 'Both tribes need at least 2 active members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tribe_battles
    WHERE status IN ('pending','active')
      AND (
        (challenger_tribe_id = p_challenger_tribe_id AND opponent_tribe_id = p_opponent_tribe_id)
        OR (challenger_tribe_id = p_opponent_tribe_id AND opponent_tribe_id = p_challenger_tribe_id)
      )
  ) THEN
    RAISE EXCEPTION 'There is already an active or pending battle between these tribes';
  END IF;

  INSERT INTO tribe_battles (
    challenger_tribe_id, opponent_tribe_id,
    challenger_owner_id, opponent_owner_id,
    duration_days, status
  ) VALUES (
    p_challenger_tribe_id, p_opponent_tribe_id,
    v_challenger_owner, v_opponent_owner,
    p_duration_days, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 8b ─ kudos open to every active member, 2/month enforced in the policy
-- (the cap previously lived only in client state).
DROP POLICY IF EXISTS "Apex tribe members can give kudos" ON public.tribe_post_kudos;
CREATE POLICY "Tribe members can give kudos (2 per month)"
ON public.tribe_post_kudos FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = giver_id
  AND giver_id <> receiver_id
  AND EXISTS (
    SELECT 1 FROM public.tribe_posts p
    WHERE p.id = tribe_post_kudos.post_id
      AND public.is_tribe_member(p.tribe_id, auth.uid())
      AND p.user_id = tribe_post_kudos.receiver_id
  )
  AND (
    SELECT count(*) FROM public.tribe_post_kudos k
    WHERE k.giver_id = auth.uid()
      AND k.created_at >= date_trunc('month', now())
  ) < 2
);

NOTIFY pgrst, 'reload schema';
