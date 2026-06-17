-- Tribe events / meetups — the Sweatpals-style core: a tribe schedules a
-- workout/meetup, members RSVP and show up. Place is free text (no GPS).
-- Idempotent / safe to re-run.

CREATE TABLE IF NOT EXISTS public.tribe_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id     uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  host_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  activity     text,                       -- running | gym | yoga | …
  description  text,
  place        text,                       -- free-text location
  starts_at    timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  capacity     int,                         -- null = unlimited
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tribe_events_tribe_idx ON public.tribe_events (tribe_id, starts_at);

CREATE TABLE IF NOT EXISTS public.tribe_event_rsvps (
  event_id   uuid NOT NULL REFERENCES public.tribe_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.tribe_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tribe_event_rsvps ENABLE ROW LEVEL SECURITY;

-- Visible if the tribe is public or the viewer is a member. Writes go through
-- SECURITY DEFINER RPCs only.
DROP POLICY IF EXISTS "read tribe events" ON public.tribe_events;
CREATE POLICY "read tribe events" ON public.tribe_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tribes t WHERE t.id = tribe_id AND t.visibility = 'public')
    OR public.is_tribe_member(tribe_id, auth.uid())
  );

DROP POLICY IF EXISTS "read tribe event rsvps" ON public.tribe_event_rsvps;
CREATE POLICY "read tribe event rsvps" ON public.tribe_event_rsvps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tribe_events e
      JOIN public.tribes t ON t.id = e.tribe_id
      WHERE e.id = event_id
        AND (t.visibility = 'public' OR public.is_tribe_member(e.tribe_id, auth.uid()))
    )
  );

-- Create an event — caller must be an active member of the tribe. Host auto-RSVPs.
CREATE OR REPLACE FUNCTION public.create_tribe_event(
  p_tribe uuid, p_title text, p_activity text, p_description text,
  p_place text, p_starts_at timestamptz, p_duration_min int, p_capacity int
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe AND user_id = uid AND status = 'active') THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF length(trim(coalesce(p_title,''))) < 2 THEN RAISE EXCEPTION 'title_required'; END IF;
  INSERT INTO tribe_events (tribe_id, host_id, title, activity, description, place, starts_at, duration_min, capacity)
    VALUES (p_tribe, uid, trim(p_title), NULLIF(trim(coalesce(p_activity,'')),''), NULLIF(trim(coalesce(p_description,'')),''),
            NULLIF(trim(coalesce(p_place,'')),''), p_starts_at, COALESCE(p_duration_min, 60),
            CASE WHEN p_capacity IS NULL OR p_capacity <= 0 THEN NULL ELSE p_capacity END)
    RETURNING id INTO v_id;
  INSERT INTO tribe_event_rsvps (event_id, user_id, status) VALUES (v_id, uid, 'going')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  RETURN v_id;
END; $$;

-- RSVP — caller must be a member of the event's tribe. Capacity enforced for 'going'.
CREATE OR REPLACE FUNCTION public.rsvp_tribe_event(p_event uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_tribe uuid; v_cap int; v_going int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_status NOT IN ('going','maybe','declined') THEN RAISE EXCEPTION 'bad_status'; END IF;
  SELECT tribe_id, capacity INTO v_tribe, v_cap FROM tribe_events WHERE id = p_event;
  IF v_tribe IS NULL THEN RAISE EXCEPTION 'no_event'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = v_tribe AND user_id = uid AND status = 'active') THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF p_status = 'going' AND v_cap IS NOT NULL THEN
    SELECT count(*) INTO v_going FROM tribe_event_rsvps
      WHERE event_id = p_event AND status = 'going' AND user_id <> uid;
    IF v_going >= v_cap THEN RAISE EXCEPTION 'event_full'; END IF;
  END IF;
  INSERT INTO tribe_event_rsvps (event_id, user_id, status) VALUES (p_event, uid, p_status)
    ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status, created_at = now();
END; $$;

-- Host or tribe owner can delete an event.
CREATE OR REPLACE FUNCTION public.delete_tribe_event(p_event uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_host uuid; v_tribe uuid;
BEGIN
  SELECT host_id, tribe_id INTO v_host, v_tribe FROM tribe_events WHERE id = p_event;
  IF v_tribe IS NULL THEN RETURN; END IF;
  IF uid <> v_host AND NOT public.is_tribe_owner(v_tribe, uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM tribe_events WHERE id = p_event;
END; $$;

-- Upcoming events for a tribe, with going count, the caller's status, host name.
CREATE OR REPLACE FUNCTION public.list_tribe_events(p_tribe uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.starts_at), '[]'::json)
  FROM (
    SELECT e.id, e.title, e.activity, e.description, e.place, e.starts_at,
           e.duration_min, e.capacity, e.host_id,
           pr.username AS host_username,
           (SELECT count(*) FROM tribe_event_rsvps r WHERE r.event_id = e.id AND r.status = 'going')::int AS going_count,
           (SELECT r2.status FROM tribe_event_rsvps r2 WHERE r2.event_id = e.id AND r2.user_id = auth.uid()) AS my_status
    FROM tribe_events e
    LEFT JOIN profiles pr ON pr.user_id = e.host_id
    WHERE e.tribe_id = p_tribe
      AND e.starts_at >= now() - interval '3 hours'
    ORDER BY e.starts_at
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.create_tribe_event(uuid,text,text,text,text,timestamptz,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rsvp_tribe_event(uuid,text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tribe_event(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tribe_events(uuid)      TO authenticated;
