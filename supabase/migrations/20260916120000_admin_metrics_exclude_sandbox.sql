-- ============================================================
-- admin_metrics_overview: purchases count money, never the sandbox.
-- Sandbox purchases now reach the ledger for tester accounts (the
-- revenuecat-webhook admin rule) and carry props.environment = 'SANDBOX'
-- from the webhook, props.sandbox = true from the client. Same function
-- body as 20260810151508 otherwise.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_metrics_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT jsonb_build_object(
    'total_users',    (SELECT count(*) FROM profiles),
    'new_today',      (SELECT count(*) FROM profiles WHERE created_at >= current_date),
    'new_7d',         (SELECT count(*) FROM profiles WHERE created_at >= current_date - 6),
    'dau',            (SELECT count(DISTINCT user_id) FROM daily_checkins WHERE checked_in_at >= now() - interval '1 day'),
    'wau',            (SELECT count(DISTINCT user_id) FROM daily_checkins WHERE checked_in_at >= now() - interval '7 days'),
    'mau',            (SELECT count(DISTINCT user_id) FROM daily_checkins WHERE checked_in_at >= now() - interval '30 days'),
    'checkins_today', (SELECT count(*) FROM daily_checkins WHERE checked_in_at >= current_date),
    'active_streaks', (SELECT count(*) FROM profiles WHERE streak > 0),
    'avg_active_streak', (SELECT round(avg(streak), 1) FROM profiles WHERE streak > 0),
    'longest_streak', (SELECT max(streak) FROM profiles),
    'paid_members',   (SELECT count(*) FROM profiles WHERE COALESCE(is_premium, false) OR COALESCE(is_elite, false)),
    'referred_users', (SELECT count(*) FROM profiles WHERE referred_by IS NOT NULL),
    'purchases_30d',        (SELECT count(*) FROM analytics_events
                               WHERE event = 'purchase_completed'
                                 AND created_at >= now() - interval '30 days'
                                 AND COALESCE(props->>'environment', 'PRODUCTION') = 'PRODUCTION'
                                 AND COALESCE(props->>'sandbox', 'false') <> 'true'),
    'trials_started_30d',   (SELECT count(*) FROM analytics_events WHERE event = 'trial_started'           AND created_at >= now() - interval '30 days'),
    'trials_expired_30d',   (SELECT count(*) FROM analytics_events WHERE event = 'trial_expired'           AND created_at >= now() - interval '30 days'),
    'cancellations_30d',    (SELECT count(*) FROM analytics_events WHERE event = 'subscription_cancelled'  AND created_at >= now() - interval '30 days'),
    'payment_failures_30d', (SELECT count(*) FROM analytics_events WHERE event = 'payment_failed'          AND created_at >= now() - interval '30 days')
  ) INTO r;
  RETURN r || jsonb_build_object(
    'stickiness_dau_mau',
    round( (r->>'dau')::numeric / NULLIF((r->>'mau')::numeric, 0), 3),
    'trial_conversion_30d',
    round( (r->>'purchases_30d')::numeric
         / NULLIF((r->>'trials_expired_30d')::numeric + (r->>'purchases_30d')::numeric, 0), 3),
    'cancel_rate_30d',
    round( (r->>'cancellations_30d')::numeric / NULLIF((r->>'paid_members')::numeric, 0), 3)
  );
END;
$$;
