/**
 * Goal-driven habit recommendations.
 *
 * Given the user's primary athletic goal (and optionally secondary +
 * mental-health focus + horizon), returns a ranked list of protocols from
 * PROTOCOLS that move the needle most for that goal — backed by literature
 * priorities, not arbitrary picks.
 *
 * Used by:
 *  - /coach/library — "Recommended for your goal" section at the top
 *  - /coach/habits empty state — pre-curated starter stack
 *  - (future) onboarding final step
 *
 * Pure function — no hooks, no Supabase. Easy to unit-test, easy to
 * inject from any surface.
 */

import { PROTOCOLS, type Protocol, type PillarId } from "@/lib/wellness-framework";

export type Goal =
  | "all"
  | "strength"
  | "hypertrophy"
  | "fat_loss"
  | "endurance"
  | "longevity"
  | "focus";

/**
 * Per-goal: which pillars matter most, and which specific protocol IDs are
 * "must-have" anchors. Evidence-graded by the literature consensus for each
 * outcome. Anchors get bumped to the top of the recommendation list.
 */
const GOAL_PROFILE: Record<Goal, {
  pillarWeights: Partial<Record<PillarId, number>>;
  anchors: string[];
}> = {
  all: {
    pillarWeights: { sleep: 3, movement: 3, nutrition: 3, stress: 2, recovery: 2, connection: 1 },
    anchors: ["sleep-7-9h", "zone-2-cardio", "strength-2-3x", "protein-1-6g-per-kg", "veggies-5-servings"],
  },
  strength: {
    pillarWeights: { movement: 5, nutrition: 4, recovery: 3, sleep: 3, stress: 1, connection: 1 },
    anchors: [
      "strength-2-3x", "strength-progressive-overload", "protein-1-6g-per-kg",
      "creatine-5g", "sleep-7-9h", "mobility-daily-10min",
    ],
  },
  hypertrophy: {
    pillarWeights: { movement: 5, nutrition: 5, recovery: 3, sleep: 4, stress: 1, connection: 1 },
    anchors: [
      "strength-2-3x", "strength-progressive-overload", "protein-1-6g-per-kg",
      "creatine-5g", "sleep-7-9h", "veggies-5-servings",
    ],
  },
  fat_loss: {
    pillarWeights: { nutrition: 5, movement: 4, sleep: 3, stress: 3, recovery: 2, connection: 1 },
    anchors: [
      "protein-1-6g-per-kg", "fiber-30g", "minimize-ultra-processed",
      "added-sugar-under-25g", "daily-8k-steps", "walk-after-meals-10min",
      "strength-2-3x", "sleep-7-9h",
    ],
  },
  endurance: {
    pillarWeights: { movement: 5, recovery: 4, nutrition: 4, sleep: 4, stress: 2, connection: 1 },
    anchors: [
      "zone-2-cardio", "vo2-intervals-1x", "sleep-7-9h",
      "hydration-30ml-kg", "electrolytes-balance", "active-recovery-day",
    ],
  },
  longevity: {
    pillarWeights: { sleep: 5, movement: 5, nutrition: 5, stress: 4, recovery: 4, connection: 4 },
    anchors: [
      "sleep-7-9h", "zone-2-cardio", "strength-2-3x", "vo2-intervals-1x",
      "veggies-5-servings", "omega3-fatty-fish", "weekly-social-2x",
      "minimize-ultra-processed", "daily-8k-steps", "sauna-20min-4x",
    ],
  },
  focus: {
    pillarWeights: { sleep: 5, stress: 5, movement: 3, nutrition: 3, recovery: 3, connection: 2 },
    anchors: [
      "sleep-7-9h", "sleep-schedule-consistent", "no-screens-60min-pre-bed",
      "morning-light-10min", "deep-work-90min", "no-phone-first-60min",
      "mindfulness-10min", "social-media-under-30min", "read-30min-daily",
    ],
  },
};

const EVIDENCE_RANK = { strong: 0, promising: 1, speculative: 2 } as const;

export interface RecommendOptions {
  /** Already-adopted habits to exclude from suggestions. */
  excludeProtocolIds?: string[];
  /** Max items to return. Default 8. */
  limit?: number;
}

/**
 * Return the top N protocols for the goal, with anchors first then a
 * pillar-weighted ranking. Already-adopted protocols are filtered out.
 */
export function recommendHabitsForGoal(
  goal: Goal | string | null | undefined,
  opts: RecommendOptions = {},
): Protocol[] {
  const limit = opts.limit ?? 8;
  const excluded = new Set(opts.excludeProtocolIds ?? []);
  const safeGoal: Goal = (goal && goal in GOAL_PROFILE) ? goal as Goal : "all";
  const profile = GOAL_PROFILE[safeGoal];

  // Score every protocol.
  const scored = PROTOCOLS
    .filter((p) => !excluded.has(p.id))
    .map((p) => {
      const isAnchor = profile.anchors.includes(p.id);
      const pillarWeight = profile.pillarWeights[p.pillar] ?? 1;
      const evidenceBonus = 3 - EVIDENCE_RANK[p.evidence]; // strong=3, promising=2, speculative=1
      // Anchor protocols get a huge boost (so they always rise to the top
      // even if their pillar weight is moderate).
      const anchorBoost = isAnchor ? 50 : 0;
      return {
        protocol: p,
        score: anchorBoost + (pillarWeight * 4) + evidenceBonus,
        isAnchor,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.protocol);
}

/**
 * Human label for a goal id — used in UI ("Recommended for your goal:
 * Build muscle").
 */
export function goalLabel(goal: Goal | string | null | undefined): string {
  switch (goal) {
    case "strength":    return "Get stronger";
    case "hypertrophy": return "Build muscle";
    case "fat_loss":    return "Lose fat";
    case "endurance":   return "Endurance";
    case "longevity":   return "Longevity";
    case "focus":       return "Sharpen focus";
    case "all":         return "All-around";
    default:            return "Your goal";
  }
}
