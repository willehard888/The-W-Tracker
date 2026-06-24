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
  meeting_url: string | null;
  starts_at: string;
  duration_min: number;
  capacity: number | null;
  host_id: string;
  host_username: string | null;
  going_count: number;
  my_status: RsvpStatus | null;
  /** Series grouping — null for one-off events. */
  series_id: string | null;
  session_index: number | null;
  series_title: string | null;
}

/** One session inside a multi-part series (course / workshop run / program). */
export interface SeriesSessionInput {
  starts_at: string;
  duration_min?: number;
  place?: string | null;
  meeting_url?: string | null;
  title?: string | null;
}

export const useTribeEvents = (tribeId?: string) => {
  return useQuery<TribeEvent[]>({
    queryKey: ["tribe-events", tribeId],
    enabled: !!tribeId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_tribe_events", { p_tribe: tribeId! });
      if (error) throw error;
      return (data as unknown as TribeEvent[]) ?? [];
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
    meeting_url?: string | null;
    starts_at: string; duration_min?: number; capacity?: number | null;
  }) => {
    const { error } = await supabase.rpc("create_tribe_event", {
      p_tribe: tribeId!,
      p_title: e.title,
      p_activity: e.activity ?? null,
      p_description: e.description ?? null,
      p_place: e.place ?? null,
      p_starts_at: e.starts_at,
      p_duration_min: e.duration_min ?? 60,
      p_capacity: e.capacity ?? null,
      p_meeting_url: e.meeting_url ?? null,
    });
    if (error) throw error;
    invalidate();
  }, [tribeId, invalidate]);

  const createSeries = useCallback(async (s: {
    title: string; activity?: string; description?: string;
    sessions: SeriesSessionInput[];
  }) => {
    const { error } = await supabase.rpc("create_tribe_event_series", {
      p_tribe: tribeId!,
      p_title: s.title,
      p_activity: s.activity ?? null,
      p_description: s.description ?? null,
      p_sessions: s.sessions.map((x) => ({
        starts_at: x.starts_at,
        duration_min: x.duration_min ?? 60,
        place: x.place ?? null,
        meeting_url: x.meeting_url ?? null,
        title: x.title ?? null,
      })),
    });
    if (error) throw error;
    invalidate();
  }, [tribeId, invalidate]);

  const deleteSeries = useCallback(async (seriesId: string) => {
    const { error } = await supabase.rpc("delete_tribe_event_series", { p_series: seriesId });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const rsvp = useCallback(async (eventId: string, status: RsvpStatus) => {
    const { error } = await supabase.rpc("rsvp_tribe_event", { p_event: eventId, p_status: status });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const deleteEvent = useCallback(async (eventId: string) => {
    const { error } = await supabase.rpc("delete_tribe_event", { p_event: eventId });
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  return { createEvent, createSeries, deleteSeries, rsvp, deleteEvent, invalidate };
};
