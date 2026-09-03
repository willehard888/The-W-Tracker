import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Friend {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  streak: number | null;
  level: number | null;
}

export interface FriendRequest extends Friend {
  friendship_id: string;
  created_at: string;
}

const rpc = supabase.rpc.bind(supabase) as any;

/** Caller's accepted friends. */
export const useFriends = () => {
  const { user } = useAuth();
  return useQuery<Friend[]>({
    queryKey: ["friends-list", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await rpc("list_friends");
      if (error) throw error;
      return (data as Friend[]) ?? [];
    },
  });
};

/** Incoming pending friend requests (people who want to add you). */
export const useFriendRequests = () => {
  const { user } = useAuth();
  return useQuery<FriendRequest[]>({
    queryKey: ["friend-requests", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await rpc("list_friend_requests");
      if (error) throw error;
      return (data as FriendRequest[]) ?? [];
    },
  });
};

/** Outgoing pending requests you've sent. */
export const useSentFriendRequests = () => {
  const { user } = useAuth();
  return useQuery<FriendRequest[]>({
    queryKey: ["sent-friend-requests", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await rpc("list_sent_friend_requests");
      if (error) throw error;
      return (data as FriendRequest[]) ?? [];
    },
  });
};

export const usePendingFriendCount = () => {
  const { user } = useAuth();
  return useQuery<number>({
    queryKey: ["friend-request-count", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("pending_friend_request_count");
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
};

/** Mutations for the friend graph, with full cache invalidation. */
export const useFriendActions = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    ["friends-list", "friend-requests", "sent-friend-requests", "friend-request-count",
     "friendship", "friends"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }, [qc]);

  const sendRequest = useCallback(async (targetUserId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user.id, addressee_id: targetUserId });
    if (error) throw error;
    invalidate();
  }, [user, invalidate]);

  const acceptRequest = useCallback(async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" as any, updated_at: new Date().toISOString() })
      .eq("id", friendshipId);
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  // Decline = delete so the requester can try again later (no enum dead-end).
  const declineRequest = useCallback(async (friendshipId: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const removeFriend = useCallback(async (otherUserId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`);
    if (error) throw error;
    invalidate();
  }, [user, invalidate]);

  return { sendRequest, acceptRequest, declineRequest, removeFriend, invalidate };
};
