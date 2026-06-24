-- Multi-session series: one parent "series" (a course / workshop run / program)
-- with N child sessions. Each session is a normal tribe_events row, so RSVP /
-- list / delete all keep working untouched; the rows just link back to the
-- series for grouped display. Fully idempotent.

-- Safety: ensure meeting_url exists even if the earlier meetup migration hasn't
-- run yet, so list_tribe_events below never references a missing column.
ALTER TABLE public.tribe_events ADD COLUMN IF NOT EXISTS meeting_url text;

CREATE TABLE IF NOT EXISTS public.tribe_event_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribe_id uuid NOT NULL REFERENCES public.tribes(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  title text NOT NULL,
  activity text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tribe_events
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.tribe_event_series(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_index int;

CREATE INDEX IF NOT EXISTS idx_tribe_events_series ON public.tribe_events(series_id);

-- Series metadata isn't sensitive (title/activity); it's only ever written via
-- the SECURITY DEFINER RPCs below. Permissive read so any client join works.
ALTER TABLE public.tribe_event_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tribe_event_series readable" ON public.tribe_event_series;
CREATE POLICY "tribe_event_series readable" ON public.tribe_event_series
  FOR SELECT USING (true);

-- Create a series + all its sessions in one transaction.
-- p_sessions is a JSON array: [{ starts_at, duration_min, place, meeting_url, title }]
CREATE OR REPLACE FUNCTION public.create_tribe_event_series(
  p_tribe uuid,
  p_title text,
  p_activity text,
  p_description text,
  p_sessions jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v_series uuid;
  v_session jsonb;
  v_idx int := 0;
  v_count int;
  v_eid uuid;
  v_link text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe AND user_id = uid AND status = 'active') THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF length(trim(coalesce(p_title,''))) < 2 THEN RAISE EXCEPTION 'title_required'; END IF;

  v_count := jsonb_array_length(coalesce(p_sessions, '[]'::jsonb));
  IF v_count < 1 THEN RAISE EXCEPTION 'sessions_required'; END IF;
  IF v_count > 24 THEN RAISE EXCEPTION 'too_many_sessions'; END IF;

  INSERT INTO tribe_event_series (tribe_id, host_id, title, activity, description)
    VALUES (p_tribe, uid, trim(p_title),
            NULLIF(trim(coalesce(p_activity,'')),''),
            NULLIF(trim(coalesce(p_description,'')),''))
    RETURNING id INTO v_series;

  FOR v_session IN SELECT * FROM jsonb_array_elements(p_sessions)
  LOOP
    v_idx := v_idx + 1;
    v_link := NULLIF(trim(coalesce(v_session->>'meeting_url','')),'');
    IF v_link IS NOT NULL AND v_link !~* '^https?://' THEN v_link := NULL; END IF;

    INSERT INTO tribe_events (
      tribe_id, host_id, title, activity, description, place, starts_at,
      duration_min, capacity, meeting_url, series_id, session_index
    ) VALUES (
      p_tribe, uid,
      COALESCE(NULLIF(trim(coalesce(v_session->>'title','')),''),
               trim(p_title) || ' · Session ' || v_idx),
      NULLIF(trim(coalesce(p_activity,'')),''),
      NULLIF(trim(coalesce(p_description,'')),''),
      NULLIF(trim(coalesce(v_session->>'place','')),''),
      (v_session->>'starts_at')::timestamptz,
      COALESCE((v_session->>'duration_min')::int, 60),
      NULL,
      v_link,
      v_series,
      v_idx
    ) RETURNING id INTO v_eid;

    INSERT INTO tribe_event_rsvps (event_id, user_id, status)
      VALUES (v_eid, uid, 'going') ON CONFLICT (event_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_series;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_tribe_event_series(uuid,text,text,text,jsonb) TO authenticated;

-- Delete a whole series (host or tribe owner). Cascades to all its sessions.
CREATE OR REPLACE FUNCTION public.delete_tribe_event_series(p_series uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_host uuid; v_tribe uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT host_id, tribe_id INTO v_host, v_tribe FROM tribe_event_series WHERE id = p_series;
  IF v_host IS NULL THEN RETURN; END IF;
  IF uid <> v_host AND NOT EXISTS (SELECT 1 FROM tribes WHERE id = v_tribe AND owner_id = uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM tribe_event_series WHERE id = p_series; -- cascades to sessions
END; $$;

GRANT EXECUTE ON FUNCTION public.delete_tribe_event_series(uuid) TO authenticated;

-- list_tribe_events now also returns series_id / session_index / series_title
-- so the client can group a course's sessions under one card.
CREATE OR REPLACE FUNCTION public.list_tribe_events(p_tribe uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.starts_at), '[]'::json)
  FROM (
    SELECT e.id, e.title, e.activity, e.description, e.place, e.meeting_url, e.starts_at,
           e.duration_min, e.capacity, e.host_id, e.series_id, e.session_index,
           s.title AS series_title,
           pr.username AS host_username,
           (SELECT count(*) FROM tribe_event_rsvps r WHERE r.event_id = e.id AND r.status = 'going')::int AS going_count,
           (SELECT r2.status FROM tribe_event_rsvps r2 WHERE r2.event_id = e.id AND r2.user_id = auth.uid()) AS my_status
    FROM tribe_events e
    LEFT JOIN tribe_event_series s ON s.id = e.series_id
    LEFT JOIN profiles pr ON pr.user_id = e.host_id
    WHERE e.tribe_id = p_tribe
      AND e.starts_at >= now() - interval '3 hours'
    ORDER BY e.starts_at
  ) t;
$$;
