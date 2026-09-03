import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime";

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  route: string | null;
  actor_id: string | null;
  ref_id: string | null;
  created_at: string;
  read_at: string | null;
}

/** The inbox list — newest first. */
export const useNotifications = (limit = 50) => {
  const { user } = useAuth();
  return useQuery<AppNotification[]>({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, route, actor_id, ref_id, created_at, read_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
};

/** Unread count for the bell + a realtime subscription that keeps it live. */
export const useUnreadNotificationCount = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(uniqueChannelName("notifications-rt", uid))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // Keyed on the stable id, never the user OBJECT (token refresh mints a
    // new identity hourly and would re-subscribe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, queryClient]);

  return useQuery<number>({
    queryKey: ["notifications", uid, "unread-count"],
    enabled: !!uid,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid!)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
};

/** Mark one row read (fire-and-forget; RLS + guard allow only read_at). */
export const markNotificationRead = async (id: string) => {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
};
