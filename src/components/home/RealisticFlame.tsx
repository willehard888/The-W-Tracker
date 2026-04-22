import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface RealisticFlameProps {
  /** 0-5 — controls intensity, color richness, particle counts */
  tier: number;
  /** Outer accent color (hsl string) */
  accent: string;
  /** Pixel size of the flame container */
  size?: number;
  className?: string;
}

/**
 * A multi-layer SVG flame that flickers asymmetrically:
 *   – outer halo (blurred, soft)
 *   – mid tongue (warm)
 *   – inner body (bright)
 *   – hot core (white-hot)
 *   – random tongues that detach and rise
 *   – ember bed at base
 *   – smoke wisps + heat distortion (higher tiers)
 *
 * Each layer animates independently so the fire never looks "in sync".
 */
const RealisticFlame = ({ tier, accent, size = 44, className }: RealisticFlameProps) => {
  const isHot = tier >= 0;
  const isWarm = tier >= 1;
  const isOnFire = tier >= 2;
  const isBlazing = tier >= 3;
  const isDiamond = tier >= 4;
  const isLegendary = tier >= 5;

  // Tier-driven flame palette — hotter = whiter core, richer outer
  const palette = useMemo(() => {
    if (isLegendary) {
      return {
        outer: "hsl(280 80% 60%)",
        mid: "hsl(42 95% 60%)",
        inner: "hsl(48 100% 72%)",
        core: "hsl(60 100% 92%)",
        coal: "hsl(18 95% 55%)",
      };
    }
    if (isDiamond) {
      return {
        outer: "hsl(200 85% 60%)",
        mid: "hsl(42 90% 62%)",
        inner: "hsl(48 100% 72%)",
        core: "hsl(60 100% 92%)",
        coal: "hsl(28 95% 58%)",
      };
    }
    if (isBlazing) {
      return {
        outer: "hsl(28 95% 50%)",
        mid: "hsl(42 95% 60%)",
        inner: "hsl(48 100% 70%)",
        core: "hsl(56 100% 88%)",
        coal: "hsl(18 95% 55%)",
      };
    }
    if (isOnFire) {
      return {
        outer: "hsl(14 90% 48%)",
        mid: "hsl(28 95% 58%)",
        inner: "hsl(42 100% 65%)",
        core: "hsl(48 100% 82%)",
        coal: "hsl(14 90% 50%)",
      };
    }
    if (isWarm) {
      return {
        outer: "hsl(12 85% 45%)",
        mid: "hsl(20 90% 55%)",
        inner: "hsl(32 95% 62%)",
        core: "hsl(42 100% 78%)",
        coal: "hsl(12 85% 48%)",
      };
    }
    return {
      outer: accent,
      mid: "hsl(18 90% 55%)",
      inner: "hsl(28 95% 62%)",
      core: "hsl(42 100% 75%)",
      coal: "hsl(12 80% 45%)",
    };
  }, [tier, accent, isHot, isWarm, isOnFire, isBlazing, isDiamond, isLegendary]);

  // Faster flicker = hotter
  const speedMul = isLegendary ? 0.6 : isDiamond ? 0.7 : isBlazing ? 0.85 : isOnFire ? 1 : isWarm ? 1.25 : 1.6;

  // Detached "tongues" rising off flame top
  const tongueCount = isLegendary ? 5 : isDiamond ? 4 : isBlazing ? 3 : isOnFire ? 2 : isWarm ? 1 : 0;
  const tongues = useMemo(
    () =>
      Array.from({ length: tongueCount }).map((_, i) => ({
        delay: (i / Math.max(1, tongueCount)) * 1.2 + (i * 0.13) % 0.4,
        duration: 1.3 + (i % 3) * 0.35,
        xPct: 38 + ((i * 17) % 28),
        x: -50 + (i % 2 === 0 ? -1 : 1) * (3 + (i * 5) % 12), // px drift
        size: 4 + (i % 3),
      })),
    [tongueCount],
  );

  // Smoke wisps (Champion+)
  const smokeCount = isLegendary ? 3 : isDiamond ? 2 : isBlazing ? 1 : 0;
  const smokes = useMemo(
    () =>
      Array.from({ length: smokeCount }).map((_, i) => ({
        delay: i * 1.4,
        duration: 3 + (i % 2) * 0.8,
        x: (i % 2 === 0 ? 1 : -1) * (6 + i * 4),
      })),
    [smokeCount],
  );

  // Coals at base
  const coalCount = isLegendary ? 6 : isDiamond ? 5 : isBlazing ? 4 : isOnFire ? 3 : isWarm ? 2 : isHot ? 1 : 0;
  const coals = useMemo(
    () =>
      Array.from({ length: coalCount }).map((_, i) => ({
        leftPct: 22 + (i * 56) / Math.max(1, coalCount - 1 || 1),
        delay: (i * 0.4) % 1.2,
        size: 3 + (i % 2),
      })),
    [coalCount],
  );

  if (!isHot) {
    // Cold / unlit state — simple outline
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 50"
        className={cn("opacity-60", className)}
        fill="none"
      >
        <path
          d="M20 4 C 24 12, 30 16, 30 26 C 30 34, 25 42, 20 46 C 15 42, 10 34, 10 26 C 10 16, 16 12, 20 4 Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <div
      className={cn("relative pointer-events-none", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Heat distortion behind flame */}
      <span
        className="flame-heat absolute left-1/2 bottom-0 rounded-full"
        style={{
          width: size * 0.9,
          height: size * 1.05,
          background: `radial-gradient(ellipse at 50% 80%, ${palette.outer.replace(")", " / 0.22)")}, transparent 70%)`,
          filter: "blur(6px)",
          animation: `flame-heat-distort ${1.4 * speedMul}s ease-in-out infinite`,
          transformOrigin: "center bottom",
        }}
      />

      {/* Outer halo flame */}
      <svg
        className="flame-outer absolute left-1/2 bottom-0"
        width={size * 1.05}
        height={size * 1.1}
        viewBox="0 0 40 50"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-outer-flicker ${1.6 * speedMul}s ease-in-out infinite`,
          mixBlendMode: "screen",
        }}
      >
        <defs>
          <radialGradient id={`outerGrad-${tier}`} cx="50%" cy="80%" r="60%">
            <stop offset="0%"   stopColor={palette.mid}   stopOpacity="0.8" />
            <stop offset="60%"  stopColor={palette.outer} stopOpacity="0.55" />
            <stop offset="100%" stopColor={palette.outer} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d="M20 2 C 26 12, 33 18, 33 28 C 33 38, 27 47, 20 49 C 13 47, 7 38, 7 28 C 7 18, 14 12, 20 2 Z"
          fill={`url(#outerGrad-${tier})`}
        />
      </svg>

      {/* Mid tongue */}
      <svg
        className="flame-mid absolute left-1/2 bottom-0"
        width={size * 0.85}
        height={size * 0.95}
        viewBox="0 0 40 50"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-mid-flicker ${1.1 * speedMul}s ease-in-out infinite`,
          filter: `drop-shadow(0 0 6px ${palette.mid})`,
          mixBlendMode: "screen",
        }}
      >
        <defs>
          <linearGradient id={`midGrad-${tier}`} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"   stopColor={palette.coal} stopOpacity="0.95" />
            <stop offset="40%"  stopColor={palette.mid}  stopOpacity="0.95" />
            <stop offset="80%"  stopColor={palette.inner} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M20 6 C 23 14, 28 20, 28 30 C 28 38, 24 45, 20 48 C 16 45, 12 38, 12 30 C 12 20, 17 14, 20 6 Z"
          fill={`url(#midGrad-${tier})`}
        />
      </svg>

      {/* Inner body */}
      <svg
        className="flame-inner absolute left-1/2 bottom-0"
        width={size * 0.6}
        height={size * 0.78}
        viewBox="0 0 40 50"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-inner-flicker ${0.85 * speedMul}s ease-in-out infinite`,
          filter: `drop-shadow(0 0 4px ${palette.inner})`,
          mixBlendMode: "screen",
        }}
      >
        <defs>
          <linearGradient id={`innerGrad-${tier}`} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"   stopColor={palette.mid}   stopOpacity="0.95" />
            <stop offset="50%"  stopColor={palette.inner} stopOpacity="1" />
            <stop offset="100%" stopColor={palette.core}  stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          d="M20 10 C 22 16, 25 22, 25 30 C 25 36, 22 42, 20 46 C 18 42, 15 36, 15 30 C 15 22, 18 16, 20 10 Z"
          fill={`url(#innerGrad-${tier})`}
        />
      </svg>

      {/* White-hot core */}
      <svg
        className="flame-core absolute left-1/2 bottom-1"
        width={size * 0.32}
        height={size * 0.55}
        viewBox="0 0 40 50"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-core-flicker ${0.65 * speedMul}s ease-in-out infinite`,
          filter: `drop-shadow(0 0 4px ${palette.core})`,
          mixBlendMode: "screen",
        }}
      >
        <defs>
          <radialGradient id={`coreGrad-${tier}`} cx="50%" cy="80%" r="60%">
            <stop offset="0%"   stopColor={palette.core}  stopOpacity="1" />
            <stop offset="70%"  stopColor={palette.inner} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.mid}   stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="20" cy="32" rx="8" ry="14" fill={`url(#coreGrad-${tier})`} />
      </svg>

      {/* Detached tongues rising */}
      {tongues.map((t, i) => (
        <span
          key={`t-${i}`}
          className="flame-tongue absolute rounded-full"
          style={{
            width: t.size,
            height: t.size * 1.6,
            left: `${t.xPct}%`,
            top: 4,
            background: `radial-gradient(circle at 50% 70%, ${palette.core}, ${palette.inner} 50%, transparent 80%)`,
            boxShadow: `0 0 ${t.size * 2}px ${palette.inner}`,
            opacity: 0,
            // @ts-expect-error custom prop
            "--tongue-x": `${t.x}%`,
            animation: `flame-tongue-rise ${t.duration * speedMul}s ease-out infinite`,
            animationDelay: `${t.delay}s`,
            mixBlendMode: "screen",
          }}
        />
      ))}

      {/* Smoke wisps (Champion+) */}
      {smokes.map((s, i) => (
        <span
          key={`s-${i}`}
          className="flame-smoke absolute left-1/2 rounded-full"
          style={{
            width: 8,
            height: 8,
            top: -4,
            background: "radial-gradient(circle, hsl(0 0% 70% / 0.35), transparent 70%)",
            filter: "blur(3px)",
            opacity: 0,
            // @ts-expect-error custom prop
            "--smoke-x": `${s.x}px`,
            animation: `flame-smoke-rise ${s.duration}s ease-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Coal bed at base */}
      {coals.map((c, i) => (
        <span
          key={`c-${i}`}
          className="flame-coal absolute rounded-full"
          style={{
            width: c.size,
            height: c.size,
            left: `${c.leftPct}%`,
            bottom: 0,
            background: palette.coal,
            boxShadow: `0 0 ${c.size * 2}px ${palette.coal}`,
            animation: `flame-coal-pulse ${1.6 + (i % 3) * 0.4}s ease-in-out infinite`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default RealisticFlame;
