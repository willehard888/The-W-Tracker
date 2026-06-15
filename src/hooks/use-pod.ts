import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PodMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  streak: number | null;
  checked_in_today: boolean;
}

export interface Pod {
  id: string;
  name: string;
  invite_code: string | null;
  owner_id: string;
}

export interface PodToday {
  pod: Pod;
  members: PodMember[];
}

export interface PodInvite {
  pod_id: string;
  pod_name: string;
  inviter_username: string;
  member_count: number;
  created_at: string;
}

const rpc = supabase.rpc.bind(supabase) as any;

/**
 * The caller's accountability pod + each member's today check-in status.
 * Returns null when the user isn't in a pod yet.
 */
export const usePod = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<PodToday | null>({
    queryKey: ["pod-today", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const tz = new Date().getTimezoneOffset();
      const { data, error } = await rpc("pod_today", { p_tz_offset_minutes: tz });
      if (error) throw error;
      return (data as PodToday | null) ?? null;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pod-today", user?.id] });

  return { ...query, refresh };
};

/** Incoming pod invitations from friends. */
export const usePodInvites = () => {
  const { user } = useAuth();
  return useQuery<PodInvite[]>({
    queryKey: ["pod-invites", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await rpc("list_pod_invites");
      if (error) throw error;
      return (data as PodInvite[]) ?? [];
    },
  });
};

/** Pod mutations, with cache invalidation. */
export const usePodActions = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["pod-today", user?.id] });
    qc.invalidateQueries({ queryKey: ["pod-invites", user?.id] });
  }, [qc, user?.id]);

  const createPod = useCallback(async (name: string) => {
    const { error } = await rpc("create_pod", { p_name: name });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const inviteToPod = useCallback(async (inviteeId: string) => {
    const { error } = await rpc("invite_to_pod", { p_invitee: inviteeId });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const acceptInvite = useCallback(async (podId: string) => {
    const { error } = await rpc("accept_pod_invite", { p_pod: podId });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const declineInvite = useCallback(async (podId: string) => {
    const { error } = await rpc("decline_pod_invite", { p_pod: podId });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const leavePod = useCallback(async () => {
    const { error } = await rpc("leave_pod");
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  return { createPod, inviteToPod, acceptInvite, declineInvite, leavePod, invalidate };
};
