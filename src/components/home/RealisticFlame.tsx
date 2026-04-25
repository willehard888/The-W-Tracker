import { forwardRef, useImperativeHandle, useRef } from "react";
import StylizedStreakFlame from "@/components/home/StylizedStreakFlame";
import { triggerFlameShockwave } from "@/lib/wind";
import { cn } from "@/lib/utils";

export interface RealisticFlameHandle {
  /** Trigger a tier-up shockwave ring centered on the flame. */
  shockwave: (color?: string) => void;
}

interface RealisticFlameProps {
  /** 0-6 — controls intensity, color richness, particle counts */
  tier: number;
  /** Outer accent color (hsl string) */
  accent: string;
  /** Pixel size of the flame container */
  size?: number;
  className?: string;
  /** Reserved for backwards compat — pointer reactivity is built in to the new engine. */
  interactive?: boolean;
  /**
   * Visual intensity multiplier (1 = normal, up to 10 = collective inferno).
   * Tribe collective fires pass 10 to dramatically emphasise the shared flame.
   */
  intensify?: number;
}

// Tier (0..6) → effective streak so the new engine reaches the matching stage.
// Tier 0 ~ 3d, Tier 6 ~ 200d+
const TIER_TO_STREAK = [3, 7, 14, 30, 60, 120, 220];

/**
 * RealisticFlame — now a thin wrapper around the unified StylizedStreakFlame
 * engine so the entire app shares one flame style. Tier and accent are
 * preserved for callers (e.g. tribes pass `intensify={10}` for the
 * collective-inferno look).
 */
const RealisticFlame = forwardRef<RealisticFlameHandle, RealisticFlameProps>(
  ({ tier, accent, size = 44, className, intensify = 1 }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const streak = TIER_TO_STREAK[Math.max(0, Math.min(TIER_TO_STREAK.length - 1, tier))] ?? 14;

    useImperativeHandle(ref, () => ({
      shockwave: (color?: string) => {
        triggerFlameShockwave(containerRef.current, color ?? accent);
      },
    }), [accent]);

    return (
      <div
        ref={containerRef}
        className={cn("relative flex items-end justify-center", className)}
        style={{ width: size, height: size }}
      >
        <StylizedStreakFlame
          streak={streak}
          size={size}
          intensify={intensify}
          accent={accent}
        />
      </div>
    );
  }
);

RealisticFlame.displayName = "RealisticFlame";

export default RealisticFlame;
