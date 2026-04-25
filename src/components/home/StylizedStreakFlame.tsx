import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * StylizedStreakFlame v3 — roaring + realistic.
 *
 * Major upgrades over v2:
 *  - Authentic asymmetric teardrop silhouette (slight lean, narrower tip)
 *  - 5-layer volumetric depth: outer aura → mid body → inner sheath → tongues → white-hot core
 *  - 4 inner tongues (instead of 2) dancing at different rhythms — true "roar"
 *  - Multi-octave turbulence with chained noise for organic, never-repeating warp
 *  - Realistic blue base "neck" (where fuel meets oxygen — physically accurate)
 *  - Volumetric smoke wisps drifting up from the tip
 *  - Stronger heat shimmer with chromatic offset
 *  - Aura now 4 concentric layers with chromatic edges (warm → hot → glow → soft)
 *  - Curved ember trajectories (left + right drifts via two paths)
 *  - Per-frame "fuel pulse" — synchronised gentle pump that mimics burning gas pressure
 *  - GPU-only animations, prefers-reduced-motion respected
 *
 *  Stages (mapped to existing streak-tier thresholds in src/lib/streak.ts):
 *    1. Tiny flicker         — 1–2d
 *    2. Small steady flame   — 3–6d
 *    3. Medium active fire   — 7–13d
 *    4. Large energetic      — 14–29d
 *    5. Champion blaze       — 30–59d
 *    6. Diamond              — 60–99d
 *    7. Legendary            — 100–199d
 *    8. Inferno              — 200d+
 */
interface StylizedStreakFlameProps {
  /** The user's effective streak in days. */
  streak: number;
  /** Pixel size of the flame container. Default 140. */
  size?: number;
  className?: string;
}

const STAGE_THRESHOLDS = [1, 3, 7, 14, 30, 60, 100, 200];
const MAX_STAGE_INDEX = STAGE_THRESHOLDS.length;

const stageFromStreak = (streak: number) => {
  if (streak < 1) return 0;
  let s = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (streak >= STAGE_THRESHOLDS[i]) s = i + 1;
  }
  return s;
};

