-- Public share pages (/u/:username) broke for logged-out visitors when
-- 20260414092928 restricted profiles SELECT to authenticated (correct call —
-- anon could scrape the whole user table). This restores the share-link
-- experience WITHOUT reopening scraping: a SECURITY DEFINER lookup that
-- returns ONE user's public fields by exact (case-insensitive) username.
-- No listing, no filtering, no internal fields.

CREATE OR REPLACE FUNCTION public.get_public_profile(p_username text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'status_tier', p.status_tier,
    'tier_division', p.tier_division,
    'level', p.level,
    'xp', p.xp,
    'streak', p.streak,
    'longest_streak', p.longest_streak,
    'is_elite', p.is_elite,
    'is_apex_subscriber', p.is_apex_subscriber,
    'legend_pinned', p.legend_pinned,
    'champion_wins', (
      SELECT count(*) FROM public.leaderboard_champions c
      WHERE c.user_id = p.user_id
    ),
    'badges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'badge_id', ub.badge_id,
        'earned_at', ub.earned_at,
        'badges', jsonb_build_object('name', b.name, 'icon', b.icon, 'rarity', b.rarity)
      ) ORDER BY ub.earned_at DESC)
      FROM (
        SELECT * FROM public.user_badges ub2
        WHERE ub2.user_id = p.user_id
        ORDER BY ub2.earned_at DESC
        LIMIT 8
      ) ub
      JOIN public.badges b ON b.id = ub.badge_id
    ), '[]'::jsonb)
  )
  FROM public.profiles p
  WHERE lower(p.username) = lower(p_username)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated;
