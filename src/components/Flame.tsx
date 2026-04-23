import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getTierConfig, type StatusTier } from "@/lib/status-tiers";

type StatusInput = number | StatusTier | string;

interface FlameProps {
  /**
   * Either a 0..1 number (overall "status health") or a tier string.
   * Higher = bigger, more stable. Lower = smaller, more flickering.
   * Values <= 0.12 read as "near loss" — the flame nearly dies.
   */
  status: StatusInput;
  /** Pixel size of the flame container (height ~ 1.4× width). */
  size?: number;
  /** Optional override label for screen readers. */
  label?: string;
  className?: string;
}

const TIER_TO_STATUS: Record<string, number> = {
  recruit: 0.18,
  normal: 0.18,
  operator: 0.36,
  performer: 0.5,
  high_performer: 0.66,
  elite: 0.8,
  apex: 0.92,
  legend: 1,
};

const resolveStatus = (input: StatusInput): number => {
  if (typeof input === "number") {
    if (Number.isNaN(input)) return 0.2;
    return Math.max(0, Math.min(1, input));
  }
  return TIER_TO_STATUS[input] ?? 0.2;
};

/**
 * <Flame status={value} /> — small, realistic, alive.
 *
 *  Goal: make users *feel* their status. Higher status = bigger, steadier,
 *  more saturated flame. Lower status = smaller, jittery, almost dying.
 *
 *  Construction (intentionally minimal — three layers, one filter):
 *    1. Soft outer glow (the heat halo)
 *    2. Body — gradient flame with SVG turbulence displacement
 *    3. White-hot core (only visible above mid status)
 *    + base ember dot when status > 0.4
 *
 *  Per-instance random seeds + offsets prevent any visible loop.
 */
