
-- Enum for tribe battle status
DO $$ BEGIN
  CREATE TYPE public.tribe_battle_status AS ENUM ('pending','active','completed','declined','expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.tribe_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_tribe_id uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  opponent_tribe_id   uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  challenger_owner_id uuid NOT NULL,
  opponent_owner_id   uuid NOT NULL,
  status public.tribe_battle_status NOT NULL DEFAULT 'pending',
  duration_days int NOT NULL DEFAULT 7,
  started_at timestamptz,
  ended_at   timestamptz,
  challenger_score int NOT NULL DEFAULT 0,
  opponent_score   int NOT NULL DEFAULT 0,
  winner_tribe_id  uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (challenger_tribe_id <> opponent_tribe_id),
  CHECK (duration_days IN (3,7,14))
);

CREATE INDEX IF NOT EXISTS tribe_battles_challenger_idx ON public.tribe_battles (challenger_tribe_id, status);
CREATE INDEX IF NOT EXISTS tribe_battles_opponent_idx ON public.tribe_battles (opponent_tribe_id, status);

ALTER TABLE public.tribe_battles ENABLE ROW LEVEL SECURITY;

-- RLS: visibility
DROP POLICY IF EXISTS "Tribe battles visible to participants" ON public.tribe_battles;
CREATE POLICY "Tribe battles visible to participants"
ON public.tribe_battles
FOR SELECT
TO authenticated
USING (
  public.is_tribe_member(challenger_tribe_id, auth.uid())
  OR public.is_tribe_member(opponent_tribe_id, auth.uid())
  OR public.is_tribe_owner(challenger_tribe_id, auth.uid())
  OR public.is_tribe_owner(opponent_tribe_id, auth.uid())
);

DROP POLICY IF EXISTS "No direct tribe battle insert" ON public.tribe_battles;
CREATE POLICY "No direct tribe battle insert"
ON public.tribe_battles FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct tribe battle update" ON public.tribe_battles;
CREATE POLICY "No direct tribe battle update"
ON public.tribe_battles FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "No direct tribe battle delete" ON public.tribe_battles;
CREATE POLICY "No direct tribe battle delete"
ON public.tribe_battles FOR DELETE TO authenticated USING (false);

-- RPC: create
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

  IF v_challenger_owner <> v_user THEN
    RAISE EXCEPTION 'Only the tribe owner can challenge';
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

-- RPC: respond
CREATE OR REPLACE FUNCTION public.respond_to_tribe_battle(
  p_battle_id uuid,
  p_accept boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  b RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO b FROM tribe_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Battle is no longer pending'; END IF;
  IF b.opponent_owner_id <> v_user THEN
    RAISE EXCEPTION 'Only the opponent tribe owner can respond';
  END IF;

  IF p_accept THEN
    UPDATE tribe_battles
    SET status = 'active', started_at = now()
    WHERE id = p_battle_id;
  ELSE
    UPDATE tribe_battles
    SET status = 'declined', ended_at = now()
    WHERE id = p_battle_id;
  END IF;
END;
$$;

-- RPC: resolve (sums xp earned during the battle window, awards winners)
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
BEGIN
  SELECT * INTO b FROM tribe_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status <> 'active' THEN RETURN; END IF;
  IF b.started_at IS NULL THEN RETURN; END IF;

  v_end := b.started_at + (b.duration_days || ' days')::interval;
  IF v_end > now() THEN RETURN; END IF; -- not over yet

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
    v_winner := NULL; -- draw
  END IF;

  UPDATE tribe_battles
  SET status = 'completed',
      ended_at = now(),
      challenger_score = v_challenger_score,
      opponent_score = v_opponent_score,
      winner_tribe_id = v_winner
  WHERE id = p_battle_id;

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

-- RPC: auto-resolve any expired battles (called on view)
CREATE OR REPLACE FUNCTION public.auto_resolve_expired_tribe_battles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM tribe_battles
    WHERE status = 'active'
      AND started_at IS NOT NULL
      AND (started_at + (duration_days || ' days')::interval) <= now()
  LOOP
    PERFORM public.resolve_tribe_battle(r.id);
  END LOOP;
END;
$$;
