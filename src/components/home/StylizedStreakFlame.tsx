import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * StylizedStreakFlame — clean, AAA-game-VFX-style streak flame that grows
 * progressively from a tiny flicker into a roaring blaze as the streak grows.
 *
 *  Stages (mapped to existing streak-tier thresholds in src/lib/streak.ts):
 *    1. Tiny flicker         — 1–2d   (pre-Ignited)
 *    2. Small steady flame   — 3–6d   (Ignited)
 *    3. Medium active fire   — 7–13d  (Heating Up)
 *    4. Large energetic      — 14–29d (On Fire)
 *    5. Champion blaze       — 30–59d (Champion)
 *    6. Diamond              — 60–99d
 *    7. Legendary            — 100–199d (aurora hue shift)
 *    8. Inferno              — 200d+   (plasma core)
 *
 *  Continuous interpolation of size, brightness, aura radius, ember count
 *  and pulse speed so a 5d streak is *visibly* bigger than a 3d streak — no
 *  sudden jumps inside a tier.
 *
 *  Polish:
 *    - Stage-up burst (~700ms): expanding ring + 8 ember rays + brightness pulse
 *    - Energy aura halo growing with stage
 *    - Glowing core: orange → yellow-white → cyan-white as stage rises
 *    - Subtle blue base from stage 4+
 *    - Smooth flicker via SVG turbulence (per-instance seed)
 *    - Respects prefers-reduced-motion
 */
interface StylizedStreakFlameProps {
  /** The user's effective streak in days. */
  streak: number;
  /** Pixel size of the flame container. Default 140. */
  size?: number;
  className?: string;
}

const STAGE_THRESHOLDS = [1, 3, 7, 14, 30, 60, 100, 200];
const MAX_STAGE_INDEX = STAGE_THRESHOLDS.length; // 8

const stageFromStreak = (streak: number) => {
  if (streak < 1) return 0;
  let s = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (streak >= STAGE_THRESHOLDS[i]) s = i + 1;
  }
  return s;
};

