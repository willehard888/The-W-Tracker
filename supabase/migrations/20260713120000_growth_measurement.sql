-- ============================================================
-- Growth measurement layer — turn the retention/growth engine ON + MEASURABLE
-- ============================================================
-- We collect events (analytics_events), check-ins, referrals and last_active_at,
-- but nothing READS them into the numbers that tell us if the loop is addictive
-- and viral. These admin-only functions expose the four dashboards that matter:
--   1. admin_metrics_overview()   — headline KPIs (DAU/WAU/MAU, streaks, paid)
--   2. admin_retention_cohorts()  — D1/D7/D30 return-rate by signup week
--   3. admin_funnel()             — activation + monetization funnel conversion
--   4. admin_virality()           — invites, referred signups, k-factor
-- All gated on has_role(admin); run them from the SQL editor or an admin screen.
-- ============================================================

-- 1. Headline KPIs ------------------------------------------------------------
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
    -- Activity = the core action (a check-in). Retroactive + meaningful.
    'dau',            (SELECT count(DISTINCT user_id) FROM daily_checkins WHERE checked_in_at >= now() - interval '1 day'),
    'wau',            (SELECT count(DISTINCT user_id) FROM daily_checkins WHERE checked_in_at >= now() - interval '7 days'),
    'mau',            (SELECT count(DISTINCT user_id) FROM daily_checkins WHERE checked_in_at >= now() - interval '30 days'),
    'checkins_today', (SELECT count(*) FROM daily_checkins WHERE checked_in_at >= current_date),
    'active_streaks', (SELECT count(*) FROM profiles WHERE streak > 0),
    'avg_active_streak', (SELECT round(avg(streak), 1) FROM profiles WHERE streak > 0),
    'longest_streak', (SELECT max(streak) FROM profiles),
    'paid_members',   (SELECT count(*) FROM profiles WHERE COALESCE(is_premium, false) OR COALESCE(is_elite, false)),
    'referred_users', (SELECT count(*) FROM profiles WHERE referred_by IS NOT NULL)
  ) INTO r;
  -- Stickiness: DAU/MAU (>0.2 is good, >0.5 is elite for a daily app).
  RETURN r || jsonb_build_object(
    'stickiness_dau_mau',
    round( (r->>'dau')::numeric / NULLIF((r->>'mau')::numeric, 0), 3)
  );
END;
$$;

-- 2. Retention cohorts (D1/D7/D30 return-to-check-in by signup week) ----------
CREATE OR REPLACE FUNCTION public.admin_retention_cohorts(p_weeks int DEFAULT 8)
RETURNS TABLE(cohort_week date, cohort_size bigint, d1_pct numeric, d7_pct numeric, d30_pct numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  WITH cohorts AS (
    SELECT p.user_id,
           date_trunc('week', p.created_at)::date AS wk,
           p.created_at::date AS signup_day
    FROM profiles p
    WHERE p.created_at >= current_date - (p_weeks * 7)
  ),
  ret AS (
    SELECT c.wk, c.user_id,
      bool_or(d.checked_in_at::date =  c.signup_day + 1)                       AS d1,
      bool_or(d.checked_in_at::date BETWEEN c.signup_day + 5  AND c.signup_day + 9)  AS d7,
      bool_or(d.checked_in_at::date BETWEEN c.signup_day + 25 AND c.signup_day + 35) AS d30
    FROM cohorts c
    LEFT JOIN daily_checkins d ON d.user_id = c.user_id
    GROUP BY c.wk, c.user_id
  )
  SELECT wk,
    count(*),
    round(100.0 * count(*) FILTER (WHERE d1)  / NULLIF(count(*), 0), 1),
    round(100.0 * count(*) FILTER (WHERE d7)  / NULLIF(count(*), 0), 1),
    round(100.0 * count(*) FILTER (WHERE d30) / NULLIF(count(*), 0), 1)
  FROM ret
  GROUP BY wk
  ORDER BY wk DESC;
END;
$$;

-- 3. Funnels (activation + monetization) from analytics_events ----------------
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
    'signup','healthkit_connected','checkin_completed','checkin_verified','streak_milestone',
    'paywall_viewed','purchase_started','purchase_completed'
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

-- 4. Virality (invites → referred signups → k-factor) -------------------------
CREATE OR REPLACE FUNCTION public.admin_virality(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => p_days);
  invites bigint; sharers bigint; referred bigint; active_base bigint;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT count(*), count(DISTINCT user_id) INTO invites, sharers
    FROM analytics_events WHERE event = 'invite_shared' AND created_at >= since;
  SELECT count(*) INTO referred
    FROM profiles WHERE referred_by IS NOT NULL AND created_at >= since;
  SELECT count(DISTINCT user_id) INTO active_base
    FROM daily_checkins WHERE checked_in_at >= since;
  RETURN jsonb_build_object(
    'window_days', p_days,
    'invites_shared', invites,
    'distinct_sharers', sharers,
    'referred_signups', referred,
    'total_referred_ever', (SELECT count(*) FROM profiles WHERE referred_by IS NOT NULL),
    -- k-factor ≈ new referred users each active user brought in the window.
    -- Sustained > 1.0 = viral growth.
    'k_factor', round(referred::numeric / NULLIF(active_base, 0), 3)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_metrics_overview()           FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_retention_cohorts(int)       FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_funnel(int)                  FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_virality(int)                FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_metrics_overview()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retention_cohorts(int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_funnel(int)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_virality(int)             TO authenticated;