const progressFromStreak = (streak: number) => {
  if (streak <= 0) return 0;
  let prev = 0;
  let next = STAGE_THRESHOLDS[0];
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (streak >= STAGE_THRESHOLDS[i]) {
      prev = STAGE_THRESHOLDS[i];
      next = STAGE_THRESHOLDS[i + 1] ?? STAGE_THRESHOLDS[i] * 1.5;
    } else {
      break;
    }
  }
  const stage = stageFromStreak(streak);
  const span = Math.max(1, next - prev);
  const sub = Math.min(1, Math.max(0, (streak - prev) / span));
  return Math.min(1, (stage - 1 + sub) / MAX_STAGE_INDEX);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const StylizedStreakFlame = ({ streak, size = 140, className }: StylizedStreakFlameProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const stage = stageFromStreak(streak);
  const t = progressFromStreak(streak);
  const isCold = stage === 0;

  // Per-instance seed
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    return {
      a: (h % 30) + 1,
      b: ((h >> 8) % 40) + 5,
      c: ((h >> 16) % 50) + 11,
      delay: -((h % 1700) / 1000),
      delay2: -((h % 2300) / 1000),
      delay3: -((h % 1900) / 1000),
      delay4: -((h % 2700) / 1000),
    };
  }, [uid]);

  // Stage-up burst
  const [burst, setBurst] = useState(false);
  const prevStageRef = useRef(stage);
  useEffect(() => {
    if (stage > prevStageRef.current) {
      setBurst(true);
      const id = setTimeout(() => setBurst(false), 900);
      prevStageRef.current = stage;
      return () => clearTimeout(id);
    }
    prevStageRef.current = stage;
  }, [stage]);

  // Continuous scaling — bigger, taller, more energetic
  const flameH = lerp(0.46, 1.05, t) * size;
  const flameW = lerp(0.34, 0.62, t) * size;
  const auraR = lerp(0.65, 1.55, t) * size;
  const auraOpacity = lerp(0.26, 0.72, t);
  const coreBright = lerp(0.6, 1.0, t);
  const flickerSpeed = lerp(2.2, 0.55, t); // faster at high tiers — more "roar"
  const turbSpeed = lerp(2.0, 0.7, t);
  const displaceBase = lerp(1.8, 3.6, t);
  const displacePeak = displaceBase * 1.55;
  const emberCount = isCold ? 0 : Math.round(lerp(3, 18, t));
  const sparkleCount = isCold ? 0 : Math.round(lerp(4, 22, t));
  const showBlueBase = stage >= 3;
  const showRays = stage >= 5;
  const showSmoke = stage >= 4;

  // Tier palette — pushed to be richer & more saturated, with a hot inner core
  const palette = useMemo(() => {
    if (stage >= 8) return {
      outer: "hsl(310 95% 60%)", mid: "hsl(265 95% 64%)",
      inner: "hsl(195 100% 72%)", core: "hsl(180 100% 97%)",
      aura: "hsl(195 100% 62%)",  base: "hsl(195 100% 72%)",
      tip: "hsl(195 100% 92%)",  spark: "hsl(195 100% 88%)",
      smoke: "hsl(220 30% 60%)",
    };
    if (stage >= 7) return {
      outer: "hsl(300 90% 62%)", mid: "hsl(35 100% 62%)",
      inner: "hsl(48 100% 78%)", core: "hsl(60 100% 96%)",
      aura: "hsl(280 85% 62%)",  base: "hsl(200 100% 72%)",
      tip: "hsl(280 90% 82%)",   spark: "hsl(50 100% 82%)",
      smoke: "hsl(280 25% 50%)",
    };
    if (stage >= 6) return {
      outer: "hsl(190 95% 62%)", mid: "hsl(40 100% 62%)",
      inner: "hsl(50 100% 78%)", core: "hsl(58 100% 94%)",
      aura: "hsl(200 90% 62%)",  base: "hsl(200 100% 74%)",
      tip: "hsl(195 100% 84%)",   spark: "hsl(50 100% 80%)",
      smoke: "hsl(210 25% 50%)",
    };
    if (stage >= 5) return {
      outer: "hsl(20 100% 52%)",  mid: "hsl(38 100% 62%)",
      inner: "hsl(50 100% 74%)", core: "hsl(56 100% 92%)",
      aura: "hsl(28 100% 57%)",   base: "hsl(200 95% 72%)",
      tip: "hsl(50 100% 82%)",   spark: "hsl(48 100% 80%)",
      smoke: "hsl(20 20% 45%)",
    };
    if (stage >= 4) return {
      outer: "hsl(14 95% 52%)",  mid: "hsl(28 100% 60%)",
      inner: "hsl(44 100% 70%)", core: "hsl(52 100% 90%)",
      aura: "hsl(20 100% 57%)",   base: "hsl(210 90% 70%)",
      tip: "hsl(46 100% 78%)",   spark: "hsl(40 100% 75%)",
      smoke: "hsl(15 18% 40%)",
    };
    if (stage >= 3) return {
      outer: "hsl(12 92% 50%)",  mid: "hsl(24 98% 58%)",
      inner: "hsl(40 100% 66%)", core: "hsl(48 100% 84%)",
      aura: "hsl(18 95% 54%)",   base: "hsl(210 80% 67%)",
      tip: "hsl(42 100% 74%)",   spark: "hsl(38 100% 72%)",
      smoke: "hsl(15 15% 38%)",
    };
    if (stage >= 2) return {
      outer: "hsl(10 90% 48%)",  mid: "hsl(20 95% 56%)",
      inner: "hsl(36 98% 64%)",  core: "hsl(46 100% 80%)",
      aura: "hsl(16 92% 52%)",   base: "hsl(20 92% 52%)",
      tip: "hsl(38 100% 72%)",   spark: "hsl(34 100% 70%)",
      smoke: "hsl(15 12% 36%)",
    };
    return {
      outer: "hsl(8 88% 46%)",  mid: "hsl(18 90% 54%)",
      inner: "hsl(32 95% 62%)",  core: "hsl(42 100% 78%)",
      aura: "hsl(14 90% 52%)",   base: "hsl(18 90% 52%)",
      tip: "hsl(34 100% 70%)",   spark: "hsl(30 100% 67%)",
      smoke: "hsl(15 10% 35%)",
    };
  }, [stage]);

  // Authentic candle-flame silhouette — slim teardrop with sharp tip
  const FLAME_PATH =
    "M20 1 C 21.2 8, 25.8 13, 28.4 20 C 31.0 27, 31.0 36, 28.5 42 C 26.0 48, 22.5 52, 20 54 C 17.5 52, 14.0 48, 11.5 42 C 9.0 36, 9.0 27, 11.6 20 C 14.2 13, 18.8 8, 20 1 Z";
  // Slimmer asymmetric tongue — gives the "leaning lick" feel
  const TONGUE_PATH =
    "M20 4 C 21.4 11, 24.2 16, 25.6 23 C 27.0 30, 26.4 38, 24.0 43 C 22.2 47, 20.8 50, 20 51 C 19.2 50, 17.8 47, 16.0 43 C 13.6 38, 13.0 30, 14.4 23 C 15.8 16, 18.6 11, 20 4 Z";
  // Whip-tip — very narrow, used for the topmost dancing flick
  const WHIP_PATH =
    "M20 6 C 20.8 13, 22.6 18, 23.2 25 C 23.8 32, 22.8 40, 21.2 45 C 20.6 47, 20.2 49, 20 50 C 19.8 49, 19.4 47, 18.8 45 C 17.2 40, 16.2 32, 16.8 25 C 17.4 18, 19.2 13, 20 6 Z";

  const filterId = `ssf-turb-${uid}`;
  const filterId2 = `ssf-turb2-${uid}`;
  const filterId3 = `ssf-turb3-${uid}`;
  const bodyGradId = `ssf-body-${uid}`;
  const innerGradId = `ssf-inner-${uid}`;
  const coreGradId = `ssf-core-${uid}`;
  const tipGradId = `ssf-tip-${uid}`;
  const baseGradId = `ssf-base-${uid}`;

  // Cold state
  if (isCold) {
    return (
      <div
        className={cn("relative pointer-events-none flex items-end justify-center", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg width={size * 0.32} height={size * 0.45} viewBox="0 0 40 56" fill="none" className="opacity-40">
          <path d={FLAME_PATH} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-muted-foreground" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={cn("relative pointer-events-none flex items-end justify-center", className)}
      style={{
        width: size,
        height: size,
        animation: `stylized-flame-bob ${(flickerSpeed * 2.4).toFixed(2)}s ease-in-out infinite`,
        // Wind reactivity (uses global --wind-x if present, falls back to 0)
        ["--ssf-wind" as string]: `calc(var(--wind-x, 0) * 1.8deg + var(--wind-gust, 0) * 2.2deg)`,
      }}
      aria-hidden
    >
      {/* SVG defs */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          {/* Primary turbulence — outer body warp (slow, large) */}
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.045" numOctaves="3" seed={seed.a}>
              <animate attributeName="baseFrequency" dur={`${turbSpeed.toFixed(2)}s`}
                values="0.018 0.045;0.038 0.082;0.024 0.058;0.044 0.088;0.018 0.045" repeatCount="indefinite" />
              <animate attributeName="seed" dur={`${(turbSpeed * 2.3).toFixed(2)}s`}
                values={`${seed.a};${seed.b};${seed.a + 7};${seed.b + 3};${seed.a}`} repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic">
              <animate attributeName="scale" dur={`${(turbSpeed * 1.4).toFixed(2)}s`}
                values={`${displaceBase};${displacePeak};${displaceBase * 0.85};${displacePeak * 1.08};${displaceBase}`}
                repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>
          {/* Secondary turbulence — finer detail for tongues, faster */}
          <filter id={filterId2} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.105" numOctaves="2" seed={seed.b}>
              <animate attributeName="baseFrequency" dur={`${(turbSpeed * 0.65).toFixed(2)}s`}
                values="0.05 0.105;0.075 0.145;0.04 0.085;0.065 0.125;0.05 0.105" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic">
              <animate attributeName="scale" dur={`${(turbSpeed * 0.85).toFixed(2)}s`}
                values={`${displaceBase * 0.75};${displacePeak * 0.95};${displaceBase * 0.6};${displaceBase * 0.75}`}
                repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>
          {/* Tertiary — the hot whip-tip, very fast micro-flick */}
          <filter id={filterId3} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.09 0.18" numOctaves="2" seed={seed.c}>
              <animate attributeName="baseFrequency" dur={`${(turbSpeed * 0.45).toFixed(2)}s`}
                values="0.09 0.18;0.13 0.24;0.075 0.15;0.11 0.21;0.09 0.18" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic">
              <animate attributeName="scale" dur={`${(turbSpeed * 0.55).toFixed(2)}s`}
                values={`${displaceBase * 0.55};${displacePeak * 0.7};${displaceBase * 0.5};${displaceBase * 0.55}`}
                repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>

          <linearGradient id={bodyGradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"  stopColor={showBlueBase ? palette.base : palette.outer} stopOpacity="0.9" />
            <stop offset="14%" stopColor={palette.outer} stopOpacity="0.98" />
            <stop offset="48%" stopColor={palette.mid}   stopOpacity="0.95" />
            <stop offset="82%" stopColor={palette.inner} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.tip}  stopOpacity="0" />
          </linearGradient>
          <linearGradient id={innerGradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"  stopColor={palette.mid}   stopOpacity="0.92" />
            <stop offset="50%" stopColor={palette.inner} stopOpacity="0.96" />
            <stop offset="88%" stopColor={palette.core}  stopOpacity="0.75" />
            <stop offset="100%" stopColor={palette.tip}  stopOpacity="0" />
          </linearGradient>
          <radialGradient id={coreGradId} cx="50%" cy="62%" r="48%">
            <stop offset="0%"  stopColor={palette.core}  stopOpacity="1" />
            <stop offset="35%" stopColor={palette.core}  stopOpacity="0.9" />
            <stop offset="62%" stopColor={palette.inner} stopOpacity="0.55" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={tipGradId} cx="50%" cy="20%" r="38%">
            <stop offset="0%"  stopColor={palette.tip}   stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.tip}  stopOpacity="0" />
          </radialGradient>
          {/* Realistic blue collar at the very base */}
          <radialGradient id={baseGradId} cx="50%" cy="100%" r="60%">
            <stop offset="0%"  stopColor={palette.base}  stopOpacity="0.95" />
            <stop offset="55%" stopColor={palette.base}  stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette.base} stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* ─── OUTERMOST GLOW (largest, very soft chromatic edge) ─── */}
      <span
        className="absolute left-1/2 bottom-[6%] rounded-full"
        style={{
          width: auraR * 2.7,
          height: auraR * 2.1,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 70%, ${palette.aura.replace(")", ` / ${(auraOpacity * 0.28).toFixed(2)})`)} 0%, ${palette.outer.replace(")", " / 0.06)")} 35%, transparent 75%)`,
          filter: `blur(${Math.max(12, size * 0.14)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-aura-pulse ${(flickerSpeed * 4.2).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${seed.delay4}s`,
          zIndex: 0,
          willChange: "transform, opacity",
        }}
      />
      {/* ─── OUTER VOLUMETRIC HALO ─── */}
      <span
        className="absolute left-1/2 bottom-[6%] rounded-full"
        style={{
          width: auraR * 2.0,
          height: auraR * 1.7,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 68%, ${palette.aura.replace(")", ` / ${(auraOpacity * 0.55).toFixed(2)})`)} 0%, ${palette.aura.replace(")", " / 0.08)")} 50%, transparent 80%)`,
          filter: `blur(${Math.max(8, size * 0.1)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-aura-pulse ${(flickerSpeed * 3.4).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${seed.delay2}s`,
          zIndex: 0,
          willChange: "transform, opacity",
        }}
      />
      {/* ─── MID HALO ─── */}
      <span
        className="absolute left-1/2 bottom-[6%] rounded-full"
        style={{
          width: auraR * 1.4,
          height: auraR * 1.2,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 62%, ${palette.aura.replace(")", ` / ${(auraOpacity * 0.95).toFixed(2)})`)} 0%, ${palette.mid.replace(")", " / 0.18)")} 45%, transparent 78%)`,
          filter: `blur(${Math.max(5, size * 0.06)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-aura-pulse ${(flickerSpeed * 2.2).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${seed.delay}s`,
          zIndex: 0,
          willChange: "transform, opacity",
        }}
      />
      {/* ─── INNER HALO (tightest, brightest, white-hot center) ─── */}
      <span
        className="absolute left-1/2 bottom-[8%] rounded-full"
        style={{
          width: auraR * 0.9,
          height: auraR * 0.85,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 58%, ${palette.core.replace(")", ` / ${(auraOpacity * 1.3).toFixed(2)})`)} 0%, ${palette.inner.replace(")", " / 0.35)")} 45%, transparent 80%)`,
          filter: `blur(${Math.max(3, size * 0.035)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-aura-pulse ${(flickerSpeed * 1.4).toFixed(2)}s ease-in-out infinite`,
          zIndex: 1,
          willChange: "transform, opacity",
        }}
      />

      {/* ─── LIGHT CAST (warm puddle on the floor below) ─── */}
      <span
        className="absolute left-1/2 rounded-[50%]"
        style={{
          width: auraR * 1.8,
          height: auraR * 0.32,
          bottom: -size * 0.04,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 50%, ${palette.aura.replace(")", ` / ${(auraOpacity * 1.05).toFixed(2)})`)} 0%, ${palette.aura.replace(")", " / 0.15)")} 50%, transparent 85%)`,
          filter: `blur(${Math.max(4, size * 0.05)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-light-cast ${(flickerSpeed * 1.9).toFixed(2)}s ease-in-out infinite`,
          zIndex: 0,
        }}
      />

      {/* ─── VOLUMETRIC GOD-RAYS (Champion+) ─── */}
      {showRays && (
        <span
          className="absolute left-1/2 bottom-[20%] pointer-events-none"
          style={{
            width: auraR * 1.55,
            height: auraR * 1.8,
            transform: "translateX(-50%)",
            background: `conic-gradient(from 270deg at 50% 100%,
              transparent 0deg, ${palette.aura.replace(")", " / 0.22)")} 7deg, transparent 15deg,
              transparent 26deg, ${palette.aura.replace(")", " / 0.14)")} 34deg, transparent 42deg,
              transparent 318deg, ${palette.aura.replace(")", " / 0.14)")} 326deg, transparent 334deg,
              transparent 345deg, ${palette.aura.replace(")", " / 0.22)")} 353deg, transparent 360deg)`,
            filter: `blur(${Math.max(6, size * 0.07)}px)`,
            mixBlendMode: "screen",
            animation: `stylized-godrays-sway ${(flickerSpeed * 3).toFixed(2)}s ease-in-out infinite`,
            zIndex: 1,
            opacity: lerp(0.4, 0.9, t),
          }}
        />
      )}

      {/* ─── Stage-up shockwave ─── */}
      {burst && (
        <>
          <span
            className="absolute left-1/2 bottom-[18%] rounded-full"
            style={{
              width: auraR * 1.4,
              height: auraR * 1.4,
              transform: "translateX(-50%) translateY(50%)",
              border: `2px solid ${palette.aura}`,
              boxShadow: `0 0 28px ${palette.aura}, inset 0 0 14px ${palette.core.replace(")", " / 0.6)")}`,
              animation: "stylized-stage-burst 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              mixBlendMode: "screen",
              zIndex: 8,
            }}
          />
          <span
            className="absolute left-1/2 bottom-[18%] rounded-full"
            style={{
              width: auraR * 1.4,
              height: auraR * 1.4,
              transform: "translateX(-50%) translateY(50%)",
              border: `1px solid ${palette.core}`,
              animation: "stylized-stage-burst 1.05s cubic-bezier(0.16, 1, 0.3, 1) 0.12s forwards",
              mixBlendMode: "screen",
              zIndex: 8,
            }}
          />
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={`ray-${i}`}
              className="absolute left-1/2 bottom-[35%] rounded-full"
              style={{
                width: 3,
                height: 18,
                background: `linear-gradient(180deg, ${palette.core}, ${palette.aura}, transparent)`,
                boxShadow: `0 0 12px ${palette.aura}`,
                transformOrigin: "center bottom",
                ["--ray-angle" as string]: `${(i / 12) * 360}deg`,
                animation: "stylized-ray-shoot 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: `${(i % 6) * 0.022}s`,
                mixBlendMode: "screen",
                zIndex: 9,
              }}
            />
          ))}
        </>
      )}

      {/* ─── COOL BLUE BASE COLLAR (stage 3+) — physically realistic ─── */}
      {showBlueBase && (
        <>
          {/* Wide soft base wash */}
          <span
            className="absolute left-1/2 rounded-full"
            style={{
              width: flameW * 1.5,
              height: flameW * 0.45,
              bottom: size * 0.035,
              transform: "translateX(-50%)",
              background: `radial-gradient(ellipse at 50% 50%, ${palette.base.replace(")", " / 0.9)")} 0%, ${palette.base.replace(")", " / 0.35)")} 45%, transparent 80%)`,
              filter: `blur(${Math.max(2, size * 0.024)}px)`,
              mixBlendMode: "screen",
              zIndex: 2,
              animation: `stylized-base-flicker ${(flickerSpeed * 0.65).toFixed(2)}s ease-in-out infinite`,
            }}
          />
          {/* Tight bright neck where fuel meets oxygen */}
          <span
            className="absolute left-1/2 rounded-full"
            style={{
              width: flameW * 0.85,
              height: flameW * 0.22,
              bottom: size * 0.06,
              transform: "translateX(-50%)",
              background: `radial-gradient(ellipse at 50% 50%, ${palette.base.replace(")", " / 1)")} 0%, ${palette.base.replace(")", " / 0.45)")} 50%, transparent 85%)`,
              filter: `blur(${Math.max(1.5, size * 0.014)}px)`,
              mixBlendMode: "screen",
              zIndex: 3,
              animation: `stylized-base-flicker ${(flickerSpeed * 0.5).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${seed.delay3}s`,
            }}
          />
        </>
      )}

      {/* ─── FLAME WRAPPER (wind sway + fuel pulse) ─── */}
      <div
        className="absolute left-1/2 bottom-[5%]"
        style={{
          transform: "translateX(-50%)",
          transformOrigin: "center bottom",
          animation: `stylized-flame-sway ${(flickerSpeed * 3.2).toFixed(2)}s ease-in-out infinite`,
          willChange: "transform",
        }}
      >
        {/* Inner pulse wrapper — gentle "fuel pressure" pump */}
        <div
          className="relative"
          style={{
            transformOrigin: "center bottom",
            animation: `stylized-fuel-pulse ${(flickerSpeed * 1.1).toFixed(2)}s ease-in-out infinite`,
            willChange: "transform",
          }}
        >
          {/* OUTER BODY — softest, biggest */}
          <svg
            width={flameW}
            height={flameH}
            viewBox="0 0 40 56"
            className="absolute left-1/2 bottom-0"
            style={{
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              filter: `url(#${filterId}) drop-shadow(0 0 ${size * 0.12}px ${palette.mid})`,
              animation: `stylized-flame-flicker ${flickerSpeed.toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${seed.delay}s`,
              mixBlendMode: "screen",
              zIndex: 3,
              willChange: "transform, opacity",
            }}
          >
            <path d={FLAME_PATH} fill={`url(#${bodyGradId})`} />
          </svg>

          {/* MID BODY — slightly smaller, faster */}
          <svg
            width={flameW * 0.78}
            height={flameH * 0.92}
            viewBox="0 0 40 56"
            className="absolute left-1/2 bottom-0"
            style={{
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              filter: `url(#${filterId2}) drop-shadow(0 0 ${size * 0.07}px ${palette.inner})`,
              animation: `stylized-flame-flicker ${(flickerSpeed * 0.85).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${(seed.delay - 0.3).toFixed(2)}s`,
              mixBlendMode: "screen",
              zIndex: 4,
              willChange: "transform, opacity",
            }}
          >
            <path d={FLAME_PATH} fill={`url(#${innerGradId})`} />
          </svg>

          {/* INNER SHEATH — narrower, hotter */}
          <svg
            width={flameW * 0.6}
            height={flameH * 0.85}
            viewBox="0 0 40 56"
            className="absolute left-1/2 bottom-0"
            style={{
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              filter: `url(#${filterId2}) drop-shadow(0 0 ${size * 0.06}px ${palette.core})`,
              animation: `stylized-flame-flicker ${(flickerSpeed * 0.72).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${(seed.delay2 + 0.2).toFixed(2)}s`,
              mixBlendMode: "screen",
              zIndex: 5,
              opacity: 0.92,
              willChange: "transform, opacity",
            }}
          >
            <path d={TONGUE_PATH} fill={`url(#${innerGradId})`} />
          </svg>

          {/* INNER TONGUE A (slim, dancing left) */}
          <svg
            width={flameW * 0.45}
            height={flameH * 0.82}
            viewBox="0 0 40 56"
            className="absolute left-1/2 bottom-0"
            style={{
              transform: "translateX(-50%) translateX(-9%)",
              transformOrigin: "center bottom",
              filter: `url(#${filterId3}) drop-shadow(0 0 ${size * 0.05}px ${palette.core})`,
              animation: `stylized-tongue-dance-a ${(flickerSpeed * 0.6).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${seed.delay2}s`,
              mixBlendMode: "screen",
              zIndex: 6,
              opacity: 0.88,
              willChange: "transform, opacity",
            }}
          >
            <path d={TONGUE_PATH} fill={`url(#${innerGradId})`} />
          </svg>

          {/* INNER TONGUE B (slimmer, dancing right, faster) */}
          <svg
            width={flameW * 0.36}
            height={flameH * 0.74}
            viewBox="0 0 40 56"
            className="absolute left-1/2 bottom-0"
            style={{
              transform: "translateX(-50%) translateX(9%)",
              transformOrigin: "center bottom",
              filter: `url(#${filterId3}) drop-shadow(0 0 ${size * 0.04}px ${palette.core})`,
              animation: `stylized-tongue-dance-b ${(flickerSpeed * 0.5).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${(seed.delay2 - 0.4).toFixed(2)}s`,
              mixBlendMode: "screen",
              zIndex: 6,
              opacity: 0.78,
              willChange: "transform, opacity",
            }}
          >
            <path d={TONGUE_PATH} fill={`url(#${innerGradId})`} />
          </svg>

          {/* WHIP TIP (very narrow, fast micro-flick) — only stage 4+ */}
          {stage >= 4 && (
            <svg
              width={flameW * 0.28}
              height={flameH * 0.95}
              viewBox="0 0 40 56"
              className="absolute left-1/2 bottom-0"
              style={{
                transform: "translateX(-50%)",
                transformOrigin: "center bottom",
                filter: `url(#${filterId3}) drop-shadow(0 0 ${size * 0.05}px ${palette.tip})`,
                animation: `stylized-whip-tip ${(flickerSpeed * 0.45).toFixed(2)}s ease-in-out infinite`,
                animationDelay: `${seed.delay3}s`,
                mixBlendMode: "screen",
                zIndex: 7,
                opacity: 0.85,
                willChange: "transform, opacity",
              }}
            >
              <path d={WHIP_PATH} fill={`url(#${innerGradId})`} />
            </svg>
          )}

          {/* WHITE-HOT CORE */}
          <svg
            width={flameW * 0.44}
            height={flameH * 0.66}
            viewBox="0 0 40 56"
            className="absolute left-1/2 bottom-[3%]"
            style={{
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              filter: `drop-shadow(0 0 ${size * 0.16 * coreBright}px ${palette.core})`,
              animation: `stylized-flame-core ${(flickerSpeed * 0.55).toFixed(2)}s ease-in-out infinite`,
              opacity: coreBright,
              mixBlendMode: "screen",
              zIndex: 7,
              willChange: "transform, opacity",
            }}
          >
            <path d={FLAME_PATH} fill={`url(#${coreGradId})`} />
          </svg>

          {/* TIP HIGHLIGHT — bright spot near the top (stage 3+) */}
          {stage >= 3 && (
            <svg
              width={flameW * 0.5}
              height={flameH * 0.5}
              viewBox="0 0 40 56"
              className="absolute left-1/2"
              style={{
                transform: "translateX(-50%)",
                bottom: flameH * 0.45,
                filter: `drop-shadow(0 0 ${size * 0.05}px ${palette.tip})`,
                animation: `stylized-tip-pulse ${(flickerSpeed * 0.9).toFixed(2)}s ease-in-out infinite`,
                mixBlendMode: "screen",
                zIndex: 8,
                opacity: lerp(0.4, 0.9, t),
              }}
            >
              <ellipse cx="20" cy="20" rx="14" ry="20" fill={`url(#${tipGradId})`} />
            </svg>
          )}
        </div>
      </div>

      {/* ─── HEAT SHIMMER WAVE (above the flame) ─── */}
      {stage >= 2 && (
        <span
          className="absolute left-1/2 pointer-events-none"
          style={{
            width: flameW * 1.5,
            height: flameH * 0.55,
            bottom: flameH * 0.95,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 80%, ${palette.aura.replace(")", " / 0.16)")} 0%, transparent 60%)`,
            filter: "blur(7px)",
            mixBlendMode: "screen",
            animation: `stylized-heat-shimmer ${(flickerSpeed * 1.4).toFixed(2)}s ease-in-out infinite`,
            zIndex: 4,
          }}
        />
      )}

      {/* ─── SMOKE WISPS (stage 4+) — wisp drifts up & dissipates ─── */}
      {showSmoke && (
        <>
          {Array.from({ length: 3 }).map((_, i) => {
            const dur = 4.5 + i * 0.8;
            const delay = i * 1.4;
            const left = 42 + i * 8;
            return (
              <span
                key={`smoke-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: flameW * 0.5,
                  height: flameW * 0.5,
                  left: `${left}%`,
                  bottom: flameH * 0.85,
                  background: `radial-gradient(circle at 50% 50%, ${palette.smoke.replace(")", " / 0.32)")} 0%, ${palette.smoke.replace(")", " / 0.08)")} 50%, transparent 80%)`,
                  filter: "blur(8px)",
                  opacity: 0,
                  animation: `stylized-smoke-rise ${dur.toFixed(2)}s ease-out infinite`,
                  animationDelay: `${delay}s`,
                  zIndex: 2,
                  willChange: "transform, opacity",
                }}
              />
            );
          })}
        </>
      )}

      {/* ─── HEAVY EMBERS (rising with curved drift) ─── */}
      {Array.from({ length: emberCount }).map((_, i) => {
        const left = 26 + ((i * 19) % 48);
        const delay = (i / Math.max(1, emberCount)) * 2.4 + ((i * 0.13) % 0.6);
        const duration = lerp(2.8, 1.6, t) + (i % 3) * 0.3;
        const drift = (i % 2 === 0 ? -1 : 1) * (6 + (i * 5) % 14);
        const dot = lerp(1.6, 3.0, t) + (i % 2) * 0.4;
        const isHot = i % 4 === 0;
        return (
          <span
            key={`ember-${i}`}
            className="absolute rounded-full"
            style={{
              width: dot,
              height: dot,
              left: `${left}%`,
              bottom: "12%",
              background: isHot ? palette.core : palette.inner,
              boxShadow: `0 0 ${dot * 4}px ${palette.aura}, 0 0 ${dot * 8}px ${palette.aura.replace(")", " / 0.55)")}`,
              opacity: 0,
              ["--ember-x" as string]: `${drift}px`,
              ["--ember-rise" as string]: `-${flameH * 1.65}px`,
              animation: `stylized-ember-rise ${duration.toFixed(2)}s ease-out infinite`,
              animationDelay: `${delay.toFixed(2)}s`,
              mixBlendMode: "screen",
              zIndex: 5,
              willChange: "transform, opacity",
            }}
          />
        );
      })}

      {/* ─── SPARKLE DUST (tiny twinkles) ─── */}
      {Array.from({ length: sparkleCount }).map((_, i) => {
        const left = 16 + ((i * 13) % 68);
        const delay = (i * 0.21) % 3;
        const duration = lerp(2.2, 1.3, t) + (i % 4) * 0.25;
        const drift = (i % 2 === 0 ? 1 : -1) * (3 + (i * 3) % 12);
        const dot = lerp(1.0, 1.8, t);
        return (
          <span
            key={`sparkle-${i}`}
            className="absolute rounded-full"
            style={{
              width: dot,
              height: dot,
              left: `${left}%`,
              bottom: "16%",
              background: palette.spark,
              boxShadow: `0 0 ${dot * 4.5}px ${palette.spark}`,
              opacity: 0,
              ["--ember-x" as string]: `${drift}px`,
              ["--ember-rise" as string]: `-${flameH * 1.3}px`,
              animation: `stylized-sparkle-rise ${duration.toFixed(2)}s ease-out infinite`,
              animationDelay: `${delay.toFixed(2)}s`,
              mixBlendMode: "screen",
              zIndex: 6,
              willChange: "transform, opacity",
            }}
          />
        );
      })}

      {/* ─── Stage-up brightness flash overlay ─── */}
      {burst && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 70%, ${palette.core.replace(")", " / 0.7)")} 0%, ${palette.aura.replace(")", " / 0.3)")} 30%, transparent 60%)`,
            mixBlendMode: "screen",
            animation: "stylized-burst-flash 0.85s ease-out forwards",
            zIndex: 9,
          }}
        />
      )}
    </div>
  );
};

export default StylizedStreakFlame;
