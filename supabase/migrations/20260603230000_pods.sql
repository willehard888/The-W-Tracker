-- ============================================================
-- PODS — small accountability groups (3–5 people) who see each
-- other's DAILY check-in status. The core "a day missed is seen" loop.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pod_members (
  pod_id    uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pod_id, user_id)
);

ALTER TABLE public.pods         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_members  ENABLE ROW LEVEL SECURITY;

-- Membership check (SECURITY DEFINER to avoid RLS recursion).
CREATE OR REPLACE FUNCTION public.is_pod_member(p_pod uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pod_members WHERE pod_id = p_pod AND user_id = auth.uid());
$$;

-- Members read their own pod + co-members. All writes go through RPCs.
DROP POLICY IF EXISTS "members read pod" ON public.pods;
CREATE POLICY "members read pod" ON public.pods
  FOR SELECT TO authenticated USING (public.is_pod_member(id));

DROP POLICY IF EXISTS "members read pod_members" ON public.pod_members;
CREATE POLICY "members read pod_members" ON public.pod_members
  FOR SELECT TO authenticated USING (public.is_pod_member(pod_id));

-- Create a pod — caller becomes owner + first member. One pod per user.
CREATE OR REPLACE FUNCTION public.create_pod(p_name text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_pod uuid; v_code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM pod_members WHERE user_id = uid) THEN RAISE EXCEPTION 'already_in_pod'; END IF;
  v_code := upper(substr(md5(random()::text || uid::text || clock_timestamp()::text), 1, 6));
  INSERT INTO pods (name, owner_id, invite_code)
    VALUES (COALESCE(NULLIF(trim(p_name), ''), 'My Pod'), uid, v_code)
    RETURNING id INTO v_pod;
  INSERT INTO pod_members (pod_id, user_id) VALUES (v_pod, uid);
  RETURN json_build_object('pod_id', v_pod, 'invite_code', v_code);
END; $$;

-- Join a pod by code (max 5 members, one pod per user).
CREATE OR REPLACE FUNCTION public.join_pod(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_pod uuid; v_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM pod_members WHERE user_id = uid) THEN RAISE EXCEPTION 'already_in_pod'; END IF;
  SELECT id INTO v_pod FROM pods WHERE invite_code = upper(trim(p_code));
  IF v_pod IS NULL THEN RAISE EXCEPTION 'pod_not_found'; END IF;
  SELECT count(*) INTO v_count FROM pod_members WHERE pod_id = v_pod;
  IF v_count >= 5 THEN RAISE EXCEPTION 'pod_full'; END IF;
  INSERT INTO pod_members (pod_id, user_id) VALUES (v_pod, uid);
  RETURN json_build_object('pod_id', v_pod);
END; $$;

-- Leave the pod; clean up empty pods.
CREATE OR REPLACE FUNCTION public.leave_pod()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  DELETE FROM pod_members WHERE user_id = uid;
  DELETE FROM pods p WHERE NOT EXISTS (SELECT 1 FROM pod_members m WHERE m.pod_id = p.id);
END; $$;

-- Today's status for the caller's pod: each member + checked-in-today flag,
-- computed in the caller's local day (tz offset from JS getTimezoneOffset()).
CREATE OR REPLACE FUNCTION public.pod_today(p_tz_offset_minutes int DEFAULT 0)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v_pod uuid;
  v_offset interval;
  v_local_today date;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT pod_id INTO v_pod FROM pod_members WHERE user_id = uid LIMIT 1;
  IF v_pod IS NULL THEN RETURN NULL; END IF;
  v_offset := make_interval(mins => COALESCE(p_tz_offset_minutes, 0));
  v_local_today := (now() - v_offset)::date;
  RETURN json_build_object(
    'pod', (SELECT json_build_object('id', id, 'name', name, 'invite_code', invite_code, 'owner_id', owner_id)
            FROM pods WHERE id = v_pod),
    'members', COALESCE((
      SELECT json_agg(m ORDER BY (m->>'username'))
      FROM (
        SELECT json_build_object(
          'user_id', pr.user_id,
          'username', pr.username,
          'avatar_url', pr.avatar_url,
          'status_tier', pr.status_tier,
          'streak', pr.streak,
          'checked_in_today', EXISTS (
            SELECT 1 FROM daily_checkins dc
            WHERE dc.user_id = pr.user_id
              AND (dc.checked_in_at - v_offset)::date = v_local_today
          )
        ) AS m
        FROM pod_members pm
        JOIN profiles pr ON pr.user_id = pm.user_id
        WHERE pm.pod_id = v_pod
      ) s
    ), '[]'::json)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.create_pod(text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_pod(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_pod()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.pod_today(int)          TO authenticated;