const Flame = ({ status, size = 28, label, className }: FlameProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const s = resolveStatus(status);

  // Status bands → behavior
  const isDying = s <= 0.12;
  const isWeak = s < 0.35;
  const isStrong = s >= 0.65;
  const isPeak = s >= 0.9;

  // Visual scale: weak flames are smaller, peak flames burn taller
  const heightScale = 0.55 + s * 0.55; // 0.55..1.10
  const widthScale = 0.6 + s * 0.4; // 0.6..1.0

  // Flicker speed: lower status = faster, more chaotic flicker
  // Higher status = slower, more confident burn
  const flickerSpeed = 1.7 - s * 0.95; // ~1.7s (dying) → ~0.75s (peak)
  const turbSpeed = 2.2 - s * 1.2; // 2.2..1.0
  // Displacement scale → instability (jaggedness of edges)
  const displaceBase = 1.6 + (1 - s) * 4.4; // peak: 1.6, dying: 6.0
  const displacePeak = displaceBase * 1.45;

  // Per-instance random offsets so two flames side-by-side never sync
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    return {
      bodyDelay: -((h % 1700) / 1000), // negative delay → starts mid-loop
      coreDelay: -(((h >> 4) % 1300) / 1000),
      seedA: (h % 30) + 1,
      seedB: ((h >> 8) % 40) + 5,
    };
  }, [uid]);

  // Color recipe — natural fire (red base → orange mid → yellow tip → white core)
  // We desaturate slightly when dying so the flame looks cooler/sicker.
  const sat = isDying ? 75 : isWeak ? 88 : 100;
  const palette = {
    base: `hsl(8 ${sat}% ${isDying ? 38 : 45}%)`, // deep red coal
    mid: `hsl(20 ${sat}% ${isDying ? 48 : 55}%)`, // orange body
    tip: `hsl(42 ${sat}% ${isDying ? 60 : 68}%)`, // yellow tip
    core: `hsl(54 100% ${isDying ? 78 : 88}%)`, // white-hot
    halo: `hsl(18 ${sat}% 50%)`,
  };

  // Authentic candle silhouette
  const FLAME_PATH =
    "M20 4 C 22 11, 26 16, 28 22 C 30 28, 30 35, 28 41 C 26 47, 23 51, 20 53 C 17 51, 14 47, 12 41 C 10 35, 10 28, 12 22 C 14 16, 18 11, 20 4 Z";

  const filterId = `flame-turb-${uid}`;
  const bodyGradId = `flame-body-${uid}`;
  const coreGradId = `flame-core-${uid}`;

  // Width / height of the visible flame
  const w = size * widthScale;
  const h = size * 1.4 * heightScale;

  // Wind reactivity — same global vars all flames in the app share.
  // Stronger flames lean more (heavier flame head catches more wind).
  const windTransform =
    `rotate(calc(var(--wind-x, 0) * ${(2 + s * 2).toFixed(2)}deg + var(--wind-gust, 0) * 3deg)) ` +
    `translateX(calc(var(--wind-x, 0) * ${(0.4 + s * 0.6).toFixed(2)}px))`;

  // Breathing — only for strong+ flames; weak/dying flames stay still (a dying
  // flame doesn't have the energy to breathe deeply).
  const breathAnim = isStrong
    ? `flame-breathe ${(flickerSpeed * 4.5).toFixed(2)}s ease-in-out infinite`
    : undefined;

  return (
    <span
      className={cn(
        "relative inline-block align-middle pointer-events-none select-none",
        className,
      )}
      style={{
        width: size,
        height: size * 1.4,
        transform: windTransform,
        transformOrigin: "center bottom",
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* SVG filter defs — turbulence makes edges shimmer like real fire */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <filter
            id={filterId}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.028 0.06"
              numOctaves="2"
              seed={seed.seedA}
            >
              <animate
                attributeName="baseFrequency"
                dur={`${turbSpeed.toFixed(2)}s`}
                values={
                  isDying
                    ? "0.04 0.09;0.075 0.16;0.05 0.11;0.085 0.18;0.04 0.09"
                    : "0.024 0.055;0.04 0.085;0.026 0.06;0.045 0.09;0.024 0.055"
                }
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                dur={`${(turbSpeed * 2.3).toFixed(2)}s`}
                values={`${seed.seedA};${seed.seedB};${seed.seedA + 7};${seed.seedB + 3};${seed.seedA}`}
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic">
              <animate
                attributeName="scale"
                dur={`${(turbSpeed * 1.4).toFixed(2)}s`}
                values={`${displaceBase};${displacePeak};${displaceBase * 0.85};${displacePeak * 1.05};${displaceBase}`}
                repeatCount="indefinite"
              />
            </feDisplacementMap>
          </filter>
          <linearGradient id={bodyGradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor={palette.base} stopOpacity={isDying ? 0.6 : 0.95} />
            <stop offset="40%" stopColor={palette.mid} stopOpacity="0.95" />
            <stop offset="80%" stopColor={palette.tip} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.tip} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={coreGradId} cx="50%" cy="65%" r="40%">
            <stop offset="0%" stopColor={palette.core} stopOpacity="1" />
            <stop offset="60%" stopColor={palette.tip} stopOpacity="0.55" />
            <stop offset="100%" stopColor={palette.tip} stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Cast shadow — dark elliptical shadow projected BEHIND the flame.
          Doesn't use screen blend → actually darkens what's behind it.
          Always rendered (even dying flames cast a small shadow). */}
      <span
        aria-hidden
        className="absolute left-1/2 rounded-[50%] pointer-events-none"
        style={{
          width: w * 2.0,
          height: w * 0.4,
          bottom: -size * 0.04,
          background: `radial-gradient(ellipse at 50% 50%, hsl(0 0% 0% / ${(0.28 + s * 0.18).toFixed(2)}) 0%, hsl(0 0% 0% / 0.18) 45%, transparent 78%)`,
          filter: `blur(${Math.max(5, size * 0.13)}px)`,
          transform: "translateX(-50%)",
          transformOrigin: "50% 50%",
          animation: `flame-shadow-pulse ${(flickerSpeed * 4.4).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${seed.bodyDelay}s`,
          zIndex: -1,
        }}
      />

      {/* Volumetric ground-cast — projects warm light onto the surface BELOW
          the flame. Only when alive enough to actually radiate. */}
      {!isDying && !isWeak && (
        <span
          className="flame-ground-cast absolute left-1/2 rounded-[50%] pointer-events-none"
          style={{
            width: w * 2.4,
            height: w * 0.45,
            bottom: -size * 0.06,
            background: `radial-gradient(ellipse at 50% 50%, ${palette.halo.replace(")", " / 0.55)")} 0%, transparent 75%)`,
            filter: `blur(${Math.max(4, size * 0.15)}px)`,
            mixBlendMode: "screen",
            transformOrigin: "50% 50%",
            animation: `flame-ground-cast ${(flickerSpeed * 4).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `${seed.bodyDelay}s`,
            zIndex: 0,
          }}
        />
      )}

      {/* Radiant halo bloom — beauty layer that makes the flame radiant (not dying). */}
      {!isDying && (
        <span
          aria-hidden
          className="absolute left-1/2 bottom-0 pointer-events-none rounded-full"
          style={{
            width: w * 2.2,
            height: h * 1.7,
            background: `radial-gradient(ellipse at 50% 70%, ${palette.halo.replace(")", ` / ${(0.32 + s * 0.28).toFixed(2)})`)} 0%, ${palette.halo.replace(")", " / 0.12)")} 38%, transparent 72%)`,
            mixBlendMode: "screen",
            animation: `flame-halo-bloom ${(flickerSpeed * 3.6).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `${seed.bodyDelay}s`,
            zIndex: -2,
          }}
        />
      )}

      {/* Halo — soft heat glow (only when not dying) */}
      {!isDying && (
        <span
          className="absolute left-1/2 bottom-0 rounded-full"
          style={{
            width: w * 1.4,
            height: h * 0.95,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 75%, ${palette.halo} 0%, transparent 70%)`,
            opacity: 0.18 + s * 0.22,
            filter: `blur(${Math.max(4, size * 0.18)}px)`,
            mixBlendMode: "screen",
            animation: `flame-inline-halo ${(flickerSpeed * 1.6).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `${seed.bodyDelay}s`,
          }}
        />
      )}


      {/* Breathing wrapper — slow inhale/exhale around body + core. Strong+ only. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          animation: breathAnim,
          animationDelay: `${seed.bodyDelay}s`,
          transformOrigin: "center bottom",
          willChange: breathAnim ? "transform" : undefined,
        }}
      >
        {/* 2. Body — main flame (turbulence-warped) */}
        <svg
          className="absolute left-1/2 bottom-0"
          width={w}
          height={h}
          viewBox="0 0 40 56"
          style={{
            transform: "translateX(-50%)",
            transformOrigin: "center bottom",
            filter: `url(#${filterId}) drop-shadow(0 0 ${size * 0.12}px ${palette.mid})`,
            animation: `flame-inline-flicker ${flickerSpeed.toFixed(2)}s ease-in-out infinite`,
            animationDelay: `${seed.bodyDelay}s`,
            mixBlendMode: "screen",
            opacity: isDying ? 0.78 : 1,
          }}
        >
          <path d={FLAME_PATH} fill={`url(#${bodyGradId})`} />
        </svg>

        {/* 3. White-hot core (only above ~mid status — weak flames don't have it) */}
        {!isWeak && (
          <svg
            className="absolute left-1/2 bottom-[8%]"
            width={w * 0.55}
            height={h * 0.7}
            viewBox="0 0 40 56"
            style={{
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              filter: `drop-shadow(0 0 ${size * 0.18}px ${palette.core})`,
              animation: `flame-inline-core ${(flickerSpeed * 0.7).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${seed.coreDelay}s`,
              mixBlendMode: "screen",
            }}
          >
            <path d={FLAME_PATH} fill={`url(#${coreGradId})`} />
          </svg>
        )}

        {/* Heart bloom — pulsing white-hot center (Strong+) */}
        {isStrong && (
          <span
            aria-hidden
            className="absolute left-1/2 pointer-events-none rounded-full"
            style={{
              width: w * 0.32,
              height: h * 0.4,
              bottom: h * 0.15,
              background: `radial-gradient(ellipse at 50% 60%, ${palette.core.replace(")", " / 0.95)")} 0%, ${palette.tip.replace(")", " / 0.5)")} 45%, transparent 78%)`,
              filter: `blur(${Math.max(2, size * 0.05)}px)`,
              transform: "translateX(-50%)",
              mixBlendMode: "screen",
              animation: `flame-heart-bloom ${(flickerSpeed * 1.4).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${seed.coreDelay}s`,
            }}
          />
        )}

        {/* God-ray — vertical light beam shooting up (Peak only) */}
        {isPeak && (
          <span
            aria-hidden
            className="absolute left-1/2 pointer-events-none"
            style={{
              width: w * 0.18,
              height: h * 1.4,
              bottom: h * 0.25,
              background: `linear-gradient(180deg, ${palette.core.replace(")", " / 0.5)")} 0%, ${palette.tip.replace(")", " / 0.22)")} 35%, transparent 80%)`,
              filter: `blur(${Math.max(3, size * 0.09)}px)`,
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              mixBlendMode: "screen",
              animation: `flame-godray-pulse ${(flickerSpeed * 2.6).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${seed.bodyDelay}s`,
              opacity: 0.7,
            }}
          />
        )}
      </span>

      {/* Wind-reactive embers — small particles that drift with the wind (peak only). */}
      {isPeak && (
        <>
          <span
            className="flame-ember absolute rounded-full pointer-events-none"
            style={{
              width: Math.max(1.6, size * 0.08),
              height: Math.max(1.6, size * 0.08),
              left: "50%",
              bottom: h * 0.45,
              background: palette.core,
              boxShadow: `0 0 ${size * 0.25}px ${palette.tip}`,
              transform: "translateX(-50%)",
              opacity: 0,
              ["--ember-rise" as string]: `${-size * 1.2}px`,
              animation: `flame-ember-float ${(flickerSpeed * 2.6).toFixed(2)}s ease-out infinite`,
              mixBlendMode: "screen",
            }}
          />
          <span
            className="flame-ember absolute rounded-full pointer-events-none"
            style={{
              width: Math.max(1.4, size * 0.06),
              height: Math.max(1.4, size * 0.06),
              left: "55%",
              bottom: h * 0.55,
              background: palette.tip,
              boxShadow: `0 0 ${size * 0.2}px ${palette.tip}`,
              transform: "translateX(-50%)",
              opacity: 0,
              ["--ember-rise" as string]: `${-size * 1.5}px`,
              animation: `flame-ember-float ${(flickerSpeed * 3).toFixed(2)}s ease-out infinite`,
              animationDelay: `${(flickerSpeed * 1.3).toFixed(2)}s`,
              mixBlendMode: "screen",
            }}
          />
        </>
      )}

      {/* Base ember (only when alive enough to support a coal) */}
      {s > 0.4 && (
        <span
          className="absolute left-1/2 rounded-full"
          style={{
            width: w * 0.32,
            height: w * 0.08,
            bottom: 0,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse, ${palette.tip} 0%, ${palette.base} 60%, transparent 100%)`,
            filter: `blur(${size * 0.04}px)`,
            opacity: 0.85,
            animation: `flame-inline-halo ${(flickerSpeed * 0.9).toFixed(2)}s ease-in-out infinite`,
          }}
        />
      )}

      {/* Dying state — extra unstable wobble across the whole flame */}
      {isDying && (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            animation: `flame-dying-wobble ${(flickerSpeed * 0.6).toFixed(2)}s ease-in-out infinite`,
            transformOrigin: "center bottom",
          }}
        />
      )}

      {/* Peak state — faint upward draft makes it feel powerful */}
      {isPeak && (
        <span
          aria-hidden
          className="absolute left-1/2 bottom-0 rounded-full"
          style={{
            width: w * 0.5,
            height: h * 1.05,
            transform: "translateX(-50%)",
            background: `linear-gradient(to top, ${palette.tip} 0%, transparent 75%)`,
            opacity: 0.18,
            filter: `blur(${size * 0.12}px)`,
            mixBlendMode: "screen",
            animation: `flame-inline-halo ${(flickerSpeed * 1.3).toFixed(2)}s ease-in-out infinite`,
          }}
        />
      )}
    </span>
  );
};

export default Flame;
