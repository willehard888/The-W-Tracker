import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserSearchRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  level: number | null;
}

/** Two characters is the floor everywhere; below it the query never runs. */
export const USER_SEARCH_MIN = 2;

/**
 * "Find a person by handle" — one implementation.
 *
 * There were four: /friends (limit 12), /messages (10), badge compare (10, and
 * only two columns) and the tribe invite modal (20, hand-rolled debounce and
 * local state). Two caches for the same question, three page sizes, and none of
 * them filtered blocked users — so someone you had blocked was still findable
 * and messageable from search, on a screen whose whole point is starting
 * contact.
 *
 * The block filter is one-directional by necessity: RLS lets you read only the
 * rows where you are the blocker (reading the other direction would tell you
 * who blocked you). Content stays hidden both ways server-side through
 * `is_blocked`; this just stops the app from offering a conversation you have
 * already refused.
 */
export const useUserSearch = (query: string, limit = 12) => {
  const { user } = useAuth();
  const q = query.trim();

  const blocked = useQuery<string[]>({
    queryKey: ["blocked-users", user?.id, "ids"],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((b) => b.blocked_id as string);
    },
  });

  const search = useQuery<UserSearchRow[]>({
    // The blocked ids are part of the key: unblocking someone must not serve a
    // cached list that still hides them.
    queryKey: ["user-search", q, limit, (blocked.data ?? []).length],
    enabled: !!user && q.length >= USER_SEARCH_MIN,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, status_tier, level")
        .neq("user_id", user!.id)
        .ilike("username", `%${q}%`)
        .limit(limit);
      if (error) throw error;
      const hidden = new Set(blocked.data ?? []);
      return ((data ?? []) as UserSearchRow[]).filter((u) => !hidden.has(u.user_id));
    },
  });

  return {
    results: search.data ?? [],
    searching: search.isFetching,
    isError: search.isError,
  };
};
