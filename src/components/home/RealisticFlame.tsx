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
  const speedMul = isLegendary ? 0.5 : isDiamond ? 0.65 : isBlazing ? 0.8 : isOnFire ? 0.95 : isWarm ? 1.2 : 1.5;

  // Detached "tongues" that rise off flame top — more, taller, with curve
  const tongueCount = isLegendary ? 9 : isDiamond ? 7 : isBlazing ? 5 : isOnFire ? 4 : isWarm ? 3 : 2;
  const tongues = useMemo(
    () =>
      Array.from({ length: tongueCount }).map((_, i) => ({
        delay: (i / Math.max(1, tongueCount)) * 1.4 + ((i * 0.13) % 0.7),
        duration: 1.3 + (i % 5) * 0.32,
        leftPct: 28 + ((i * 17) % 44),
        xDrift: -50 + (i % 2 === 0 ? -1 : 1) * (3 + (i * 7) % 16),
        size: 2.5 + (i % 4) * 0.8,
      })),
    [tongueCount],
  );

  // Sparks — pinpoint shots that fly out (Blazing+)
  const sparkCount = isLegendary ? 8 : isDiamond ? 6 : isBlazing ? 4 : 0;
  const sparks = useMemo(
    () =>
      Array.from({ length: sparkCount }).map((_, i) => ({
        leftPct: 30 + ((i * 23) % 40),
        delay: (i * 0.41) % 2.4,
        duration: 1.6 + (i % 3) * 0.4,
        x: -10 + (i % 5) * 5,
        y: -22 - (i % 4) * 6,
        size: 1 + (i % 2),
      })),
    [sparkCount],
  );

  // Smoke wisps (Champion+)
  const smokeCount = isLegendary ? 4 : isDiamond ? 3 : isBlazing ? 2 : 0;
  const smokes = useMemo(
    () =>
      Array.from({ length: smokeCount }).map((_, i) => ({
        delay: i * 1.3,
        duration: 3.2 + (i % 2) * 0.7,
        x: (i % 2 === 0 ? 1 : -1) * (4 + i * 3),
        leftPct: 40 + (i % 3) * 7,
      })),
    [smokeCount],
  );

  // Glowing coals at base
  const coalCount = isLegendary ? 9 : isDiamond ? 7 : isBlazing ? 6 : isOnFire ? 5 : isWarm ? 4 : isHot ? 3 : 0;
  const coals = useMemo(
    () =>
      Array.from({ length: coalCount }).map((_, i) => ({
        leftPct: 16 + (i * 68) / Math.max(1, coalCount - 1),
        delay: (i * 0.31) % 1.6,
        duration: 1.3 + (i % 4) * 0.35,
        size: 1.8 + (i % 3) * 0.7,
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
          <filter id={turb} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.022 0.05"
              numOctaves="3"
              seed="3"
            >
              <animate
                attributeName="baseFrequency"
                dur={`${3 * speedMul}s`}
                values="0.018 0.04;0.03 0.06;0.022 0.048;0.034 0.07;0.018 0.04"
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                dur={`${5 * speedMul}s`}
                values="3;14;7;21;3"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="4.5" />
          </filter>
          {/* Stronger warp for inner/core silhouette licking */}
          <filter id={turbStrong} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.045 0.09"
              numOctaves="3"
              seed="7"
            >
              <animate
                attributeName="baseFrequency"
                dur={`${2.2 * speedMul}s`}
                values="0.035 0.07;0.06 0.12;0.04 0.085;0.07 0.14;0.035 0.07"
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                dur={`${4 * speedMul}s`}
                values="7;19;31;5;7"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="3" />
          </filter>
        </defs>
      </svg>

      {/* Updraft cone — vertical hot air rising from base */}
      {isWarm && (
        <span
          className="flame-updraft absolute left-1/2 bottom-0 rounded-full pointer-events-none"
          style={{
            width: size * 0.7,
            height: size * 1.6,
            background: `radial-gradient(ellipse at 50% 100%, ${palette.outer.replace(")", " / 0.18)")} 0%, transparent 70%)`,
            filter: "blur(6px)",
            transformOrigin: "center bottom",
            animation: `flame-updraft ${2.2 * speedMul}s ease-out infinite`,
          }}
        />
      )}

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

      {/* Base fuel pool — pulsing puddle of light at the very bottom */}
      {isHot && (
        <span
          className="flame-base-glow absolute left-1/2 rounded-full pointer-events-none"
          style={{
            width: size * 0.85,
            height: size * 0.18,
            bottom: -2,
            background: `radial-gradient(ellipse at center, ${palette.coal} 0%, ${palette.outer.replace(")", " / 0.4)")} 50%, transparent 80%)`,
            filter: "blur(3px)",
            transform: "translateX(-50%)",
            animation: `flame-base-glow ${2 * speedMul}s ease-in-out infinite`,
            mixBlendMode: "screen",
          }}
        />
      )}
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

      {/* Sparks — pinpoint shots (Blazing+) */}
      {sparks.map((sp, i) => (
        <span
          key={`sp-${i}`}
          className="flame-spark absolute rounded-full pointer-events-none"
          style={{
            width: sp.size,
            height: sp.size,
            left: `${sp.leftPct}%`,
            top: size * 0.45,
            background: palette.core,
            boxShadow: `0 0 ${sp.size * 4}px ${palette.inner}, 0 0 ${sp.size * 8}px ${palette.mid}`,
            opacity: 0,
            // @ts-expect-error custom prop
            "--spark-x": `${sp.x}px`,
            ["--spark-y" as string]: `${sp.y}px`,
            animation: `flame-spark-shoot ${sp.duration * speedMul}s ease-out infinite`,
            animationDelay: `${sp.delay}s`,
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
