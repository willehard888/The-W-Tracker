import { useId, useMemo } from "react";
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
 * Compact, alive flame for inline placements (headers, post meta, lightbox).
 * Same cinematic idea as RealisticFlame — tier palette, layered SVG, turbulence
 * warp — but stripped to two layers and sized for 10–20px contexts so it
 * actually reads at small sizes.
 *
 * Size grows with streak length so a 100d streak gets a noticeably bigger,
 * richer flame than a 3d one.
 */
const StreakFlameInline = ({
  streak,
  size,
  showCount = true,
  suffix = "",
  className,
  countClassName,
}: StreakFlameInlineProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

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

  // Speed scales with intensity
  const speedMul =
    isLegendary ? 0.6 :
    isDiamond   ? 0.75 :
    isBlazing   ? 0.9 :
    isOnFire    ? 1.05 :
    isWarm      ? 1.3 : 1.6;

  // True candle silhouette (matches RealisticFlame)
  const FLAME_PATH =
    "M20 3 C 21 9, 24 13, 26 18 C 29 24, 31 30, 30 36 C 29 43, 25 49, 20 52 C 15 49, 11 43, 10 36 C 9 30, 11 24, 14 18 C 16 13, 19 9, 20 3 Z";

  const turb = `inline-turb-${uid}`;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 leading-none align-middle", className)}
    >
      <span
        className="relative inline-block shrink-0"
        style={{ width: flameSize, height: flameSize * 1.1 }}
        aria-hidden
      >
        {isHot && (
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <filter id={turb} x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035 0.07" numOctaves="3" seed="5">
                  <animate
                    attributeName="baseFrequency"
                    dur={`${2.4 * speedMul}s`}
                    values="0.025 0.05;0.05 0.1;0.03 0.06;0.025 0.05"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="seed"
                    dur={`${4 * speedMul}s`}
                    values="5;17;9;5"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" scale="2.6" />
              </filter>
            </defs>
          </svg>
        )}

        {/* Updraft cone (Warm+) */}
        {isWarm && (
          <span
            className="absolute left-1/2 bottom-0 rounded-full pointer-events-none"
            style={{
              width: flameSize * 0.7,
              height: flameSize * 1.5,
              background: `radial-gradient(ellipse at 50% 100%, ${palette.glow.replace(")", " / 0.22)")} 0%, transparent 70%)`,
              filter: "blur(4px)",
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              animation: `flame-updraft ${2.2 * speedMul}s ease-out infinite`,
            }}
          />
        )}

        {/* Halo glow under flame (Warm+) */}
        {isWarm && (
          <span
            className="absolute left-1/2 bottom-0 rounded-full pointer-events-none"
            style={{
              width: flameSize * 1.1,
              height: flameSize * 0.5,
              background: `radial-gradient(ellipse at center, ${palette.glow} 0%, transparent 70%)`,
              transform: "translateX(-50%)",
              filter: "blur(3px)",
              opacity: 0.6,
              animation: `flame-base-glow ${1.8 * speedMul}s ease-in-out infinite`,
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* Outer flame body */}
        <svg
          className="absolute left-1/2 bottom-0"
          width={flameSize}
          height={flameSize * 1.1}
          viewBox="0 0 40 56"
          style={{
            transform: "translateX(-50%)",
            transformOrigin: "center bottom",
            animation: isHot
              ? `flame-mid-flicker ${1.05 * speedMul}s ease-in-out infinite`
              : undefined,
            filter: isHot ? `url(#${turb}) drop-shadow(0 0 ${flameSize * 0.4}px ${palette.glow})` : undefined,
            mixBlendMode: isHot ? "screen" : undefined,
          }}
        >
          <defs>
            <linearGradient id={`outer-${uid}`} x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%"  stopColor={palette.outer} stopOpacity="0.95" />
              <stop offset="55%" stopColor={palette.mid}   stopOpacity="0.95" />
              <stop offset="100%" stopColor={palette.core} stopOpacity={isHot ? "0.6" : "0"} />
            </linearGradient>
          </defs>
          <path
            d={FLAME_PATH}
            fill={isHot ? `url(#outer-${uid})` : "none"}
            stroke={isHot ? "none" : "currentColor"}
            strokeWidth={isHot ? 0 : 2}
            strokeLinejoin="round"
          />
        </svg>

        {/* White-hot core (On Fire+) */}
        {isOnFire && (
          <svg
            className="absolute left-1/2 bottom-[1px]"
            width={flameSize * 0.55}
            height={flameSize * 0.75}
            viewBox="0 0 40 56"
            style={{
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              animation: `flame-core-flicker ${0.65 * speedMul}s ease-in-out infinite`,
              filter: `url(#${turb}) drop-shadow(0 0 ${flameSize * 0.3}px ${palette.core})`,
              mixBlendMode: "screen",
            }}
          >
            <defs>
              <radialGradient id={`core-${uid}`} cx="50%" cy="78%" r="60%">
                <stop offset="0%"   stopColor={palette.core} stopOpacity="1" />
                <stop offset="65%"  stopColor={palette.mid}  stopOpacity="0.7" />
                <stop offset="100%" stopColor={palette.mid}  stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="20" cy="36" rx="8" ry="16" fill={`url(#core-${uid})`} />
          </svg>
        )}

        {/* Spark tongues (Blazing+) — multiple, randomized */}
        {isBlazing && Array.from({ length: isLegendary ? 4 : isDiamond ? 3 : 2 }).map((_, i) => (
          <span
            key={`tongue-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 1.5 + (i % 2) * 0.5,
              height: 2.5,
              left: `${42 + i * 8}%`,
              top: 0,
              background: `radial-gradient(circle, ${palette.core}, ${palette.mid} 50%, transparent 80%)`,
              boxShadow: `0 0 4px ${palette.core}`,
              opacity: 0,
              ["--tongue-x" as string]: `${-50 + (i % 2 === 0 ? -1 : 1) * (3 + i * 4)}%`,
              animation: `flame-tongue-rise ${(1.3 + i * 0.2) * speedMul}s ease-out infinite`,
              animationDelay: `${i * 0.35}s`,
              mixBlendMode: "screen",
            }}
          />
        ))}

        {/* Tiny sparks (Diamond+) */}
        {isDiamond && Array.from({ length: isLegendary ? 4 : 3 }).map((_, i) => (
          <span
            key={`sp-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 1,
              height: 1,
              left: `${35 + i * 10}%`,
              top: flameSize * 0.5,
              background: palette.core,
              boxShadow: `0 0 3px ${palette.mid}`,
              opacity: 0,
              ["--spark-x" as string]: `${-4 + i * 3}px`,
              ["--spark-y" as string]: `${-14 - i * 3}px`,
              animation: `flame-spark-shoot ${(1.6 + i * 0.3) * speedMul}s ease-out infinite`,
              animationDelay: `${i * 0.4}s`,
              mixBlendMode: "screen",
            }}
          />
        ))}
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
