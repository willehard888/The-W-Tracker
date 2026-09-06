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
  /**
   * Render the flame without any looping animation.
   *
   * Size, colour and layer count still track the streak, so the flame reads
   * exactly the same at a glance — only the perpetual motion is dropped. Use
   * this anywhere the component repeats down a list: the leaderboard renders
   * one per row with no virtualization, and each animated instance costs 3–7
   * looping layers, several with blur() and mix-blend-mode. The docstring
   * below already warned about this surface; `still` is the lever for it.
   */
  still?: boolean;
}

/**
 * LIGHTWEIGHT inline flame — pure CSS gradients + transform-based
 * flicker. NO SVG turbulence (those kill perf in long lists like the
 * leaderboard or feed).
 *
 * v2 polish:
 *  • Subtle rim-light gradient on the outer body for shape definition.
 *  • Second small "fork" inside the core — gives the flame a believable
 *    inner tongue.
 *  • Diamond/Legendary tiers get a slow hue-shift so they shimmer.
 *  • Hot tier numbers get a colored shadow trail.
 */
const StreakFlameInline = ({
  streak,
  size,
  showCount = true,
  suffix = "",
  className,
  countClassName,
  still = false,
}: StreakFlameInlineProps) => {
  // One gate for every looping animation in this component. Returning
  // undefined leaves the CSS `animation` property unset rather than setting
  // it to "none", so a still flame costs the compositor nothing at all.
  const loop = (value: string | undefined) => (still ? undefined : value);
  // Tier (mirrors StreakDisplay)
  const tierIndex =
    streak >= 200 ? 6 :
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
  const isInferno   = tierIndex >= 6;

  // Auto-size based on streak length: 12px (cold) → 24px (inferno)
  const autoSize =
    isInferno   ? 24 :
    isLegendary ? 22 :
    isDiamond   ? 20 :
    isBlazing   ? 18 :
    isOnFire    ? 16 :
    isWarm      ? 14 :
    isHot       ? 13 : 12;
  const flameSize = size ?? autoSize;

  // Tier palette
  const palette = useMemo(() => {
    if (isInferno) {
      return {
        outer: "hsl(310 85% 60%)",
        mid:   "hsl(265 80% 60%)",
        core:  "hsl(180 100% 92%)",
        glow:  "hsl(195 90% 65%)",
        text:  "hsl(195 95% 72%)",
      };
    }
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
        glow:  "hsl(var(--ember))",
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
  }, [tierIndex, isHot, isWarm, isOnFire, isBlazing, isDiamond, isLegendary, isInferno]);

  // Faster, livelier flicker (was deliberately slow). Still GPU-cheap.
  const speed =
    isInferno   ? 0.7  :
    isLegendary ? 0.85 :
    isDiamond   ? 1.0  :
    isBlazing   ? 1.15 :
    isOnFire    ? 1.3  :
    isWarm      ? 1.55 : 1.85;

  // Inferno gets a fast plasma hue cycle; Legendary/Diamond aurora wash.
  const hueAnim = isInferno
    ? "flame-plasma-hue 4s linear infinite"
    : isLegendary
    ? "flame-aurora-hue 6s linear infinite"
    : isDiamond
    ? "flame-aurora-hue 10s linear infinite"
    : undefined;

  // Diamond+ adds breathing wrapper (very subtle — these are tiny).
  const breathAnim = isDiamond
    ? `, flame-breathe ${(speed * 5).toFixed(2)}s ease-in-out infinite`
    : "";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 leading-none align-middle", className)}
    >
      <span
        className="relative inline-block shrink-0"
        style={{
          width: flameSize,
          height: flameSize * 1.15,
          animation: loop(hueAnim ? `${hueAnim}${breathAnim}` : breathAnim ? breathAnim.slice(2) : undefined),
          transformOrigin: "center bottom",
        }}
        aria-hidden
      >
        {/* Radiant halo bloom — pulsing glow ring (Hot+).
            New beauty layer: makes the flame feel like a real light source
            even at tiny inline sizes. Screen-blended, very soft. */}
        {isHot && (
          <span
            aria-hidden
            className="absolute left-1/2 bottom-0 pointer-events-none rounded-full"
            style={{
              width: flameSize * 2.4,
              height: flameSize * 1.9,
              background: `radial-gradient(ellipse at 50% 70%, ${palette.glow.replace(")", " / 0.5)")} 0%, ${palette.glow.replace(")", " / 0.18)")} 40%, transparent 72%)`,
              mixBlendMode: "screen",
              animation: loop(`flame-halo-bloom ${(speed * 3.8).toFixed(2)}s ease-in-out infinite`),
              zIndex: -2,
            }}
          />
        )}

        {/* Cast shadow — chiaroscuro: deepens with the bloom for contrast (Warm+). */}
        {isWarm && (
          <span
            aria-hidden
            className="absolute left-1/2 rounded-[50%] pointer-events-none"
            style={{
              width: flameSize * 1.8,
              height: flameSize * 0.32,
              bottom: -flameSize * 0.08,
              background: `radial-gradient(ellipse at 50% 50%, hsl(0 0% 0% / 0.4) 0%, hsl(0 0% 0% / 0.18) 45%, transparent 78%)`,
              filter: `blur(${Math.max(3, flameSize * 0.1)}px)`,
              transform: "translateX(-50%)",
              transformOrigin: "50% 50%",
              animation: loop(`flame-chiaroscuro ${(speed * 4.2).toFixed(2)}s ease-in-out infinite`),
              zIndex: -1,
            }}
          />
        )}

        {/* Volumetric ground-cast — projects warm light below the flame (Blazing+). */}
        {isBlazing && (
          <span
            className="flame-ground-cast absolute left-1/2 rounded-[50%] pointer-events-none"
            style={{
              width: flameSize * 2.2,
              height: flameSize * 0.4,
              bottom: -flameSize * 0.12,
              background: `radial-gradient(ellipse at 50% 50%, ${palette.glow.replace(")", " / 0.6)")} 0%, transparent 75%)`,
              filter: "blur(5px)",
              mixBlendMode: "screen",
              transformOrigin: "50% 50%",
              animation: loop(`flame-ground-cast ${(speed * 4).toFixed(2)}s ease-in-out infinite`),
              zIndex: 0,
            }}
          />
        )}

        {/* Halo glow — Warm+ — bigger & punchier */}
        {isWarm && (
          <span
            className="absolute left-1/2 bottom-0 rounded-full pointer-events-none animate-[flame-inline-flicker_var(--flame-speed)_ease-in-out_infinite]"
            style={{
              width: flameSize * 1.6,
              height: flameSize * 0.85,
              background: `radial-gradient(ellipse at center, ${palette.glow.replace(")", " / 0.9)")} 0%, ${palette.glow.replace(")", " / 0.4)")} 45%, transparent 75%)`,
              transform: "translateX(-50%)",
              filter: "blur(3px)",
              opacity: 0.9,
              ["--flame-speed" as string]: `${speed * 1.3}s`,
            }}
          />
        )}

        {/* Rising ember — small particle floating up from the flame (Warm+) */}
        {isWarm && (
          <span
            className="absolute left-1/2 rounded-full pointer-events-none"
            style={{
              width: Math.max(1.4, flameSize * 0.09),
              height: Math.max(1.4, flameSize * 0.09),
              top: -2,
              background: palette.core,
              boxShadow: `0 0 ${flameSize * 0.35}px ${palette.glow}`,
              animation: loop(`flame-inline-ember-rise ${speed * 1.6}s ease-out infinite`),
              ["--ember-rise" as string]: `${flameSize * 0.9}px`,
            }}
          />
        )}


        {/* Outer flame body — teardrop with rim-light gradient */}
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
              ? `radial-gradient(ellipse at 50% 80%, ${palette.core} 0%, ${palette.mid} 32%, ${palette.outer} 68%, transparent 95%)`
              : "transparent",
            border: isHot ? "none" : `1.5px solid ${palette.outer}`,
            borderRadius: "50% 50% 50% 50% / 65% 65% 35% 35%",
            clipPath: "polygon(50% 0%, 95% 35%, 100% 70%, 80% 100%, 20% 100%, 0% 70%, 5% 35%)",
            boxShadow: isHot ? `0 0 ${flameSize * 0.7}px ${palette.glow}, 0 0 ${flameSize * 0.3}px ${palette.glow}` : undefined,
            ["--flame-speed" as string]: `${speed}s`,
          }}
        />

        {/* Subtle rim-light highlight on the left edge — gives volumetric feel */}
        {isHot && (
          <span
            className="absolute left-1/2 bottom-0 pointer-events-none"
            style={{
              width: flameSize,
              height: flameSize * 1.1,
              transform: "translateX(-50%)",
              background: `linear-gradient(115deg, ${palette.core.replace(")", " / 0.35)")} 0%, transparent 35%, transparent 65%, ${palette.outer.replace(")", " / 0.25)")} 100%)`,
              clipPath: "polygon(50% 0%, 95% 35%, 100% 70%, 80% 100%, 20% 100%, 0% 70%, 5% 35%)",
              mixBlendMode: "overlay",
              opacity: 0.7,
            }}
          />
        )}

        {/* White-hot inner core — On Fire+ */}
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

        {/* Inner fork — tiny secondary tongue inside the core (Blazing+) */}
        {isBlazing && (
          <span
            className="absolute left-1/2 bottom-0 animate-[flame-inline-fork_var(--fork-speed)_ease-in-out_infinite]"
            style={{
              width: flameSize * 0.18,
              height: flameSize * 0.42,
              transform: "translateX(-50%) translateX(-15%)",
              transformOrigin: "center bottom",
              background: palette.core,
              borderRadius: "50% 50% 50% 50% / 65% 65% 35% 35%",
              clipPath: "polygon(50% 0%, 95% 35%, 100% 70%, 80% 100%, 20% 100%, 0% 70%, 5% 35%)",
              opacity: 0.85,
              ["--fork-speed" as string]: `${speed * 0.45}s`,
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* Heart bloom — pulsing white-hot center (Blazing+, very subtle on small flames) */}
        {isBlazing && (
          <span
            aria-hidden
            className="absolute left-1/2 pointer-events-none rounded-full"
            style={{
              width: flameSize * 0.32,
              height: flameSize * 0.42,
              bottom: flameSize * 0.18,
              background: `radial-gradient(ellipse at 50% 60%, ${palette.core.replace(")", " / 0.95)")} 0%, ${palette.glow.replace(")", " / 0.5)")} 45%, transparent 78%)`,
              filter: `blur(${Math.max(1.5, flameSize * 0.05)}px)`,
              transform: "translateX(-50%)",
              mixBlendMode: "screen",
              animation: loop(`flame-heart-bloom ${(speed * 1.4).toFixed(2)}s ease-in-out infinite`),
            }}
          />
        )}

        {/* Spark dot — Diamond+ — now a wind-reactive ember instead of a static dot. */}
        {isDiamond && (
          <span
            className="flame-ember absolute rounded-full pointer-events-none"
            style={{
              width: Math.max(1.4, flameSize * 0.1),
              height: Math.max(1.4, flameSize * 0.1),
              left: "50%",
              bottom: flameSize * 0.6,
              background: palette.core,
              boxShadow: `0 0 ${flameSize * 0.35}px ${palette.glow}`,
              transform: "translateX(-50%)",
              opacity: 0,
              ["--ember-rise" as string]: `${-flameSize * 1.3}px`,
              animation: loop(`flame-ember-float ${(speed * 2.4).toFixed(2)}s ease-out infinite`),
            }}
          />
        )}

        {/* Second ember (Legendary+) — staggered for density. */}
        {isLegendary && (
          <span
            className="flame-ember absolute rounded-full pointer-events-none"
            style={{
              width: Math.max(1.2, flameSize * 0.08),
              height: Math.max(1.2, flameSize * 0.08),
              left: "55%",
              bottom: flameSize * 0.55,
              background: palette.core,
              boxShadow: `0 0 ${flameSize * 0.3}px ${palette.glow}`,
              transform: "translateX(-50%)",
              opacity: 0,
              ["--ember-rise" as string]: `${-flameSize * 1.6}px`,
              animation: loop(`flame-ember-float ${(speed * 2.8).toFixed(2)}s ease-out infinite`),
              animationDelay: `${(speed * 1.1).toFixed(2)}s`,
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
            // Hot tier numbers get a colored text-shadow trail
            textShadow:
              !countClassName && isOnFire
                ? `0 0 8px ${palette.glow.replace(")", " / 0.55)")}`
                : undefined,
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
