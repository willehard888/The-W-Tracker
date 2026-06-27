-- Referral close-loop + friend discovery.
--  • list_my_referrals()   — recent recruits feed for the Referrals page
--  • people_you_may_know()  — friend suggestions from shared tribes
-- Both SECURITY DEFINER + scoped to auth.uid(). Idempotent.

-- Recent recruits (who joined with my code, converted or not) — newest first.
CREATE OR REPLACE FUNCTION public.list_my_referrals(p_limit int DEFAULT 20)
RETURNS TABLE (
  referred_username text,
  avatar_url text,
  converted boolean,
  created_at timestamptz,
  converted_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT p.username, p.avatar_url, r.converted, r.created_at, r.converted_at
  FROM referrals r
  JOIN profiles p ON p.user_id = r.referred_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.list_my_referrals(int) TO authenticated;

-- People you may know — active members of my tribes I'm not already
-- friends/pending with, ranked by number of shared tribes.
CREATE OR REPLACE FUNCTION public.people_you_may_know(p_limit int DEFAULT 12)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  status_tier status_tier,
  level int,
  mutual_tribes int
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH my_tribes AS (
    SELECT tribe_id FROM tribe_members
    WHERE user_id = auth.uid() AND status = 'active'
  ),
  candidates AS (
    SELECT tm.user_id, count(*)::int AS mutual_tribes
    FROM tribe_members tm
    WHERE tm.tribe_id IN (SELECT tribe_id FROM my_tribes)
      AND tm.status = 'active'
      AND tm.user_id <> auth.uid()
    GROUP BY tm.user_id
  )
  SELECT p.user_id, p.username, p.avatar_url, p.status_tier, p.level, c.mutual_tribes
  FROM candidates c
  JOIN profiles p ON p.user_id = c.user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM friendships f
    WHERE (f.requester_id = auth.uid() AND f.addressee_id = c.user_id)
       OR (f.addressee_id = auth.uid() AND f.requester_id = c.user_id)
  )
  ORDER BY c.mutual_tribes DESC, p.level DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;
GRANT EXECUTE ON FUNCTION public.people_you_may_know(int) TO authenticated;
