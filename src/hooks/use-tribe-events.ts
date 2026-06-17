import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RsvpStatus = "going" | "maybe" | "declined";

export interface TribeEvent {
  id: string;
  title: string;
  activity: string | null;
  description: string | null;
  place: string | null;
  starts_at: string;
  duration_min: number;
  capacity: number | null;
  host_id: string;
  host_username: string | null;
  going_count: number;
  my_status: RsvpStatus | null;
}

const rpc = supabase.rpc.bind(supabase) as any;

export const useTribeEvents = (tribeId?: string) => {
  return useQuery<TribeEvent[]>({
    queryKey: ["tribe-events", tribeId],
    enabled: !!tribeId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await rpc("list_tribe_events", { p_tribe: tribeId });
      if (error) throw error;
      return (data as TribeEvent[]) ?? [];
    },
  });
};

export const useTribeEventActions = (tribeId?: string) => {
  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["tribe-events", tribeId] });
  }, [qc, tribeId]);

  const createEvent = useCallback(async (e: {
    title: string; activity?: string; description?: string; place?: string;
    starts_at: string; duration_min?: number; capacity?: number | null;
  }) => {
    const { error } = await rpc("create_tribe_event", {
      p_tribe: tribeId,
      p_title: e.title,
      p_activity: e.activity ?? null,
      p_description: e.description ?? null,
      p_place: e.place ?? null,
      p_starts_at: e.starts_at,
      p_duration_min: e.duration_min ?? 60,
      p_capacity: e.capacity ?? null,
    });
    if (error) throw error;
    invalidate();
  }, [tribeId, invalidate]);

  const rsvp = useCallback(async (eventId: string, status: RsvpStatus) => {
    const { error } = await rpc("rsvp_tribe_event", { p_event: eventId, p_status: status });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const deleteEvent = useCallback(async (eventId: string) => {
    const { error } = await rpc("delete_tribe_event", { p_event: eventId });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  return { createEvent, rsvp, deleteEvent, invalidate };
};
