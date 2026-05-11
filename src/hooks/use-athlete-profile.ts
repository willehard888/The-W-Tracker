import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ToneId = "drill_sergeant" | "calm_mentor" | "scientist" | "hype";
export type GoalId = "all" | "strength" | "hypertrophy" | "endurance" | "fat_loss" | "longevity" | "focus";
/**
 * Hobby tags exposed at onboarding. Free-form `string` typing so future
 * additions don't require a TS change — the input is chip-based so the UI
 * still constrains values to a curated set.
 */
export type HobbyId = string;
/**
 * Voluntary mental-health-focus tags. Used to weight the coach's "Mind"
 * domain — never surfaced to other users and never used as a diagnosis.
 */
export type MentalFocusId =
  | "anxiety"
  | "low_mood"
  | "focus"
  | "sleep"
  | "burnout"
  | "none"
  | string;

export interface AthleteProfile {
  user_id: string;
  age: number | null;
  sex: "male" | "female" | "other" | "prefer_not_say" | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  primary_goal: GoalId | null;
  secondary_goal: GoalId | null;
  target_horizon_weeks: number | null;
  timezone: string;
  wake_time: string;
  sleep_time: string;
  training_days_pref: number[];
  busy_blocks: any;
  injuries: string[];
  dietary: string[];
  equipment: string[];
  no_go_protocols: string[];
  language_pref: string;
  tone_pref: ToneId;
  preferred_session_length_min: number;
  i_am: string | null;
  onboarded: boolean;
  /** Holistic fields (migration 20260511181220) ─────────────────────────── */
  hobbies: HobbyId[];
  life_context: string | null;
  stress_baseline: 1 | 2 | 3 | 4 | 5 | null;
  mood_baseline: 1 | 2 | 3 | 4 | 5 | null;
  mental_health_focus: MentalFocusId[];
  created_at: string;
  updated_at: string;
}

export const useAthleteProfile = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["athlete-profile", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,  // profile rarely changes mid-session
    gcTime:    30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_athlete_profile" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as AthleteProfile | null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (patch: Partial<AthleteProfile> & Record<string, any>) => {
      // detect timezone if not set
      const enriched = { ...patch };
      if (!enriched.timezone) {
        try { enriched.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
      }
      const { data, error } = await supabase.rpc("upsert_athlete_profile" as any, {
        _patch: enriched as any,
      });
      if (error) throw error;
      return data as AthleteProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athlete-profile", user?.id] });
    },
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    upsert: upsert.mutateAsync,
    isSaving: upsert.isPending,
  };
};
