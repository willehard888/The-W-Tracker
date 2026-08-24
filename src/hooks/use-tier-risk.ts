import { useMemo } from "react";
import { getPreviousTier, type StatusTier } from "@/lib/status-tiers";
import { getStreakDeadlineState, isCheckedInToday } from "@/lib/streak";

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
    const prevTier = getPreviousTier(current);

    // Streak deadline (48h window) — the ONLY real, data-grounded risk.
    const deadline = getStreakDeadlineState(streak, lastCheckinAt);
    const hoursLeft = deadline?.expired ? 0 : deadline?.hours ?? null;
    const minsLeft = deadline?.expired ? 0 : deadline?.mins ?? null;

    // NOTE: the old "score margin" path was removed. It estimated a demotion
    // cutoff from a hand-tuned proxy ("(prevTier.percentile/100)*50"), not real
    // ranking data, and for top-tier users it collapsed to Math.max(0, …) = 0 —
    // firing a red "Only 0.0 pts above Apex" DANGER banner that was both false
    // and meaningless. Status is performance-earned; a fabricated demotion
    // warning undermines that. Only the streak deadline (a real deadline the
    // user can act on) drives this banner now.
    let level: RiskLevel = "safe";
    let reason: "streak" | "score" | null = null;

    // Today is banked → nothing is at risk until tomorrow. Without this the
    // banner fired every day right after checking in (48h window − a few
    // hours < the 36h threshold).
    const bankedToday = isCheckedInToday(lastCheckinAt);

    if (!bankedToday && streak > 0 && deadline) {
      if (deadline.expired || (hoursLeft !== null && hoursLeft < 24)) {
        level = "danger";
        reason = "streak";
      } else if (hoursLeft !== null && hoursLeft < 36) {
        level = "pressure";
        reason = "streak";
      }
    }

    return {
      level,
      currentTier: current,
      previousTierLabel: prevTier?.label ?? null,
      pointsAboveCutoff: null,
      hoursUntilStreakBreak: hoursLeft,
      minutesUntilStreakBreak: minsLeft,
      reason,
    };
  }, [tier, rankScore, streak, lastCheckinAt]);
};
