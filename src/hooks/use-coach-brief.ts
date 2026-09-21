/**
 * useCoachBrief — the proactive, AI-written daily brief from AI Coach.
 *
 * Calls the `coach-daily-brief` edge function, which is cached server-side
 * one-per-user-per-day: the first call of the day generates (Gemini Flash),
 * every later call returns the cached payload instantly. So invoking it on
 * mount is cheap. Available to every member (gated by has_active_access, not
 * Elite) — the AI is the centre of the app, not a tier perk.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { readEdgeError } from "@/lib/error-copy";

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


export const useCoachBrief = () => {
  const { user, profile } = useAuth();
  const { hasAccess, loading: accessLoading } = useTrialAccess();
  const date = localDateKey();

  const query = useQuery<CoachBrief | null>({
    // The tier is part of the key: a promotion asks again, and the server
    // rewrites a brief that was written under the old one.
    queryKey: ["coach-brief", user?.id, date, profile?.status_tier ?? null],
    // Mirror the server's has_active_access gate — calling anyway meant every
    // expired-trial user fired two 403s at the edge function on each visit.
    enabled: !!user?.id && !accessLoading && hasAccess,
    staleTime: 23 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      // Device offset so the server caches the brief on the SAME day this hook
      // keys it by (`localDateKey`) — it was rolling over at UTC midnight.
      const { data, error } = await supabase.functions.invoke("coach-daily-brief", {
        body: { tz_offset_minutes: new Date().getTimezoneOffset() },
      });
      // The edge function's own sentence — the daily limit and when it resets,
      // the consent prompt — lives in the Response, not in error.message.
      if (error) throw new Error((await readEdgeError(error, "Today's brief is unavailable right now.")).message);
      if (data?.error) throw new Error(data.error);
      return (data?.brief as CoachBrief) ?? null;
    },
  });

  return { brief: query.data ?? null, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
};
