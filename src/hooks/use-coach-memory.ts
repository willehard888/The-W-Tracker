import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CoachMemory {
  id: string;
  user_id: string;
  fact: string;
  source: "chat" | "reflection" | "manual" | "system";
  confidence: number;
  created_at: string;
}

export const useCoachMemory = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["coach-memory", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,   // memory entries update when user chats with coach
    gcTime:    15 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_chat_memory")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CoachMemory[];
    },
  });

  const add = useMutation({
    mutationFn: async (fact: string) => {
      const { data, error } = await supabase.rpc("add_chat_memory", {
        _fact: fact, _source: "manual", _confidence: 1.0,
      });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-memory", user?.id] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_chat_memory", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-memory", user?.id] }),
  });

  return {
    memories: query.data ?? [],
    isLoading: query.isLoading,
    add: add.mutateAsync,
    remove: remove.mutateAsync,
  };
};
