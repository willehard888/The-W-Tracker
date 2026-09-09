import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime";

/**
 * Unread DM count for the Squad → Messages door, plus a realtime
 * subscription that keeps it live. Mirrors `useUnreadNotificationCount`.
 */
export const useUnreadMessageCount = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(uniqueChannelName("direct-messages-rt", uid))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${uid}` },
        () => queryClient.invalidateQueries({ queryKey: ["direct-messages"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // Keyed on the stable id, never the user OBJECT (token refresh mints a
    // new identity hourly and would re-subscribe).
  }, [uid, queryClient]);

  return useQuery<number>({
    queryKey: ["direct-messages", uid, "unread-count"],
    enabled: !!uid,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", uid!)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
};
