-- Leaderboard: returns ranked public tribes (+viewer's own private tribes always)
CREATE OR REPLACE FUNCTION public.get_tribe_leaderboard(p_period text DEFAULT 'weekly', p_limit int DEFAULT 50)
RETURNS TABLE (
  tribe_id uuid,
  name text,
  slug text,
  cover_url text,
  visibility text,
  member_count int,
  score bigint,
  rank int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF p_period NOT IN ('weekly','all_time') THEN
    RAISE EXCEPTION 'Invalid period';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT t.id, t.name, t.slug, t.cover_url, t.visibility, t.member_count
    FROM tribes t
    WHERE t.visibility = 'public'
       OR (v_user IS NOT NULL AND (
            t.owner_id = v_user
            OR EXISTS (
              SELECT 1 FROM tribe_members tm
              WHERE tm.tribe_id = t.id AND tm.user_id = v_user AND tm.status = 'active'
            )
          ))
  ),
  scored AS (
    SELECT
      e.id,
      e.name,
      e.slug,
      e.cover_url,
      e.visibility,
      e.member_count,
      CASE
        WHEN p_period = 'weekly' THEN COALESCE((
          SELECT SUM(dc.xp_earned)::bigint
          FROM daily_checkins dc
          WHERE dc.user_id IN (
            SELECT tm.user_id FROM tribe_members tm
            WHERE tm.tribe_id = e.id AND tm.status = 'active'
          )
          AND dc.checked_in_at >= now() - interval '7 days'
        ), 0)
        ELSE COALESCE((
          SELECT SUM(p.xp)::bigint
          FROM profiles p
          WHERE p.user_id IN (
            SELECT tm.user_id FROM tribe_members tm
            WHERE tm.tribe_id = e.id AND tm.status = 'active'
          )
        ), 0)
      END AS score
    FROM eligible e
  )
  SELECT
    s.id AS tribe_id,
    s.name,
    s.slug,
    s.cover_url,
    s.visibility,
    s.member_count,
    s.score,
    (ROW_NUMBER() OVER (ORDER BY s.score DESC, s.member_count DESC, s.name ASC))::int AS rank
  FROM scored s
  ORDER BY s.score DESC, s.member_count DESC, s.name ASC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

-- Search: finds public AND private tribes by name with viewer_status
CREATE OR REPLACE FUNCTION public.search_tribes(p_query text, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  cover_url text,
  visibility text,
  member_count int,
  owner_id uuid,
  viewer_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_q text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_q := trim(coalesce(p_query, ''));
  IF length(v_q) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.description,
    t.cover_url,
    t.visibility,
    t.member_count,
    t.owner_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM tribe_members tm
        WHERE tm.tribe_id = t.id AND tm.user_id = v_user AND tm.status = 'active'
      ) THEN 'member'
      WHEN EXISTS (
        SELECT 1 FROM tribe_members tm
        WHERE tm.tribe_id = t.id AND tm.user_id = v_user AND tm.status = 'pending'
      ) THEN 'pending_join'
      WHEN EXISTS (
        SELECT 1 FROM tribe_invites ti
        WHERE ti.tribe_id = t.id AND ti.invitee_id = v_user AND ti.status = 'pending'
      ) THEN 'pending_invite'
      ELSE 'none'
    END AS viewer_status
  FROM tribes t
  WHERE t.name ILIKE '%' || v_q || '%'
  ORDER BY
    (lower(t.name) = lower(v_q)) DESC,
    (lower(t.name) LIKE lower(v_q) || '%') DESC,
    t.member_count DESC,
    t.name ASC
  LIMIT GREATEST(p_limit, 1);
END;
$$;