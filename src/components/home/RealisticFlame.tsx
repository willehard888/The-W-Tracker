import { useId, useMemo } from "react";
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
 * Cinematic multi-layer flame that genuinely *looks* alive:
 *  • SVG turbulence (feTurbulence + feDisplacementMap) warps each layer
 *    in real time so the silhouette breathes and licks the air.
 *  • Five stacked layers (haze → outer → mid → inner → core) each with
 *    their own flicker rhythm + skew + Y-jitter.
 *  • Detached tongues that rise and dissolve.
 *  • Glowing coal bed at the base.
 *  • Smoke wisps + heat-distortion (Champion+).
 *
 * The flame shape is a true candle silhouette: wide rounded base, tall
 * tapering body, hooked tip — drawn with cubic Béziers, not lucide-react.
 */
const RealisticFlame = ({ tier, accent, size = 44, className }: RealisticFlameProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const isHot = tier >= 0;
  const isWarm = tier >= 1;
  const isOnFire = tier >= 2;
  const isBlazing = tier >= 3;
  const isDiamond = tier >= 4;
  const isLegendary = tier >= 5;

  /* ── Tier-driven palette: hotter → whiter core, richer outer ─────── */
  const palette = useMemo(() => {
    if (isLegendary) {
      return {
        haze: "hsl(280 80% 55%)",
        outer: "hsl(300 75% 60%)",
        mid: "hsl(35 100% 60%)",
        inner: "hsl(48 100% 75%)",
        core: "hsl(60 100% 95%)",
        coal: "hsl(18 95% 55%)",
      };
    }
    if (isDiamond) {
      return {
        haze: "hsl(200 85% 50%)",
        outer: "hsl(190 90% 60%)",
        mid: "hsl(40 95% 60%)",
        inner: "hsl(48 100% 74%)",
        core: "hsl(58 100% 92%)",
        coal: "hsl(28 95% 55%)",
      };
    }
    if (isBlazing) {
      return {
        haze: "hsl(22 95% 45%)",
        outer: "hsl(28 95% 52%)",
        mid: "hsl(40 95% 60%)",
        inner: "hsl(48 100% 70%)",
        core: "hsl(56 100% 88%)",
        coal: "hsl(18 95% 50%)",
      };
    }
    if (isOnFire) {
      return {
        haze: "hsl(12 90% 42%)",
        outer: "hsl(16 92% 50%)",
        mid: "hsl(28 95% 58%)",
        inner: "hsl(42 100% 65%)",
        core: "hsl(48 100% 82%)",
        coal: "hsl(14 90% 48%)",
      };
    }
    if (isWarm) {
      return {
        haze: "hsl(10 85% 40%)",
        outer: "hsl(14 88% 48%)",
        mid: "hsl(20 92% 56%)",
        inner: "hsl(32 95% 62%)",
        core: "hsl(42 100% 78%)",
        coal: "hsl(12 85% 45%)",
      };
    }
    return {
      haze: "hsl(8 80% 36%)",
      outer: accent,
      mid: "hsl(18 90% 55%)",
      inner: "hsl(28 95% 62%)",
      core: "hsl(42 100% 75%)",
      coal: "hsl(12 80% 42%)",
    };
  }, [tier, accent, isWarm, isOnFire, isBlazing, isDiamond, isLegendary]);

  // Higher tier = faster flicker
  const speedMul = isLegendary ? 0.55 : isDiamond ? 0.7 : isBlazing ? 0.85 : isOnFire ? 1 : isWarm ? 1.25 : 1.55;

  // Detached "tongues" that rise off flame top
  const tongueCount = isLegendary ? 6 : isDiamond ? 5 : isBlazing ? 4 : isOnFire ? 3 : isWarm ? 2 : 1;
  const tongues = useMemo(
    () =>
      Array.from({ length: tongueCount }).map((_, i) => ({
        delay: (i / Math.max(1, tongueCount)) * 1.4 + ((i * 0.17) % 0.5),
        duration: 1.1 + (i % 4) * 0.3,
        leftPct: 32 + ((i * 19) % 36),
        xDrift: -50 + (i % 2 === 0 ? -1 : 1) * (4 + (i * 5) % 14),
        size: 3 + (i % 3),
      })),
    [tongueCount],
  );

  // Smoke wisps (Champion+)
  const smokeCount = isLegendary ? 3 : isDiamond ? 2 : isBlazing ? 1 : 0;
  const smokes = useMemo(
    () =>
      Array.from({ length: smokeCount }).map((_, i) => ({
        delay: i * 1.6,
        duration: 3.2 + (i % 2) * 0.7,
        x: (i % 2 === 0 ? 1 : -1) * (5 + i * 3),
        leftPct: 42 + (i % 3) * 8,
      })),
    [smokeCount],
  );

  // Glowing coals at base
  const coalCount = isLegendary ? 7 : isDiamond ? 6 : isBlazing ? 5 : isOnFire ? 4 : isWarm ? 3 : isHot ? 2 : 0;
  const coals = useMemo(
    () =>
      Array.from({ length: coalCount }).map((_, i) => ({
        leftPct: 18 + (i * 64) / Math.max(1, coalCount - 1),
        delay: (i * 0.35) % 1.4,
        duration: 1.4 + (i % 3) * 0.4,
        size: 2 + (i % 3),
      })),
    [coalCount],
  );

  if (!isHot) {
    // Cold / unlit state — soft outline
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 56"
        className={cn("opacity-50", className)}
        fill="none"
      >
        <path
          d="M20 4 C 23 12, 30 18, 30 30 C 30 42, 25 50, 20 53 C 15 50, 10 42, 10 30 C 10 18, 17 12, 20 4 Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // True candle-flame silhouette: wide rounded base, tapering S-curved sides, hooked tip
  const FLAME_PATH =
    "M20 3 C 21 9, 24 13, 26 18 C 29 24, 31 30, 30 36 C 29 43, 25 49, 20 52 C 15 49, 11 43, 10 36 C 9 30, 11 24, 14 18 C 16 13, 19 9, 20 3 Z";

  // Filter ids unique per instance
  const turb = `turb-${uid}`;
  const turbStrong = `turbStrong-${uid}`;

  return (
    <div
      className={cn("relative pointer-events-none", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* SVG defs (turbulence filters shared by all layers) */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          {/* Subtle warp for outer/mid */}
          <filter id={turb} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.022 0.045"
              numOctaves="2"
              seed="3"
            >
              <animate
                attributeName="baseFrequency"
                dur={`${3.2 * speedMul}s`}
                values="0.018 0.04;0.028 0.055;0.02 0.042;0.018 0.04"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="3.5" />
          </filter>
          {/* Stronger warp for inner/core silhouette licking */}
          <filter id={turbStrong} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04 0.08"
              numOctaves="2"
              seed="7"
            >
              <animate
                attributeName="baseFrequency"
                dur={`${2.4 * speedMul}s`}
                values="0.035 0.07;0.055 0.1;0.04 0.08;0.035 0.07"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="2.2" />
          </filter>
        </defs>
      </svg>

      {/* Heat distortion */}
      <span
        className="flame-heat absolute left-1/2 bottom-0 rounded-full"
        style={{
          width: size * 1.05,
          height: size * 1.15,
          background: `radial-gradient(ellipse at 50% 75%, ${palette.outer.replace(")", " / 0.22)")}, transparent 70%)`,
          filter: "blur(8px)",
          animation: `flame-heat-distort ${1.6 * speedMul}s ease-in-out infinite`,
          transformOrigin: "center bottom",
        }}
      />

      {/* Outer haze */}
      <svg
        className="flame-outer absolute left-1/2 bottom-[-2px]"
        width={size * 1.2}
        height={size * 1.25}
        viewBox="0 0 40 56"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-outer-flicker ${1.7 * speedMul}s ease-in-out infinite`,
          mixBlendMode: "screen",
          filter: `url(#${turb}) blur(2px)`,
        }}
      >
        <defs>
          <radialGradient id={`outerG-${uid}`} cx="50%" cy="80%" r="62%">
            <stop offset="0%"   stopColor={palette.outer} stopOpacity="0.55" />
            <stop offset="55%"  stopColor={palette.haze}  stopOpacity="0.4" />
            <stop offset="100%" stopColor={palette.haze}  stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={FLAME_PATH} fill={`url(#outerG-${uid})`} />
      </svg>

      {/* Mid tongue — main warm body */}
      <svg
        className="flame-mid absolute left-1/2 bottom-0"
        width={size * 0.9}
        height={size * 1.05}
        viewBox="0 0 40 56"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-mid-flicker ${1.05 * speedMul}s ease-in-out infinite`,
          filter: `url(#${turb}) drop-shadow(0 0 6px ${palette.mid})`,
          mixBlendMode: "screen",
        }}
      >
        <defs>
          <linearGradient id={`midG-${uid}`} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"   stopColor={palette.coal}  stopOpacity="0.95" />
            <stop offset="35%"  stopColor={palette.mid}   stopOpacity="0.98" />
            <stop offset="70%"  stopColor={palette.inner} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={FLAME_PATH} fill={`url(#midG-${uid})`} />
      </svg>

      {/* Inner body */}
      <svg
        className="flame-inner absolute left-1/2 bottom-1"
        width={size * 0.62}
        height={size * 0.85}
        viewBox="0 0 40 56"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-inner-flicker ${0.8 * speedMul}s ease-in-out infinite`,
          filter: `url(#${turbStrong}) drop-shadow(0 0 5px ${palette.inner})`,
          mixBlendMode: "screen",
        }}
      >
        <defs>
          <linearGradient id={`innerG-${uid}`} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"   stopColor={palette.mid}   stopOpacity="0.95" />
            <stop offset="50%"  stopColor={palette.inner} stopOpacity="1" />
            <stop offset="100%" stopColor={palette.core}  stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path d={FLAME_PATH} fill={`url(#innerG-${uid})`} />
      </svg>

      {/* White-hot core */}
      <svg
        className="flame-core absolute left-1/2 bottom-2"
        width={size * 0.34}
        height={size * 0.6}
        viewBox="0 0 40 56"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "center bottom",
          animation: `flame-core-flicker ${0.6 * speedMul}s ease-in-out infinite`,
          filter: `url(#${turbStrong}) drop-shadow(0 0 4px ${palette.core})`,
          mixBlendMode: "screen",
        }}
      >
        <defs>
          <radialGradient id={`coreG-${uid}`} cx="50%" cy="78%" r="60%">
            <stop offset="0%"   stopColor={palette.core}  stopOpacity="1" />
            <stop offset="65%"  stopColor={palette.inner} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.mid}   stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="20" cy="36" rx="8" ry="16" fill={`url(#coreG-${uid})`} />
      </svg>

      {/* Detached tongues rising off the tip */}
      {tongues.map((t, i) => (
        <span
          key={`t-${i}`}
          className="flame-tongue absolute rounded-full"
          style={{
            width: t.size,
            height: t.size * 1.7,
            left: `${t.leftPct}%`,
            top: 2,
            background: `radial-gradient(circle at 50% 70%, ${palette.core}, ${palette.inner} 50%, transparent 80%)`,
            boxShadow: `0 0 ${t.size * 2.5}px ${palette.inner}`,
            opacity: 0,
            // @ts-expect-error custom prop
            "--tongue-x": `${t.xDrift}%`,
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
          className="flame-smoke absolute rounded-full"
          style={{
            width: 9,
            height: 9,
            left: `${s.leftPct}%`,
            top: -6,
            background: "radial-gradient(circle, hsl(0 0% 75% / 0.4), transparent 70%)",
            filter: "blur(4px)",
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
            boxShadow: `0 0 ${c.size * 2.5}px ${palette.coal}`,
            animation: `flame-coal-pulse ${c.duration}s ease-in-out infinite`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default RealisticFlame;
