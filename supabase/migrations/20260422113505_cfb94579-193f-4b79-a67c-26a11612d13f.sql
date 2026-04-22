UPDATE profiles 
SET is_apex_subscriber = true, 
    apex_subscription_started_at = COALESCE(apex_subscription_started_at, now())
WHERE status_tier = 'legend' AND is_apex_subscriber = false;