/** Continuous progress 0..1 across the full ladder for smooth scaling. */
const progressFromStreak = (streak: number) => {
  if (streak <= 0) return 0;
  // Find current and next tier
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
  // Stage index becomes the integer part; sub-tier progress the fraction
  const stage = stageFromStreak(streak);
  const span = Math.max(1, next - prev);
  const sub = Math.min(1, Math.max(0, (streak - prev) / span));
  // Map (stage + sub) to 0..1 across MAX_STAGE_INDEX
  return Math.min(1, (stage - 1 + sub) / MAX_STAGE_INDEX);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const StylizedStreakFlame = ({ streak, size = 140, className }: StylizedStreakFlameProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const stage = stageFromStreak(streak);
  const t = progressFromStreak(streak); // 0..1 continuous
  const isCold = stage === 0;

  // Per-instance seed so two flames don't sync flicker
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    return {
      a: (h % 30) + 1,
      b: ((h >> 8) % 40) + 5,
      delay: -((h % 1700) / 1000),
    };
  }, [uid]);

  // ── Stage-up burst detection ──────────────────────────────────────────
  const [burst, setBurst] = useState(false);
  const prevStageRef = useRef(stage);
  useEffect(() => {
    if (stage > prevStageRef.current) {
      setBurst(true);
      const id = setTimeout(() => setBurst(false), 750);
      prevStageRef.current = stage;
      return () => clearTimeout(id);
    }
    prevStageRef.current = stage;
  }, [stage]);

  // ── Continuous scaling ────────────────────────────────────────────────
  // Flame body height (within the size box)
  const flameH = lerp(0.35, 0.92, t) * size; // 0.35*size at 0d → 0.92*size at 200d+
  const flameW = lerp(0.28, 0.55, t) * size;
  const auraR = lerp(0.55, 1.35, t) * size; // halo radius
  const auraOpacity = lerp(0.18, 0.55, t);
  const coreBright = lerp(0.5, 1.0, t);
  const flickerSpeed = lerp(2.4, 0.7, t); // sec — faster at high tier
  const turbSpeed = lerp(2.2, 0.85, t);
  const displaceBase = lerp(1.4, 3.0, t);
  const displacePeak = displaceBase * 1.4;
  const emberCount = isCold ? 0 : Math.round(lerp(0, 14, t));
  const showBlueBase = stage >= 4;
  const showRays = stage >= 4;

  // ── Tier palette ──────────────────────────────────────────────────────
  // Colors transition from warm orange → richer hues at higher stages
  const palette = useMemo(() => {
    if (stage >= 8) {
      // Inferno — plasma
      return {
        outer: "hsl(310 90% 58%)",
        mid: "hsl(265 90% 62%)",
        inner: "hsl(195 95% 70%)",
        core: "hsl(180 100% 95%)",
        aura: "hsl(195 95% 60%)",
        base: "hsl(195 100% 70%)",
      };
    }
    if (stage >= 7) {
      // Legendary — aurora
      return {
        outer: "hsl(300 85% 60%)",
        mid: "hsl(35 100% 60%)",
        inner: "hsl(48 100% 75%)",
        core: "hsl(60 100% 95%)",
        aura: "hsl(280 80% 60%)",
        base: "hsl(200 95% 70%)",
      };
    }
    if (stage >= 6) {
      // Diamond — cool blue edges
      return {
        outer: "hsl(190 90% 60%)",
        mid: "hsl(40 95% 60%)",
        inner: "hsl(50 100% 76%)",
        core: "hsl(58 100% 92%)",
        aura: "hsl(200 85% 60%)",
        base: "hsl(200 95% 72%)",
      };
    }
    if (stage >= 5) {
      // Champion blaze
      return {
        outer: "hsl(22 95% 50%)",
        mid: "hsl(38 95% 60%)",
        inner: "hsl(50 100% 72%)",
        core: "hsl(56 100% 90%)",
        aura: "hsl(28 95% 55%)",
        base: "hsl(200 90% 70%)",
      };
    }
    if (stage >= 4) {
      // Large energetic
      return {
        outer: "hsl(16 92% 50%)",
        mid: "hsl(28 95% 58%)",
        inner: "hsl(44 100% 68%)",
        core: "hsl(52 100% 88%)",
        aura: "hsl(20 95% 55%)",
        base: "hsl(210 85% 68%)",
      };
    }
    if (stage >= 3) {
      // Medium active
      return {
        outer: "hsl(14 90% 48%)",
        mid: "hsl(24 95% 56%)",
        inner: "hsl(40 100% 64%)",
        core: "hsl(48 100% 82%)",
        aura: "hsl(18 92% 52%)",
        base: "hsl(210 75% 65%)",
      };
    }
    if (stage >= 2) {
      // Small steady
      return {
        outer: "hsl(12 88% 46%)",
        mid: "hsl(20 92% 54%)",
        inner: "hsl(36 95% 62%)",
        core: "hsl(46 100% 78%)",
        aura: "hsl(16 90% 50%)",
        base: "hsl(20 90% 50%)",
      };
    }
    // stage 1 — tiny flicker
    return {
      outer: "hsl(10 85% 44%)",
      mid: "hsl(18 88% 52%)",
      inner: "hsl(32 92% 60%)",
      core: "hsl(42 100% 75%)",
      aura: "hsl(14 88% 50%)",
      base: "hsl(18 88% 50%)",
    };
  }, [stage]);

  // Authentic candle-flame silhouette
  const FLAME_PATH =
    "M20 4 C 22 11, 26 16, 28 22 C 30 28, 30 35, 28 41 C 26 47, 23 51, 20 53 C 17 51, 14 47, 12 41 C 10 35, 10 28, 12 22 C 14 16, 18 11, 20 4 Z";

  const filterId = `ssf-turb-${uid}`;
  const bodyGradId = `ssf-body-${uid}`;
  const innerGradId = `ssf-inner-${uid}`;
  const coreGradId = `ssf-core-${uid}`;

  // Cold state — soft outline candle
  if (isCold) {
    return (
      <div
        className={cn("relative pointer-events-none flex items-end justify-center", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg width={size * 0.32} height={size * 0.45} viewBox="0 0 40 56" fill="none" className="opacity-40">
          <path
            d={FLAME_PATH}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="text-muted-foreground"
          />
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
        animation: `stylized-flame-bob ${(flickerSpeed * 2.2).toFixed(2)}s ease-in-out infinite`,
      }}
      aria-hidden
    >
      {/* SVG defs */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.024 0.055" numOctaves="2" seed={seed.a}>
              <animate
                attributeName="baseFrequency"
                dur={`${turbSpeed.toFixed(2)}s`}
                values="0.024 0.055;0.04 0.085;0.026 0.06;0.045 0.09;0.024 0.055"
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                dur={`${(turbSpeed * 2.3).toFixed(2)}s`}
                values={`${seed.a};${seed.b};${seed.a + 7};${seed.b + 3};${seed.a}`}
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
            <stop offset="0%" stopColor={palette.outer} stopOpacity="0.95" />
            <stop offset="55%" stopColor={palette.mid} stopOpacity="0.95" />
            <stop offset="90%" stopColor={palette.inner} stopOpacity="0.85" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={innerGradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor={palette.mid} stopOpacity="0.9" />
            <stop offset="60%" stopColor={palette.inner} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={coreGradId} cx="50%" cy="65%" r="45%">
            <stop offset="0%" stopColor={palette.core} stopOpacity="1" />
            <stop offset="55%" stopColor={palette.inner} stopOpacity="0.6" />
            <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* ─── Energy aura halo ─── */}
      <span
        className="absolute left-1/2 bottom-0 rounded-full"
        style={{
          width: auraR * 2,
          height: auraR * 1.6,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 70%, ${palette.aura.replace(")", ` / ${auraOpacity.toFixed(2)})`)} 0%, ${palette.aura.replace(")", " / 0.08)")} 45%, transparent 75%)`,
          filter: `blur(${Math.max(6, size * 0.07)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-aura-pulse ${(flickerSpeed * 2.6).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${seed.delay}s`,
          zIndex: 0,
          willChange: "transform, opacity",
        }}
      />

      {/* ─── Stage-up burst: shockwave ring ─── */}
      {burst && (
        <span
          className="absolute left-1/2 bottom-[20%] rounded-full"
          style={{
            width: auraR * 1.6,
            height: auraR * 1.6,
            transform: "translateX(-50%) translateY(50%)",
            border: `2px solid ${palette.aura}`,
            boxShadow: `0 0 24px ${palette.aura}`,
            animation: "stylized-stage-burst 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            mixBlendMode: "screen",
            zIndex: 5,
          }}
        />
      )}

      {/* ─── Stage-up burst: 8 ember rays ─── */}
      {burst &&
        Array.from({ length: 8 }).map((_, i) => (
          <span
            key={`ray-${i}`}
            className="absolute left-1/2 bottom-[35%] rounded-full"
            style={{
              width: 3,
              height: 14,
              background: `linear-gradient(180deg, ${palette.core}, ${palette.aura}, transparent)`,
              boxShadow: `0 0 10px ${palette.aura}`,
              transformOrigin: "center bottom",
              ["--ray-angle" as string]: `${(i / 8) * 360}deg`,
              animation: "stylized-ray-shoot 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              animationDelay: `${(i % 4) * 0.025}s`,
              mixBlendMode: "screen",
              zIndex: 6,
            }}
          />
        ))}

      {/* ─── Cool blue base (stage 4+) ─── */}
      {showBlueBase && (
        <span
          className="absolute left-1/2 bottom-[6%] rounded-full"
          style={{
            width: flameW * 1.2,
            height: flameW * 0.32,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 50%, ${palette.base.replace(")", " / 0.7)")} 0%, ${palette.base.replace(")", " / 0.25)")} 45%, transparent 80%)`,
            filter: `blur(${Math.max(2, size * 0.02)}px)`,
            mixBlendMode: "screen",
            zIndex: 2,
          }}
        />
      )}

      {/* ─── Outer flame body (turbulence-warped) ─── */}
      <svg
        width={flameW}
        height={flameH}
        viewBox="0 0 40 56"
        className="absolute left-1/2 bottom-[5%]"
        style={{
          transform: "translateX(-50%)",
          transformOrigin: "center bottom",
          filter: `url(#${filterId}) drop-shadow(0 0 ${size * 0.08}px ${palette.mid})`,
          animation: `stylized-flame-flicker ${flickerSpeed.toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${seed.delay}s`,
          mixBlendMode: "screen",
          zIndex: 3,
          willChange: "transform, opacity",
        }}
      >
        <path d={FLAME_PATH} fill={`url(#${bodyGradId})`} />
      </svg>

      {/* ─── Inner body (smaller, brighter, faster flicker) ─── */}
      <svg
        width={flameW * 0.65}
        height={flameH * 0.85}
        viewBox="0 0 40 56"
        className="absolute left-1/2 bottom-[7%]"
        style={{
          transform: "translateX(-50%)",
          transformOrigin: "center bottom",
          filter: `url(#${filterId}) drop-shadow(0 0 ${size * 0.05}px ${palette.inner})`,
          animation: `stylized-flame-flicker ${(flickerSpeed * 0.78).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `${(seed.delay - 0.4).toFixed(2)}s`,
          mixBlendMode: "screen",
          zIndex: 4,
          willChange: "transform, opacity",
        }}
      >
        <path d={FLAME_PATH} fill={`url(#${innerGradId})`} />
      </svg>

      {/* ─── White-hot core ─── */}
      <svg
        width={flameW * 0.4}
        height={flameH * 0.65}
        viewBox="0 0 40 56"
        className="absolute left-1/2 bottom-[10%]"
        style={{
          transform: "translateX(-50%)",
          transformOrigin: "center bottom",
          filter: `drop-shadow(0 0 ${size * 0.12 * coreBright}px ${palette.core})`,
          animation: `stylized-flame-core ${(flickerSpeed * 0.55).toFixed(2)}s ease-in-out infinite`,
          opacity: coreBright,
          mixBlendMode: "screen",
          zIndex: 5,
          willChange: "transform, opacity",
        }}
      >
        <path d={FLAME_PATH} fill={`url(#${coreGradId})`} />
      </svg>

      {/* ─── Embers rising ─── */}
      {Array.from({ length: emberCount }).map((_, i) => {
        const left = 30 + ((i * 19) % 40);
        const delay = (i / Math.max(1, emberCount)) * 2.2 + ((i * 0.13) % 0.6);
        const duration = lerp(2.6, 1.6, t) + (i % 3) * 0.3;
        const drift = (i % 2 === 0 ? -1 : 1) * (4 + (i * 5) % 12);
        const dot = lerp(1.5, 2.6, t) + (i % 2) * 0.4;
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
              boxShadow: `0 0 ${dot * 3}px ${palette.aura}`,
              opacity: 0,
              ["--ember-x" as string]: `${drift}px`,
              ["--ember-rise" as string]: `-${flameH * 1.4}px`,
              animation: `stylized-ember-rise ${duration.toFixed(2)}s ease-out infinite`,
              animationDelay: `${delay.toFixed(2)}s`,
              mixBlendMode: "screen",
              zIndex: 4,
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
            background: `radial-gradient(circle at 50% 70%, ${palette.core.replace(")", " / 0.6)")} 0%, transparent 55%)`,
            mixBlendMode: "screen",
            animation: "stylized-burst-flash 0.7s ease-out forwards",
            zIndex: 7,
          }}
        />
      )}
    </div>
  );
};

export default StylizedStreakFlame;
