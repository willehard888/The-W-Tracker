import { useMemo } from "react";
import { getTierConfig, getPreviousTier, type StatusTier } from "@/lib/status-tiers";
import { getStreakDeadlineState } from "@/lib/streak";

export type RiskLevel = "safe" | "pressure" | "danger";

export interface TierRiskState {
  level: RiskLevel;
  currentTier: StatusTier;
  previousTierLabel: string | null; // tier you'd drop to
  pointsAboveCutoff: number | null; // null if at lowest tier
  hoursUntilStreakBreak: number | null;
  minutesUntilStreakBreak: number | null;
  reason: "streak" | "score" | null;
}

interface UseTierRiskParams {
  tier: string;
  rankScore: number;
  streak: number;
  lastCheckinAt?: string | null;
}

/**
 * Calculates demotion risk based on:
 *  - Streak deadline (48h window from last check-in)
 *  - Rank score margin above the previous tier's cutoff (rough estimate)
 */
export const useTierRisk = ({ tier, rankScore, streak, lastCheckinAt }: UseTierRiskParams): TierRiskState => {
  return useMemo(() => {
    const current = (tier || "recruit") as StatusTier;
    const currentConfig = getTierConfig(current);
    const prevTier = getPreviousTier(current);

    // Streak deadline (48h window)
    const deadline = getStreakDeadlineState(streak, lastCheckinAt);
    const hoursLeft = deadline?.expired ? 0 : deadline?.hours ?? null;
    const minsLeft = deadline?.expired ? 0 : deadline?.mins ?? null;

    // Score margin: rank_score is 0–100. Estimate cutoff distance as
    // a rough proxy from current tier's required percentile vs. score.
    // Lower tiers don't have a meaningful drop-down so margin defaults to safe.
    let pointsAbove: number | null = null;
    if (prevTier && currentConfig.rank > 0) {
      // Heuristic: roughly each 5 points = ~5% percentile shift in mid-band.
      // We use the current rank_score as proxy. If rank_score has fallen close
      // to ~5 points above the next-down tier's typical score, mark pressure.
      // We approximate the cutoff with the previous tier's required percentile / 10.
      const proxyCutoff = (prevTier.requirements.percentile / 100) * 50; // soft proxy
      pointsAbove = Math.max(0, rankScore - proxyCutoff);
    }

    let level: RiskLevel = "safe";
    let reason: "streak" | "score" | null = null;

    // Streak danger trumps everything
    if (streak > 0 && deadline) {
      if (deadline.expired || (hoursLeft !== null && hoursLeft < 24)) {
        level = "danger";
        reason = "streak";
      } else if (hoursLeft !== null && hoursLeft < 36) {
        level = "pressure";
        reason = "streak";
      }
    }

    // Score-based pressure (only if not already in danger)
    if (level !== "danger" && pointsAbove !== null) {
      if (pointsAbove < 5) {
        level = "danger";
        reason = "score";
      } else if (pointsAbove < 12) {
        if (level === "safe") level = "pressure";
        if (!reason) reason = "score";
      }
    }

    return {
      level,
      currentTier: current,
      previousTierLabel: prevTier?.label ?? null,
      pointsAboveCutoff: pointsAbove,
      hoursUntilStreakBreak: hoursLeft,
      minutesUntilStreakBreak: minsLeft,
      reason,
    };
  }, [tier, rankScore, streak, lastCheckinAt]);
};
