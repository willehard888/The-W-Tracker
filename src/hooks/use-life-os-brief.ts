/**
 * useLifeOSBrief — fetches and (lazily) generates today's Life OS daily brief.
 *
 * Read path:  coach_life_os_briefs table (Supabase direct, no edge function).
 * Write path: life-os-brief edge function (AI generation + DB upsert).
 *
 * The brief is treated as immutable for the calendar day — staleTime is 23 h.
 * Call generate(force=true) to force a regeneration (e.g. "refresh" button).
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LifeOSDomain {
  action: string;
  detail: string;
}

export interface LifeOSAdjustment {
  label: "push" | "hold" | "deload" | "swap";
  detail: string;
  readiness: number;
}

export interface LifeOSBrief {
  user_id:      string;
  brief_date:   string;
  focus:        string;
  why:          string;
  body:         LifeOSDomain;
  recovery:     LifeOSDomain;
  fuel:         LifeOSDomain;
  mind:         LifeOSDomain;
  adjustment:   LifeOSAdjustment;
  generated_at: string;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const useLifeOSBrief = () => {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const date     = todayISO();
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError  ] = useState<string | null>(null);

  // ── Read: pull from Supabase (fast, no AI call) ─────────────────────────
  const query = useQuery<LifeOSBrief | null>({
    queryKey:  ["life-os-brief", user?.id, date],
    enabled:   !!user?.id,
    staleTime: 23 * 60 * 60 * 1000, // treat as fresh for 23 h
    gcTime:    24 * 60 * 60 * 1000,
    queryFn:   async () => {
      const { data, error } = await (supabase as any)
        .from("coach_life_os_briefs")
        .select("*")
        .eq("user_id", user!.id)
        .eq("brief_date", date)
        .maybeSingle();
      if (error) throw error;
      return (data as LifeOSBrief | null) ?? null;
    },
  });

  // ── Write: invoke edge function (AI generation) ──────────────────────────
  const generate = async (force = false): Promise<LifeOSBrief | null> => {
    setGenerating(true);
    setGenError(null);
    try {
      const { data, error } = await supabase.functions.invoke("life-os-brief", {
        body: { force },
      });
      if (error)       throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const brief = data?.brief as LifeOSBrief;
      // Optimistically update the query cache so UI updates immediately
      qc.setQueryData(["life-os-brief", user?.id, date], brief);
      return brief;
    } catch (e: any) {
      const msg = e?.message ?? "Failed to generate brief";
      setGenError(msg);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return {
    brief:      query.data    ?? null,
    isLoading:  query.isLoading,
    generating,
    genError,
    generate,
    refetch:    query.refetch,
  };
};
