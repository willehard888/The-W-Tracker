import { supabase } from "@/integrations/supabase/client";

/**
 * The Elite Feed's main fetch, extracted so it can be PREFETCHED from the
 * app shell while the user is still on Home. On a high-RTT connection the
 * two serial round trips here (posts → author profiles) cost ~1.5s — paid
 * invisibly in the background instead of at the moment the Squad tab opens.
 * EliteFeed's useQuery shares the ["feed-posts", showReported] key, so the
 * prefetched result renders instantly (staleTime comes from the client).
 */
export const fetchFeedPosts = async (showReported: boolean) => {
  let query = supabase
    .from("feed_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  // Non-admins or admins not viewing reported: hide reported posts
  if (!showReported) {
    query = query.eq("reported", false);
  }

  const { data } = await query;
  if (!data) return [];
  const userIds = [...new Set(data.map((p) => p.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, avatar_url, status_tier, streak, level, is_elite")
    .in("user_id", userIds);
  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
  return data.map((post) => ({ ...post, profile: profileMap[post.user_id] }));
};
