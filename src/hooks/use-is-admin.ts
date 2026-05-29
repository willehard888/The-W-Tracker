import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for "is the current user an admin?".
 *
 * Every consumer shares the same queryKey (["user-role-admin", userId]) so the
 * `user_roles` lookup runs once per session and is reused across Tribes,
 * Battles, EliteFeed, etc. Admin status doesn't change mid-session, so we cache
 * aggressively.
 *
 * Pass the auth user id (`user?.id`) or the profile user id — they're the same
 * value; the hook is null-safe and simply returns false until one is present.
 */
export const useIsAdmin = (userId: string | undefined) => {
  const { data } = useQuery({
    queryKey: ["user-role-admin", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
    // Admin status is stable within a session — cache aggressively.
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  return !!data;
};
