-- Round 10 (2026-09-14): two reads that lied.
--
-- 1. upsert_daily_brief stamped CURRENT_DATE (UTC) while coach-daily-brief
--    reads the cache at the device's local day — every European user after
--    their evening missed the cache and paid a Gemini call per mount. The
--    function takes the day it was asked for; the default keeps old callers.
-- 2. admin_funnel counted 8 events; onboarding, the reminder ask, push reach,
--    failed check-ins and trial expiry were written and read by nothing.

DROP FUNCTION IF EXISTS public.upsert_daily_brief(jsonb);

CREATE OR REPLACE FUNCTION public.upsert_daily_brief(_payload jsonb, _brief_date date DEFAULT CURRENT_DATE)
RETURNS public.coach_daily_briefs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.coach_daily_briefs;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  INSERT INTO public.coach_daily_briefs(user_id, brief_date, payload)
  VALUES (_uid, COALESCE(_brief_date, CURRENT_DATE), _payload)
  ON CONFLICT (user_id, brief_date)
  DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_daily_brief(jsonb, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_funnel(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => p_days);
  u_event text; r jsonb := '{}'::jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  -- Distinct users who fired each funnel step in the window.
  FOR u_event IN SELECT unnest(ARRAY[
    'signup','onboarding_viewed','onboarding_done','push_permission',
    'healthkit_connected','checkin_completed','checkin_verified','checkin_failed','streak_milestone',
    'push_sent','push_opened',
    'trial_expired','paywall_viewed','purchase_started','purchase_completed'
  ]) LOOP
    r := r || jsonb_build_object(
      u_event,
      (SELECT count(DISTINCT user_id) FROM analytics_events
       WHERE event = u_event AND created_at >= since)
    );
  END LOOP;
  RETURN jsonb_build_object('window_days', p_days, 'unique_users_by_step', r);
END;
$$;
