/**
 * useCoachBrief — the proactive, AI-written daily brief from W Coach.
 *
 * Calls the `coach-daily-brief` edge function, which is cached server-side
 * one-per-user-per-day: the first call of the day generates (Gemini Flash),
 * every later call returns the cached payload instantly. So invoking it on
 * mount is cheap. Available to every member (gated by has_active_access, not
 * Elite) — the AI is the centre of the app, not a tier perk.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";

export interface CoachBriefPrescription {
  label: string;
  value: string;
}

export interface CoachBrief {
  ribbon: string;
  brief_md: string;
  prescriptions: CoachBriefPrescription[];
  suggested_questions: string[];
  session_focus?: string | null;
  week?: number;
  day_index?: number;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const useCoachBrief = () => {
  const { user } = useAuth();
  const { hasAccess, loading: accessLoading } = useTrialAccess();
  const date = todayISO();

  const query = useQuery<CoachBrief | null>({
    queryKey: ["coach-brief", user?.id, date],
    // Mirror the server's has_active_access gate — calling anyway meant every
    // expired-trial user fired two 403s at the edge function on each visit.
    enabled: !!user?.id && !accessLoading && hasAccess,
    staleTime: 23 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("coach-daily-brief", { body: {} });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return (data?.brief as CoachBrief) ?? null;
    },
  });

  return { brief: query.data ?? null, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
};
