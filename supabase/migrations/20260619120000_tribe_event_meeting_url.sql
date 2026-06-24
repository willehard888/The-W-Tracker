-- Remote meetups: an event can be online (Google Meet / Teams / Zoom link).
-- Adds tribe_events.meeting_url + threads it through create/list RPCs. Idempotent.

ALTER TABLE public.tribe_events ADD COLUMN IF NOT EXISTS meeting_url text;

-- create_tribe_event gains p_meeting_url. Drop the old 8-arg signature so there's
-- no ambiguous overload, then recreate with the link param.
DROP FUNCTION IF EXISTS public.create_tribe_event(uuid,text,text,text,text,timestamptz,int,int);

CREATE OR REPLACE FUNCTION public.create_tribe_event(
  p_tribe uuid, p_title text, p_activity text, p_description text,
  p_place text, p_starts_at timestamptz, p_duration_min int, p_capacity int,
  p_meeting_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_id uuid; v_link text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tribe_members WHERE tribe_id = p_tribe AND user_id = uid AND status = 'active') THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  IF length(trim(coalesce(p_title,''))) < 2 THEN RAISE EXCEPTION 'title_required'; END IF;

  v_link := NULLIF(trim(coalesce(p_meeting_url,'')),'');
  -- Only accept real http(s) links; ignore anything else.
  IF v_link IS NOT NULL AND v_link !~* '^https?://' THEN v_link := NULL; END IF;

  INSERT INTO tribe_events (tribe_id, host_id, title, activity, description, place, starts_at, duration_min, capacity, meeting_url)
    VALUES (p_tribe, uid, trim(p_title), NULLIF(trim(coalesce(p_activity,'')),''), NULLIF(trim(coalesce(p_description,'')),''),
            NULLIF(trim(coalesce(p_place,'')),''), p_starts_at, COALESCE(p_duration_min, 60),
            CASE WHEN p_capacity IS NULL OR p_capacity <= 0 THEN NULL ELSE p_capacity END, v_link)
    RETURNING id INTO v_id;
  INSERT INTO tribe_event_rsvps (event_id, user_id, status) VALUES (v_id, uid, 'going')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  RETURN v_id;
END; $$;

-- list_tribe_events now returns meeting_url.
CREATE OR REPLACE FUNCTION public.list_tribe_events(p_tribe uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.starts_at), '[]'::json)
  FROM (
    SELECT e.id, e.title, e.activity, e.description, e.place, e.meeting_url, e.starts_at,
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

GRANT EXECUTE ON FUNCTION public.create_tribe_event(uuid,text,text,text,text,timestamptz,int,int,text) TO authenticated;
