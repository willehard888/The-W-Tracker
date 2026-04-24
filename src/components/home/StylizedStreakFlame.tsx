import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * StylizedStreakFlame v2 — premium AAA-style stylized streak flame.
 *
 * Improvements over v1:
 *  - Authentic teardrop silhouette with TWO inner tongues (asymmetric, organic)
 *  - Volumetric multi-layer halo (3 concentric, screen-blended)
 *  - Heat shimmer band above the flame (subtle wavy distortion)
 *  - Plasma core that pulses with brightness
 *  - Light cast (warm puddle of light on the floor) that pulses
 *  - Two-tier ember system: heavy embers + tiny sparkle dust
 *  - Subtle horizontal "wind sway" using global wind CSS vars when available
 *  - Volumetric god-rays at Champion+ tiers
 *  - Color gradient: blue base → orange body → yellow-white core → cyan tip (Inferno)
 *
 *  Stages (mapped to existing streak-tier thresholds in src/lib/streak.ts):
 *    1. Tiny flicker         — 1–2d   (pre-Ignited)
 *    2. Small steady flame   — 3–6d   (Ignited)
 *    3. Medium active fire   — 7–13d  (Heating Up)
 *    4. Large energetic      — 14–29d (On Fire)
 *    5. Champion blaze       — 30–59d (Champion)
 *    6. Diamond              — 60–99d (cool blue edges)
 *    7. Legendary            — 100–199d (aurora hue shift)
 *    8. Inferno              — 200d+   (plasma core)
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
      delay: -((h % 1700) / 1000),
      delay2: -((h % 2300) / 1000),
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

  // Continuous scaling
  const flameH = lerp(0.42, 0.95, t) * size;
  const flameW = lerp(0.32, 0.58, t) * size;
  const auraR = lerp(0.6, 1.45, t) * size;
  const auraOpacity = lerp(0.22, 0.62, t);
  const coreBright = lerp(0.55, 1.0, t);
  const flickerSpeed = lerp(2.4, 0.65, t);
  const turbSpeed = lerp(2.2, 0.8, t);
  const displaceBase = lerp(1.6, 3.2, t);
  const displacePeak = displaceBase * 1.45;
  const emberCount = isCold ? 0 : Math.round(lerp(2, 14, t));
  const sparkleCount = isCold ? 0 : Math.round(lerp(3, 18, t));
  const showBlueBase = stage >= 4;
  const showRays = stage >= 5;

  // Tier palette
  const palette = useMemo(() => {
    if (stage >= 8) return {
      outer: "hsl(310 90% 58%)", mid: "hsl(265 90% 62%)",
      inner: "hsl(195 95% 70%)", core: "hsl(180 100% 96%)",
      aura: "hsl(195 95% 60%)",  base: "hsl(195 100% 70%)",
      tip: "hsl(195 100% 90%)",  spark: "hsl(195 100% 85%)",
    };
    if (stage >= 7) return {
      outer: "hsl(300 85% 60%)", mid: "hsl(35 100% 60%)",
      inner: "hsl(48 100% 75%)", core: "hsl(60 100% 95%)",
      aura: "hsl(280 80% 60%)",  base: "hsl(200 95% 70%)",
      tip: "hsl(280 85% 80%)",   spark: "hsl(50 100% 80%)",
    };
    if (stage >= 6) return {
      outer: "hsl(190 90% 60%)", mid: "hsl(40 95% 60%)",
      inner: "hsl(50 100% 76%)", core: "hsl(58 100% 92%)",
      aura: "hsl(200 85% 60%)",  base: "hsl(200 95% 72%)",
      tip: "hsl(195 95% 82%)",   spark: "hsl(50 100% 78%)",
    };
    if (stage >= 5) return {
      outer: "hsl(22 95% 50%)",  mid: "hsl(38 95% 60%)",
      inner: "hsl(50 100% 72%)", core: "hsl(56 100% 90%)",
      aura: "hsl(28 95% 55%)",   base: "hsl(200 90% 70%)",
      tip: "hsl(50 100% 80%)",   spark: "hsl(48 100% 78%)",
    };
    if (stage >= 4) return {
      outer: "hsl(16 92% 50%)",  mid: "hsl(28 95% 58%)",
      inner: "hsl(44 100% 68%)", core: "hsl(52 100% 88%)",
      aura: "hsl(20 95% 55%)",   base: "hsl(210 85% 68%)",
      tip: "hsl(46 100% 75%)",   spark: "hsl(40 100% 72%)",
    };
    if (stage >= 3) return {
      outer: "hsl(14 90% 48%)",  mid: "hsl(24 95% 56%)",
      inner: "hsl(40 100% 64%)", core: "hsl(48 100% 82%)",
      aura: "hsl(18 92% 52%)",   base: "hsl(210 75% 65%)",
      tip: "hsl(42 100% 72%)",   spark: "hsl(38 100% 70%)",
    };
    if (stage >= 2) return {
      outer: "hsl(12 88% 46%)",  mid: "hsl(20 92% 54%)",
      inner: "hsl(36 95% 62%)",  core: "hsl(46 100% 78%)",
      aura: "hsl(16 90% 50%)",   base: "hsl(20 90% 50%)",
      tip: "hsl(38 100% 70%)",   spark: "hsl(34 100% 68%)",
    };
    return {
      outer: "hsl(10 85% 44%)",  mid: "hsl(18 88% 52%)",
      inner: "hsl(32 92% 60%)",  core: "hsl(42 100% 75%)",
      aura: "hsl(14 88% 50%)",   base: "hsl(18 88% 50%)",
      tip: "hsl(34 100% 68%)",   spark: "hsl(30 100% 65%)",
    };
  }, [stage]);

  // Authentic candle-flame silhouette — slim teardrop with sharp tip
  const FLAME_PATH =
    "M20 2 C 21.5 9, 25.5 14, 27.8 21 C 30.2 28, 30.2 36, 28 42 C 25.8 48, 22.5 52, 20 54 C 17.5 52, 14.2 48, 12 42 C 9.8 36, 9.8 28, 12.2 21 C 14.5 14, 18.5 9, 20 2 Z";
  // Inner tongue — slimmer, taller (gives depth)
  const TONGUE_PATH =
    "M20 6 C 21 12, 23.5 17, 24.8 23 C 26 30, 25.5 37, 23.5 42 C 22 46, 20.8 49, 20 50 C 19.2 49, 18 46, 16.5 42 C 14.5 37, 14 30, 15.2 23 C 16.5 17, 19 12, 20 6 Z";

  const filterId = `ssf-turb-${uid}`;
  const filterId2 = `ssf-turb2-${uid}`;
  const bodyGradId = `ssf-body-${uid}`;
  const innerGradId = `ssf-inner-${uid}`;
  const coreGradId = `ssf-core-${uid}`;
  const tipGradId = `ssf-tip-${uid}`;

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
        ["--ssf-wind" as string]: `calc(var(--wind-x, 0) * 1.5deg + var(--wind-gust, 0) * 1.8deg)`,
      }}
      aria-hidden
    >
      {/* SVG defs */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          {/* Primary turbulence — outer body warp */}
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022 0.05" numOctaves="2" seed={seed.a}>
              <animate attributeName="baseFrequency" dur={`${turbSpeed.toFixed(2)}s`}
                values="0.022 0.05;0.04 0.085;0.026 0.06;0.045 0.09;0.022 0.05" repeatCount="indefinite" />
              <animate attributeName="seed" dur={`${(turbSpeed * 2.3).toFixed(2)}s`}
                values={`${seed.a};${seed.b};${seed.a + 7};${seed.b + 3};${seed.a}`} repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic">
              <animate attributeName="scale" dur={`${(turbSpeed * 1.4).toFixed(2)}s`}
                values={`${displaceBase};${displacePeak};${displaceBase * 0.85};${displacePeak * 1.05};${displaceBase}`}
                repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>
          {/* Secondary turbulence — finer detail for tongues, faster */}
          <filter id={filterId2} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.1" numOctaves="2" seed={seed.b}>
              <animate attributeName="baseFrequency" dur={`${(turbSpeed * 0.7).toFixed(2)}s`}
                values="0.05 0.1;0.07 0.14;0.04 0.08;0.06 0.12;0.05 0.1" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic">
              <animate attributeName="scale" dur={`${(turbSpeed * 0.9).toFixed(2)}s`}
                values={`${displaceBase * 0.7};${displacePeak * 0.9};${displaceBase * 0.6};${displaceBase * 0.7}`}
                repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>

          <linearGradient id={bodyGradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"  stopColor={showBlueBase ? palette.base : palette.outer} stopOpacity="0.85" />
            <stop offset="18%" stopColor={palette.outer} stopOpacity="0.95" />
            <stop offset="55%" stopColor={palette.mid}   stopOpacity="0.95" />
            <stop offset="85%" stopColor={palette.inner} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.tip}  stopOpacity="0" />
          </linearGradient>
          <linearGradient id={innerGradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"  stopColor={palette.mid}   stopOpacity="0.9" />
            <stop offset="55%" stopColor={palette.inner} stopOpacity="0.95" />
            <stop offset="90%" stopColor={palette.core}  stopOpacity="0.7" />
            <stop offset="100%" stopColor={palette.tip}  stopOpacity="0" />
          </linearGradient>
          <radialGradient id={coreGradId} cx="50%" cy="62%" r="48%">
            <stop offset="0%"  stopColor={palette.core}  stopOpacity="1" />
            <stop offset="45%" stopColor={palette.inner} stopOpacity="0.7" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={tipGradId} cx="50%" cy="20%" r="35%">
            <stop offset="0%"  stopColor={palette.tip}   stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.tip}  stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* ─── OUTER VOLUMETRIC HALO (largest, softest) ─── */}
      <span
        className="absolute left-1/2 bottom-[6%] rounded-full"
        style={{
          width: auraR * 2.4,
          height: auraR * 1.9,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 70%, ${palette.aura.replace(")", ` / ${(auraOpacity * 0.4).toFixed(2)})`)} 0%, ${palette.aura.replace(")", " / 0.04)")} 50%, transparent 80%)`,
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
          width: auraR * 1.7,
          height: auraR * 1.4,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 65%, ${palette.aura.replace(")", ` / ${(auraOpacity * 0.85).toFixed(2)})`)} 0%, ${palette.aura.replace(")", " / 0.1)")} 45%, transparent 75%)`,
          filter: `blur(${Math.max(5, size * 0.06)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-aura-pulse ${(flickerSpeed * 2.2).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${seed.delay}s`,
          zIndex: 0,
          willChange: "transform, opacity",
        }}
      />
      {/* ─── INNER HALO (tightest, brightest) ─── */}
      <span
        className="absolute left-1/2 bottom-[8%] rounded-full"
        style={{
          width: auraR * 1.05,
          height: auraR * 0.95,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 60%, ${palette.inner.replace(")", ` / ${(auraOpacity * 1.1).toFixed(2)})`)} 0%, ${palette.aura.replace(")", " / 0.18)")} 50%, transparent 80%)`,
          filter: `blur(${Math.max(3, size * 0.035)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-aura-pulse ${(flickerSpeed * 1.5).toFixed(2)}s ease-in-out infinite`,
          zIndex: 1,
          willChange: "transform, opacity",
        }}
      />

      {/* ─── LIGHT CAST (warm puddle on the floor below) ─── */}
      <span
        className="absolute left-1/2 rounded-[50%]"
        style={{
          width: auraR * 1.6,
          height: auraR * 0.28,
          bottom: -size * 0.04,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 50%, ${palette.aura.replace(")", ` / ${(auraOpacity * 0.95).toFixed(2)})`)} 0%, ${palette.aura.replace(")", " / 0.12)")} 50%, transparent 85%)`,
          filter: `blur(${Math.max(4, size * 0.05)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-light-cast ${(flickerSpeed * 2).toFixed(2)}s ease-in-out infinite`,
          zIndex: 0,
        }}
      />

      {/* ─── VOLUMETRIC GOD-RAYS (Champion+) ─── */}
      {showRays && (
        <span
          className="absolute left-1/2 bottom-[20%] pointer-events-none"
          style={{
            width: auraR * 1.4,
            height: auraR * 1.6,
            transform: "translateX(-50%)",
            background: `conic-gradient(from 270deg at 50% 100%,
              transparent 0deg, ${palette.aura.replace(")", " / 0.18)")} 8deg, transparent 16deg,
              transparent 28deg, ${palette.aura.replace(")", " / 0.12)")} 36deg, transparent 44deg,
              transparent 316deg, ${palette.aura.replace(")", " / 0.12)")} 324deg, transparent 332deg,
              transparent 344deg, ${palette.aura.replace(")", " / 0.18)")} 352deg, transparent 360deg)`,
            filter: `blur(${Math.max(6, size * 0.07)}px)`,
            mixBlendMode: "screen",
            animation: `stylized-godrays-sway ${(flickerSpeed * 3).toFixed(2)}s ease-in-out infinite`,
            zIndex: 1,
            opacity: lerp(0.4, 0.85, t),
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
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={`ray-${i}`}
              className="absolute left-1/2 bottom-[35%] rounded-full"
              style={{
                width: 3,
                height: 16,
                background: `linear-gradient(180deg, ${palette.core}, ${palette.aura}, transparent)`,
                boxShadow: `0 0 12px ${palette.aura}`,
                transformOrigin: "center bottom",
                ["--ray-angle" as string]: `${(i / 10) * 360}deg`,
                animation: "stylized-ray-shoot 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: `${(i % 5) * 0.022}s`,
                mixBlendMode: "screen",
                zIndex: 9,
              }}
            />
          ))}
        </>
      )}

      {/* ─── COOL BLUE BASE (stage 4+) ─── */}
      {showBlueBase && (
        <span
          className="absolute left-1/2 rounded-full"
          style={{
            width: flameW * 1.3,
            height: flameW * 0.38,
            bottom: size * 0.04,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 50%, ${palette.base.replace(")", " / 0.85)")} 0%, ${palette.base.replace(")", " / 0.3)")} 45%, transparent 80%)`,
            filter: `blur(${Math.max(2, size * 0.022)}px)`,
            mixBlendMode: "screen",
            zIndex: 2,
            animation: `stylized-base-flicker ${(flickerSpeed * 0.7).toFixed(2)}s ease-in-out infinite`,
          }}
        />
      )}

      {/* ─── FLAME WRAPPER (wind sway) ─── */}
      <div
        className="absolute left-1/2 bottom-[5%]"
        style={{
          transform: "translateX(-50%)",
          transformOrigin: "center bottom",
          // Subtle wind-driven tilt that uses the global wind context if present
          animation: `stylized-flame-sway ${(flickerSpeed * 3.2).toFixed(2)}s ease-in-out infinite`,
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
            filter: `url(#${filterId}) drop-shadow(0 0 ${size * 0.1}px ${palette.mid})`,
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
          height={flameH * 0.9}
          viewBox="0 0 40 56"
          className="absolute left-1/2 bottom-0"
          style={{
            transform: "translateX(-50%)",
            transformOrigin: "center bottom",
            filter: `url(#${filterId2}) drop-shadow(0 0 ${size * 0.06}px ${palette.inner})`,
            animation: `stylized-flame-flicker ${(flickerSpeed * 0.85).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `${(seed.delay - 0.3).toFixed(2)}s`,
            mixBlendMode: "screen",
            zIndex: 4,
            willChange: "transform, opacity",
          }}
        >
          <path d={FLAME_PATH} fill={`url(#${innerGradId})`} />
        </svg>

        {/* INNER TONGUE A (slim, dancing left) */}
        <svg
          width={flameW * 0.45}
          height={flameH * 0.78}
          viewBox="0 0 40 56"
          className="absolute left-1/2 bottom-0"
          style={{
            transform: "translateX(-50%) translateX(-8%)",
            transformOrigin: "center bottom",
            filter: `url(#${filterId2}) drop-shadow(0 0 ${size * 0.05}px ${palette.core})`,
            animation: `stylized-tongue-dance-a ${(flickerSpeed * 0.6).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `${seed.delay2}s`,
            mixBlendMode: "screen",
            zIndex: 5,
            opacity: 0.9,
            willChange: "transform, opacity",
          }}
        >
          <path d={TONGUE_PATH} fill={`url(#${innerGradId})`} />
        </svg>

        {/* INNER TONGUE B (slimmer, dancing right, faster) */}
        <svg
          width={flameW * 0.35}
          height={flameH * 0.7}
          viewBox="0 0 40 56"
          className="absolute left-1/2 bottom-0"
          style={{
            transform: "translateX(-50%) translateX(8%)",
            transformOrigin: "center bottom",
            filter: `url(#${filterId2}) drop-shadow(0 0 ${size * 0.04}px ${palette.core})`,
            animation: `stylized-tongue-dance-b ${(flickerSpeed * 0.5).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `${(seed.delay2 - 0.4).toFixed(2)}s`,
            mixBlendMode: "screen",
            zIndex: 5,
            opacity: 0.75,
            willChange: "transform, opacity",
          }}
        >
          <path d={TONGUE_PATH} fill={`url(#${innerGradId})`} />
        </svg>

        {/* WHITE-HOT CORE */}
        <svg
          width={flameW * 0.42}
          height={flameH * 0.62}
          viewBox="0 0 40 56"
          className="absolute left-1/2 bottom-[3%]"
          style={{
            transform: "translateX(-50%)",
            transformOrigin: "center bottom",
            filter: `drop-shadow(0 0 ${size * 0.14 * coreBright}px ${palette.core})`,
            animation: `stylized-flame-core ${(flickerSpeed * 0.55).toFixed(2)}s ease-in-out infinite`,
            opacity: coreBright,
            mixBlendMode: "screen",
            zIndex: 6,
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
              zIndex: 7,
              opacity: lerp(0.4, 0.85, t),
            }}
          >
            <ellipse cx="20" cy="20" rx="14" ry="20" fill={`url(#${tipGradId})`} />
          </svg>
        )}
      </div>

      {/* ─── HEAT SHIMMER WAVE (above the flame) ─── */}
      {stage >= 2 && (
        <span
          className="absolute left-1/2 pointer-events-none"
          style={{
            width: flameW * 1.4,
            height: flameH * 0.5,
            bottom: flameH * 0.95,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 80%, ${palette.aura.replace(")", " / 0.12)")} 0%, transparent 60%)`,
            filter: "blur(6px)",
            mixBlendMode: "screen",
            animation: `stylized-heat-shimmer ${(flickerSpeed * 1.4).toFixed(2)}s ease-in-out infinite`,
            zIndex: 4,
          }}
        />
      )}

      {/* ─── HEAVY EMBERS (rising) ─── */}
      {Array.from({ length: emberCount }).map((_, i) => {
        const left = 28 + ((i * 19) % 44);
        const delay = (i / Math.max(1, emberCount)) * 2.4 + ((i * 0.13) % 0.6);
        const duration = lerp(2.8, 1.7, t) + (i % 3) * 0.3;
        const drift = (i % 2 === 0 ? -1 : 1) * (5 + (i * 5) % 14);
        const dot = lerp(1.6, 2.8, t) + (i % 2) * 0.4;
        return (
          <span
            key={`ember-${i}`}
            className="absolute rounded-full"
            style={{
              width: dot,
              height: dot,
              left: `${left}%`,
              bottom: "12%",
              background: i % 4 === 0 ? palette.core : palette.inner,
              boxShadow: `0 0 ${dot * 3.5}px ${palette.aura}, 0 0 ${dot * 7}px ${palette.aura.replace(")", " / 0.5)")}`,
              opacity: 0,
              ["--ember-x" as string]: `${drift}px`,
              ["--ember-rise" as string]: `-${flameH * 1.5}px`,
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
        const left = 18 + ((i * 13) % 64);
        const delay = (i * 0.21) % 3;
        const duration = lerp(2.2, 1.4, t) + (i % 4) * 0.25;
        const drift = (i % 2 === 0 ? 1 : -1) * (3 + (i * 3) % 10);
        const dot = lerp(1.0, 1.6, t);
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
              boxShadow: `0 0 ${dot * 4}px ${palette.spark}`,
              opacity: 0,
              ["--ember-x" as string]: `${drift}px`,
              ["--ember-rise" as string]: `-${flameH * 1.2}px`,
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
