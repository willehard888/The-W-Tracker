-- Lightweight product analytics for the activation funnel.
-- North Star = verified check-ins. Funnel: signup → healthkit_connected → checkin_verified.
-- Clients insert their own events (fail-open); reads happen via service role / SQL editor.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event      text NOT NULL,
  props      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- A user may insert only their own events. No SELECT policy = not readable by
-- clients (analytics is queried with the service role / in the SQL editor).
DROP POLICY IF EXISTS "analytics insert own" ON public.analytics_events;
CREATE POLICY "analytics insert own" ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS analytics_events_event_time_idx
  ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx
  ON public.analytics_events (user_id, created_at DESC);

-- ── Funnel query (run in the SQL editor whenever you want the numbers) ──────────
-- WITH s AS (
--   SELECT user_id, min(created_at) FILTER (WHERE event='signup')              AS signed_up,
--          min(created_at) FILTER (WHERE event='healthkit_connected')          AS connected,
--          min(created_at) FILTER (WHERE event='checkin_verified')             AS verified
--   FROM public.analytics_events GROUP BY user_id
-- )
-- SELECT count(*) FILTER (WHERE signed_up IS NOT NULL)  AS signups,
--        count(*) FILTER (WHERE connected IS NOT NULL)  AS connected_healthkit,
--        count(*) FILTER (WHERE verified  IS NOT NULL)  AS reached_north_star
-- FROM s;
