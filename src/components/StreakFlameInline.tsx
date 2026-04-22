import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface StreakFlameInlineProps {
  /** Streak in days — drives both size and visual intensity */
  streak: number;
  /** Optional explicit size override (px). If omitted, scales from streak. */
  size?: number;
  /** Show the streak count next to the flame (e.g. "24" or "3d") */
  showCount?: boolean;
  /** Suffix after count, e.g. "d" → "3d". Empty string for plain numbers. */
  suffix?: string;
  /** Extra wrapper class */
  className?: string;
  /** Override count text class — for color/weight. Defaults to tier-based. */
  countClassName?: string;
}

/**
 * LIGHTWEIGHT inline flame — pure CSS gradients + a single transform-based
 * flicker. NO SVG turbulence / displacement filter (those are GPU killers
 * when rendered in long lists like the leaderboard or feed).
 *
 * Visual idea is identical to RealisticFlame (tier palette, growing size),
 * but stripped down so a 50-row leaderboard renders smoothly.
 *
 * Use RealisticFlame instead for hero placements.
 */
const StreakFlameInline = ({
  streak,
  size,
  showCount = true,
  suffix = "",
  className,
  countClassName,
}: StreakFlameInlineProps) => {
  // Tier (mirrors StreakDisplay)
  const tierIndex =
    streak >= 100 ? 5 :
    streak >= 60  ? 4 :
    streak >= 30  ? 3 :
    streak >= 14  ? 2 :
    streak >= 7   ? 1 :
    streak >= 3   ? 0 : -1;

  const isHot       = tierIndex >= 0;
  const isWarm      = tierIndex >= 1;
  const isOnFire    = tierIndex >= 2;
  const isBlazing   = tierIndex >= 3;
  const isDiamond   = tierIndex >= 4;
  const isLegendary = tierIndex >= 5;

  // Auto-size based on streak length: 12px (cold) → 22px (legendary)
  const autoSize =
    isLegendary ? 22 :
    isDiamond   ? 20 :
    isBlazing   ? 18 :
    isOnFire    ? 16 :
    isWarm      ? 14 :
    isHot       ? 13 : 12;
  const flameSize = size ?? autoSize;

  // Tier palette
  const palette = useMemo(() => {
    if (isLegendary) {
      return {
        outer: "hsl(300 75% 60%)",
        mid:   "hsl(35 100% 60%)",
        core:  "hsl(60 100% 92%)",
        glow:  "hsl(280 80% 65%)",
        text:  "hsl(280 80% 70%)",
      };
    }
    if (isDiamond) {
      return {
        outer: "hsl(190 90% 60%)",
        mid:   "hsl(40 95% 60%)",
        core:  "hsl(58 100% 90%)",
        glow:  "hsl(200 85% 65%)",
        text:  "hsl(200 85% 70%)",
      };
    }
    if (isBlazing) {
      return {
        outer: "hsl(28 95% 52%)",
        mid:   "hsl(40 95% 60%)",
        core:  "hsl(56 100% 86%)",
        glow:  "hsl(42 85% 60%)",
        text:  "hsl(42 90% 65%)",
      };
    }
    if (isOnFire) {
      return {
        outer: "hsl(16 92% 50%)",
        mid:   "hsl(28 95% 58%)",
        core:  "hsl(48 100% 80%)",
        glow:  "hsl(28 95% 60%)",
        text:  "hsl(28 95% 65%)",
      };
    }
    if (isWarm) {
      return {
        outer: "hsl(14 88% 48%)",
        mid:   "hsl(20 92% 56%)",
        core:  "hsl(42 100% 75%)",
        glow:  "hsl(18 95% 58%)",
        text:  "hsl(18 95% 62%)",
      };
    }
    if (isHot) {
      return {
        outer: "hsl(14 90% 56%)",
        mid:   "hsl(18 90% 55%)",
        core:  "hsl(42 100% 72%)",
        glow:  "hsl(14 90% 56%)",
        text:  "hsl(14 90% 62%)",
      };
    }
    return {
      outer: "hsl(var(--muted-foreground))",
      mid:   "hsl(var(--muted-foreground))",
      core:  "hsl(var(--muted-foreground))",
      glow:  "transparent",
      text:  "hsl(var(--muted-foreground))",
    };
  }, [tierIndex, isHot, isWarm, isOnFire, isBlazing, isDiamond, isLegendary]);

  // Slow flicker speed — deliberately gentle so 50 of these on screen
  // doesn't thrash the compositor.
  const speed =
    isLegendary ? 1.4 :
    isDiamond   ? 1.6 :
    isBlazing   ? 1.8 :
    isOnFire    ? 2.0 :
    isWarm      ? 2.4 : 2.8;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 leading-none align-middle", className)}
    >
      <span
        className="relative inline-block shrink-0"
        style={{ width: flameSize, height: flameSize * 1.15 }}
        aria-hidden
      >
        {/* Halo glow — only Warm+, single static blur */}
        {isWarm && (
          <span
            className="absolute left-1/2 bottom-0 rounded-full pointer-events-none"
            style={{
              width: flameSize * 1.1,
              height: flameSize * 0.55,
              background: `radial-gradient(ellipse at center, ${palette.glow} 0%, transparent 70%)`,
              transform: "translateX(-50%)",
              filter: "blur(2px)",
              opacity: 0.55,
            }}
          />
        )}

        {/* Outer flame body — pure CSS shape (teardrop via border-radius) */}
        <span
          className={cn(
            "absolute left-1/2 bottom-0",
            isHot && "animate-[flame-inline-flicker_var(--flame-speed)_ease-in-out_infinite]",
          )}
          style={{
            width: flameSize,
            height: flameSize * 1.1,
            transform: "translateX(-50%)",
            transformOrigin: "center bottom",
            background: isHot
              ? `radial-gradient(ellipse at 50% 80%, ${palette.core} 0%, ${palette.mid} 35%, ${palette.outer} 70%, transparent 95%)`
              : "transparent",
            border: isHot ? "none" : `1.5px solid ${palette.outer}`,
            borderRadius: "50% 50% 50% 50% / 65% 65% 35% 35%",
            // Pinch the top into a teardrop tip
            clipPath: "polygon(50% 0%, 95% 35%, 100% 70%, 80% 100%, 20% 100%, 0% 70%, 5% 35%)",
            boxShadow: isHot ? `0 0 ${flameSize * 0.4}px ${palette.glow}` : undefined,
            ["--flame-speed" as string]: `${speed}s`,
          }}
        />

        {/* White-hot inner core — On Fire+, single tiny element */}
        {isOnFire && (
          <span
            className="absolute left-1/2 bottom-0 animate-[flame-inline-core_var(--core-speed)_ease-in-out_infinite]"
            style={{
              width: flameSize * 0.45,
              height: flameSize * 0.7,
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              background: `radial-gradient(ellipse at 50% 75%, ${palette.core} 0%, ${palette.mid} 60%, transparent 100%)`,
              borderRadius: "50% 50% 50% 50% / 65% 65% 35% 35%",
              clipPath: "polygon(50% 0%, 95% 35%, 100% 70%, 80% 100%, 20% 100%, 0% 70%, 5% 35%)",
              ["--core-speed" as string]: `${speed * 0.55}s`,
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* Single static spark dot — Diamond+ only, no animation */}
        {isDiamond && (
          <span
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 1.5,
              height: 1.5,
              left: "50%",
              top: 1,
              background: palette.core,
              boxShadow: `0 0 3px ${palette.core}`,
              transform: "translateX(-50%)",
            }}
          />
        )}
      </span>

      {showCount && (
        <span
          className={cn(
            "font-black tabular-nums",
            isLegendary && "animate-[streak-rainbow_3.5s_linear_infinite]",
            countClassName,
          )}
          style={{
            color: countClassName ? undefined : palette.text,
            ...(isLegendary && !countClassName ? {
              backgroundImage: "linear-gradient(135deg, hsl(280 80% 65%), hsl(42 95% 70%), hsl(350 85% 65%), hsl(200 85% 70%), hsl(280 80% 65%))",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            } : {}),
          }}
        >
          {streak}{suffix}
        </span>
      )}
    </span>
  );
};

export default StreakFlameInline;
