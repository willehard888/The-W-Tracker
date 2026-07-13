-- ============================================================
-- Close the viral loop — notify the referrer when a friend joins
-- ============================================================
-- claim_referral() creates the referrals row but never tells the referrer.
-- The acknowledgement ("your recruit joined") is what makes people invite
-- again — the mechanic that pushes k-factor toward 1.0. This trigger invokes
-- the notify-referral edge function whenever a referral is created.
--
-- CRITICAL: the whole net.http_post is wrapped in an exception guard. A
-- notification failure (pg_net hiccup, missing Vault secret, edge fn down)
-- must NEVER roll back the referral insert / break signup.
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_notify_referral_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/notify-referral',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'referrer_id', NEW.referrer_id,
        'referred_id', NEW.referred_id,
        'kind', 'joined'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let a notification failure break referral creation / signup.
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referrals_notify_joined ON public.referrals;
CREATE TRIGGER referrals_notify_joined
  AFTER INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_referral_joined();

-- ------------------------------------------------------------
-- Upgrade admin_virality to show the FULL loop now that the join/convert
-- events fire: invite_shared → referral_joined → referral_converted, plus the
-- share→join and join→convert conversion rates that reveal where virality leaks.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_virality(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => p_days);
  invites bigint; sharers bigint; joined bigint; converted bigint;
  referred bigint; active_base bigint;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT count(*), count(DISTINCT user_id) INTO invites, sharers
    FROM analytics_events WHERE event = 'invite_shared' AND created_at >= since;
  SELECT count(*) INTO joined
    FROM analytics_events WHERE event = 'referral_joined' AND created_at >= since;
  SELECT count(*) INTO converted
    FROM analytics_events WHERE event = 'referral_converted' AND created_at >= since;
  SELECT count(*) INTO referred
    FROM profiles WHERE referred_by IS NOT NULL AND created_at >= since;
  SELECT count(DISTINCT user_id) INTO active_base
    FROM daily_checkins WHERE checked_in_at >= since;
  RETURN jsonb_build_object(
    'window_days', p_days,
    'invites_shared', invites,
    'distinct_sharers', sharers,
    'referrals_joined', joined,
    'referrals_converted', converted,
    'referred_signups', referred,
    'total_referred_ever', (SELECT count(*) FROM profiles WHERE referred_by IS NOT NULL),
    -- Where the loop leaks:
    'share_to_join_pct',  round(100.0 * joined    / NULLIF(invites, 0), 1),
    'join_to_convert_pct', round(100.0 * converted / NULLIF(joined, 0), 1),
    -- k-factor ≈ new referred users each active user brought. Sustained >1.0 = viral.
    'k_factor', round(referred::numeric / NULLIF(active_base, 0), 3)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_virality(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_virality(int) TO authenticated;
