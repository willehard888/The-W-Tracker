import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRank } from "@/hooks/use-my-rank";
import { nextTierRequirements, type NextTierInfo } from "@/lib/status-tiers";

export interface RequirementProgress {
  key: "percentile" | "activeDays" | "streak";
  label: string;
  current: number;
  target: number;
  unit: string;
  /** 0..1 */
  progress: number;
  met: boolean;
}

export interface NextTierProgressData {
  loading: boolean;
  next: NextTierInfo | null;
  /** Path A — rank percentile (always present when the tier has one). */
  rankPath: RequirementProgress[];
  /** Path B — the grind path (active days + streak). Empty when not applicable. */
  grindPath: RequirementProgress[];
  /** True when the next tier is earned by EITHER path (orPath). */
  either: boolean;
  activeDays: number;
}

/**
 * Live progress toward the next tier, thresholds straight from TIER_CONFIG
 * (which mirrors SQL update_status_tier). Replaces use-road-to-elite, whose
 * hard-coded streak target (21) had drifted from the server (30).
 */
export const useNextTierProgress = (): NextTierProgressData => {
  const { profile } = useAuth();
  const userId = profile?.user_id;
  const { data: rankData, isLoading: rankLoading } = useMyRank(userId);

  const { data: activeDays = 0, isLoading: daysLoading } = useQuery({
    queryKey: ["active-days-30", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", userId!)
        .gte("checked_in_at", since);
      return new Set((data ?? []).map((c) => String(c.checked_in_at).slice(0, 10))).size;
    },
  });

  const next = nextTierRequirements(profile?.status_tier ?? "recruit");
  if (!next) {
    return { loading: false, next: null, rankPath: [], grindPath: [], either: false, activeDays };
  }
  const req = next.requirements;
  const percentile = rankData?.percentile ?? 0;
  const streak = profile?.streak ?? 0;
  const row = (key: RequirementProgress["key"], label: string, current: number, target: number, unit: string): RequirementProgress => ({
    key, label, current, target, unit,
    progress: target > 0 ? Math.min(1, current / target) : 1,
    met: current >= target,
  });

  const rankPath: RequirementProgress[] = [];
  const grindPath: RequirementProgress[] = [];
  if (req.percentile > 0) rankPath.push(row("percentile", `Top ${Math.max(1, Math.round(100 - req.percentile))}% of ranked members`, Math.round(percentile), req.percentile, "%ile"));
  if (req.activeDays > 0) (req.orPath ? grindPath : rankPath).push(row("activeDays", "Active days (last 30)", activeDays, req.activeDays, "days"));
  if (req.streak > 0) (req.orPath ? grindPath : rankPath).push(row("streak", "Current streak", streak, req.streak, "days"));

  return {
    loading: rankLoading || daysLoading,
    next,
    rankPath,
    grindPath,
    either: !!req.orPath && grindPath.length > 0,
    activeDays,
  };
};
