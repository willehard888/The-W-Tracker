import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { triggerFlameShockwave } from "@/lib/wind";

export interface RealisticFlameHandle {
  /** Trigger a tier-up shockwave ring centered on the flame. */
  shockwave: (color?: string) => void;
}

interface RealisticFlameProps {
  /** 0-5 — controls intensity, color richness, particle counts */
  tier: number;
  /** Outer accent color (hsl string) */
  accent: string;
  /** Pixel size of the flame container */
  size?: number;
  className?: string;
  /**
   * Enables pointer-wind reactivity (flame leans toward cursor) and a heavier
   * heat-haze layer. Auto-enabled at size >= 64; explicitly opt-out with `false`.
   */
  interactive?: boolean;
  /**
   * 0..1 — fills the frozen mystery prize from the bottom up, like a progress
   * bar of melt-water rising inside the prism. At 1.0 the prize is fully
   * thawed and ready to drop. Animations themselves are unchanged.
   */
  prizeProgress?: number;
  /** Glyph shown inside the ice (default "?"). When revealed, can be a 🏆/🎖️/etc. */
  prizeGlyph?: string;
  /**
   * Rewards (emoji or short text) that the ice has released. Each entry will
   * fall from the prize down past the flame on a unique trajectory. Pass a
   * stable array — mounting a new index triggers a new drop.
   */
  droppedRewards?: string[];
}

/**
 * RealisticFlame v2 — cinematic, volumetric, alive.
 *
 *  EIGHT layers of depth (back → front):
 *    1. Volumetric backlight bloom (mix-blend screen — lights surroundings)
 *    2. Updraft cone (vertical hot air)
 *    3. Heat distortion ring
 *    4. Outer haze (soft, drifting)
 *    5. Outer flame body (warp turb-1)
 *    6. Mid body (warp turb-2)
 *    7. Inner body (warp turb-3, faster)
 *    8. White-hot core + tip whip
 *
 *  PLUS: hot wick line + ember plate at the base, detached tongues,
 *  arcing sparks (Blazing+), ribboning smoke wisps (Blazing+),
 *  spark crown above the tip (Diamond+), tier-driven hue shift on
 *  Legendary so the whole flame shimmers like an aurora.
 *
 *  THREE independent feTurbulence filters give layers their own
 *  warp rhythm so the silhouette never repeats and genuinely "lives".
 *
 *  A slow sine sway on the outer wrapper makes the entire flame lean
 *  like wind is on it.
 */
const RealisticFlame = forwardRef<RealisticFlameHandle, RealisticFlameProps>(
  ({ tier, accent, size = 44, className, interactive, prizeProgress, prizeGlyph, droppedRewards }, ref) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pointer wind: enable on big interactive flames by default.
  const pointerEnabled = interactive ?? size >= 64;

  // Per-instance breath offset (0–6s) so multiple flames don't sync inhale.
  const breathOffset = useMemo(() => {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    return ((h % 600) / 100).toFixed(2); // 0.00..6.00
  }, [uid]);

  // Imperative shockwave handle for tier-up celebrations.
  useImperativeHandle(
    ref,
    () => ({
      shockwave: (color?: string) => triggerFlameShockwave(containerRef.current, color),
    }),
    [],
  );

  // Local pointer-wind: when the cursor is within ~80px of this flame, write
  // a *local* CSS var that adds an extra lean. Throttled via rAF.
  useEffect(() => {
    if (!pointerEnabled) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let pendingX = 0;
    let lastWritten = "";

    const apply = () => {
      raf = 0;
      const s = pendingX.toFixed(2);
      if (s !== lastWritten) {
        lastWritten = s;
        el.style.setProperty("--pointer-wind-x", s);
      }
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const radius = Math.max(80, size * 1.6);
      if (dist > radius) {
        pendingX = 0;
      } else {
        const strength = 1 - dist / radius;
        pendingX = Math.max(-1, Math.min(1, (dx / radius) * strength * 1.4));
      }
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      pendingX = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      el.style.removeProperty("--pointer-wind-x");
    };
  }, [pointerEnabled, size]);


  const isHot = tier >= 0;
  const isWarm = tier >= 1;
  const isOnFire = tier >= 2;
  const isBlazing = tier >= 3;
  const isDiamond = tier >= 4;
  const isLegendary = tier >= 5;
  const isInferno = tier >= 6; // plasma ceiling — only in hero-sized instances

  /* ── Tier-driven palette: hotter → whiter core, richer outer ─────── */
  const palette = useMemo(() => {
    if (isInferno) {
      // Plasma — magenta-to-cyan with a blinding white core
      return {
        backlight: "hsl(195 95% 60%)",
        haze: "hsl(310 80% 55%)",
        outer: "hsl(310 85% 60%)",
        mid: "hsl(265 80% 60%)",
        inner: "hsl(195 90% 70%)",
        core: "hsl(180 100% 95%)",
        coal: "hsl(310 80% 55%)",
        wick: "hsl(195 100% 85%)",
      };
    }
    if (isLegendary) {
      return {
        backlight: "hsl(310 80% 55%)",
        haze: "hsl(280 80% 55%)",
        outer: "hsl(300 75% 60%)",
        mid: "hsl(35 100% 60%)",
        inner: "hsl(48 100% 75%)",
        core: "hsl(60 100% 95%)",
        coal: "hsl(18 95% 55%)",
        wick: "hsl(40 100% 80%)",
      };
    }
    if (isDiamond) {
      return {
        backlight: "hsl(200 95% 55%)",
        haze: "hsl(200 85% 50%)",
        outer: "hsl(190 90% 60%)",
        mid: "hsl(40 95% 60%)",
        inner: "hsl(48 100% 74%)",
        core: "hsl(58 100% 92%)",
        coal: "hsl(28 95% 55%)",
        wick: "hsl(40 100% 78%)",
      };
    }
    if (isBlazing) {
      return {
        backlight: "hsl(28 95% 50%)",
        haze: "hsl(22 95% 45%)",
        outer: "hsl(28 95% 52%)",
        mid: "hsl(40 95% 60%)",
        inner: "hsl(48 100% 70%)",
        core: "hsl(56 100% 88%)",
        coal: "hsl(18 95% 50%)",
        wick: "hsl(42 100% 76%)",
      };
    }
    if (isOnFire) {
      return {
        backlight: "hsl(16 92% 48%)",
        haze: "hsl(12 90% 42%)",
        outer: "hsl(16 92% 50%)",
        mid: "hsl(28 95% 58%)",
        inner: "hsl(42 100% 65%)",
        core: "hsl(48 100% 82%)",
        coal: "hsl(14 90% 48%)",
        wick: "hsl(42 100% 72%)",
      };
    }
    if (isWarm) {
      return {
        backlight: "hsl(14 88% 46%)",
        haze: "hsl(10 85% 40%)",
        outer: "hsl(14 88% 48%)",
        mid: "hsl(20 92% 56%)",
        inner: "hsl(32 95% 62%)",
        core: "hsl(42 100% 78%)",
        coal: "hsl(12 85% 45%)",
        wick: "hsl(42 100% 68%)",
      };
    }
    return {
      backlight: "hsl(12 80% 42%)",
      haze: "hsl(8 80% 36%)",
      outer: accent,
      mid: "hsl(18 90% 55%)",
      inner: "hsl(28 95% 62%)",
      core: "hsl(42 100% 75%)",
      coal: "hsl(12 80% 42%)",
      wick: "hsl(42 100% 65%)",
    };
  }, [tier, accent, isWarm, isOnFire, isBlazing, isDiamond, isLegendary, isInferno]);

  // Higher tier = faster flicker
  const speedMul = isInferno ? 0.4 : isLegendary ? 0.5 : isDiamond ? 0.65 : isBlazing ? 0.8 : isOnFire ? 0.95 : isWarm ? 1.2 : 1.5;

  // Detached "tongues" that rise off flame top — more, taller, with curve
  const tongueCount = isInferno ? 14 : isLegendary ? 10 : isDiamond ? 8 : isBlazing ? 6 : isOnFire ? 4 : isWarm ? 3 : 2;
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

  // Sparks — pinpoint shots that fly out (Blazing+) — now arc, not linear
  const sparkCount = isLegendary ? 10 : isDiamond ? 7 : isBlazing ? 5 : 0;
  const sparks = useMemo(
    () =>
      Array.from({ length: sparkCount }).map((_, i) => ({
        leftPct: 30 + ((i * 23) % 40),
        delay: (i * 0.41) % 2.4,
        duration: 1.6 + (i % 3) * 0.4,
        // Arc trajectory — sideways drift mid-flight
        xMid: -8 + (i % 5) * 4,
        xEnd: -16 + (i % 3) * 12,
        yMid: -16 - (i % 4) * 4,
        yEnd: -34 - (i % 4) * 8,
        size: 1 + (i % 2),
      })),
    [sparkCount],
  );

  // Smoke wisps (Blazing+) — taller, with rotation drift
  const smokeCount = isLegendary ? 5 : isDiamond ? 4 : isBlazing ? 3 : 0;
  const smokes = useMemo(
    () =>
      Array.from({ length: smokeCount }).map((_, i) => ({
        delay: i * 1.1,
        duration: 3.6 + (i % 2) * 0.7,
        xDrift: (i % 2 === 0 ? 1 : -1) * (6 + i * 3),
        rotate: (i % 2 === 0 ? 1 : -1) * (8 + i * 4),
        leftPct: 38 + (i % 3) * 8,
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

  // Spark crown — small fireflies above the tip (Diamond+)
  // (Kept for backward-compat behavior; ember field below replaces visually on Diamond+)
  const crownCount = isLegendary ? 6 : isDiamond ? 4 : 0;
  const crown = useMemo(
    () =>
      Array.from({ length: crownCount }).map((_, i) => ({
        leftPct: 26 + (i * 48) / Math.max(1, crownCount - 1),
        delay: (i * 0.37) % 1.8,
        duration: 1.8 + (i % 3) * 0.4,
        size: 1.3 + (i % 2) * 0.6,
      })),
    [crownCount],
  );

  // Living ember field (Diamond+) — drifts on global wind + local pointer wind.
  // Replaces static crown with reactive particles. Particle count scales with size.
  const emberCount = isDiamond ? Math.min(12, Math.max(6, Math.round(size / 8))) : 0;
  const embers = useMemo(
    () =>
      Array.from({ length: emberCount }).map((_, i) => {
        const seed = (i * 2654435761) >>> 0;
        return {
          leftPct: 22 + (seed % 56),
          delay: ((seed >> 4) % 280) / 100, // 0..2.8s
          duration: 3.2 + ((seed >> 8) % 220) / 100, // 3.2..5.4s
          rise: -(size * 1.2 + ((seed >> 12) % Math.max(20, size))), // -size*1.2 .. -size*2.2
          dotSize: 1.4 + ((seed >> 16) % 18) / 10, // 1.4..3.2px
        };
      }),
    [emberCount, size],
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

  // Filter ids unique per instance — three independent turbs
  const turbSlow = `turbSlow-${uid}`;
  const turbMid = `turbMid-${uid}`;
  const turbFast = `turbFast-${uid}`;

  // Inferno spirals through plasma hues; Legendary/Diamond aurora wash.
  const hueAnim = isInferno
    ? "flame-plasma-hue 5s linear infinite"
    : isLegendary
    ? "flame-aurora-hue 8s linear infinite"
    : isDiamond
    ? "flame-aurora-hue 16s linear infinite"
    : undefined;

  // Wind reactivity — lean from --wind-x (-1..1) and stretch from --wind-gust (0..1).
  // Combined with the existing slow sway keyframe so the flame still has organic motion
  // even before the wind loop has had time to evolve. On interactive flames the local
  // --pointer-wind-x adds a subtle "you're watching me" lean toward the cursor.
  const windTransform = pointerEnabled
    ? "rotate(calc(var(--wind-x, 0) * 3.5deg + var(--wind-gust, 0) * 4deg + var(--pointer-wind-x, 0) * 6deg)) " +
      "scaleY(calc(1 + var(--wind-gust, 0) * 0.12)) " +
      "translateX(calc(var(--wind-x, 0) * 1px + var(--pointer-wind-x, 0) * 2px))"
    : "rotate(calc(var(--wind-x, 0) * 3.5deg + var(--wind-gust, 0) * 4deg)) " +
      "scaleY(calc(1 + var(--wind-gust, 0) * 0.12)) " +
      "translateX(calc(var(--wind-x, 0) * 1px))";

  // Ground-cast color uses the warm haze so it visually "matches" the flame's heat.
  const groundCastColor = palette.haze;

  return (
    <div
      ref={containerRef}
      data-flame-interactive={pointerEnabled ? "true" : undefined}
      className={cn("relative pointer-events-none", className)}
      style={{
        width: size,
        height: size,
        // Wind-driven lean + gust stretch (CSS-var, no React rerenders).
        // The flame still has its own organic flicker from the per-layer keyframes.
        transform: windTransform,
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        transformOrigin: "center bottom",
      }}
      aria-hidden
    >
      {/* -2. Radiant halo bloom — large pulsing glow that lives BEHIND the flame.
          Screen-blended so it lights the surroundings without dimming them.
          This is the new "beauty" layer: makes the flame feel actually radiant. */}
      {isHot && (
        <span
          aria-hidden
          className="absolute left-1/2 bottom-0 pointer-events-none rounded-full"
          style={{
            width: size * 2.6,
            height: size * 2.2,
            background: `radial-gradient(ellipse at 50% 70%, ${palette.backlight.replace(")", " / 0.55)")} 0%, ${palette.haze.replace(")", " / 0.22)")} 38%, transparent 72%)`,
            mixBlendMode: "screen",
            animation: `flame-halo-bloom ${(4.2 * speedMul).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `-${breathOffset}s`,
            zIndex: -2,
            willChange: "opacity, transform, filter",
          }}
        />
      )}

      {/* -1. Cast shadow — chiaroscuro: deepens when the flame is brightest,
          giving the bloom contrast and dimensional anchoring. */}
      <span
        aria-hidden
        className="absolute left-1/2 pointer-events-none rounded-[50%]"
        style={{
          width: size * 2.0,
          height: size * 0.42,
          bottom: -size * 0.14,
          background: `radial-gradient(ellipse at 50% 50%, hsl(0 0% 0% / 0.5) 0%, hsl(0 0% 0% / 0.26) 45%, transparent 78%)`,
          filter: `blur(${Math.max(6, size * 0.12)}px)`,
          transform: "translateX(-50%)",
          transformOrigin: "50% 50%",
          animation: `flame-chiaroscuro ${(5.5 * speedMul).toFixed(2)}s ease-in-out infinite`,
          animationDelay: `-${breathOffset}s`,
          zIndex: -1,
        }}
      />

      {/* 0. Volumetric ground light — projects onto the surface BELOW the flame.
          Sits outside the breathing wrapper so it pulses on its own rhythm. */}
      {isWarm && (
        <span
          className="flame-ground-cast absolute left-1/2 pointer-events-none rounded-[50%]"
          style={{
            width: size * 2.4,
            height: size * 0.55,
            bottom: -size * 0.18,
            background: `radial-gradient(ellipse at 50% 50%, ${groundCastColor.replace(")", " / 0.65)")} 0%, ${groundCastColor.replace(")", " / 0.22)")} 45%, transparent 78%)`,
            filter: "blur(10px)",
            mixBlendMode: "screen",
            transformOrigin: "50% 50%",
            animation: `flame-ground-cast ${(5 * speedMul).toFixed(2)}s ease-in-out infinite`,
            animationDelay: `-${breathOffset}s`,
            zIndex: 0,
          }}
        />
      )}

      {/* True heat haze — actually warps what's BEHIND the flame (Blazing+ & big). */}
      {isBlazing && size >= 56 && (
        <svg
          aria-hidden
          className="absolute left-1/2 bottom-0 pointer-events-none"
          width={size * 1.6}
          height={size * 1.5}
          viewBox="0 0 40 56"
          style={{
            transform: "translateX(-50%)",
            zIndex: -1,
            mixBlendMode: "screen",
            filter: `url(#${turbSlow})`,
            opacity: 0.35,
          }}
        >
          <ellipse cx="20" cy="36" rx="18" ry="22" fill={palette.haze} fillOpacity="0.25" />
        </svg>
      )}

      {/* ── Premium volumetric glass-refraction halo (STATIC, no animation).
          Three stacked layers fake the way warm light passes through a polished
          glass dome around the flame:
            (1) Inner refractive halo — soft warm core glow that looks "lensed"
            (2) Iridescent edge ring — cool→warm hue shift band along the rim
            (3) Outer caustic ring — faint cool edge that mimics dispersion */}
      {isHot && (
        <>
          <span
            aria-hidden
            className="absolute left-1/2 pointer-events-none rounded-full"
            style={{
              width: size * 1.55,
              height: size * 1.45,
              bottom: size * 0.05,
              transform: "translateX(-50%)",
              background: `radial-gradient(ellipse at 50% 60%, ${palette.inner.replace(")", " / 0.32)")} 0%, ${palette.haze.replace(")", " / 0.14)")} 38%, transparent 70%)`,
              filter: `blur(${Math.max(8, size * 0.18)}px)`,
              mixBlendMode: "screen",
              zIndex: -1,
            }}
          />

          {isWarm && (
            <span
              aria-hidden
              className="absolute left-1/2 pointer-events-none rounded-full"
              style={{
                width: size * 1.85,
                height: size * 1.7,
                bottom: 0,
                transform: "translateX(-50%)",
                background:
                  `conic-gradient(from 200deg at 50% 65%, ` +
                  `transparent 0deg, ` +
                  `hsl(210 80% 60% / 0.08) 60deg, ` +
                  `hsl(42 90% 65% / 0.14) 130deg, ` +
                  `hsl(28 95% 60% / 0.18) 180deg, ` +
                  `hsl(310 70% 60% / 0.10) 240deg, ` +
                  `hsl(210 80% 60% / 0.08) 300deg, ` +
                  `transparent 360deg)`,
                filter: `blur(${Math.max(10, size * 0.22)}px)`,
                mixBlendMode: "screen",
                opacity: isLegendary ? 0.85 : isDiamond ? 0.7 : isBlazing ? 0.55 : 0.4,
                zIndex: -2,
              }}
            />
          )}

          {isOnFire && (
            <span
              aria-hidden
              className="absolute left-1/2 pointer-events-none rounded-full"
              style={{
                width: size * 2.2,
                height: size * 1.95,
                bottom: -size * 0.05,
                transform: "translateX(-50%)",
                border: `1px solid ${palette.haze.replace(")", " / 0.14)")}`,
                background: `radial-gradient(ellipse at 50% 55%, transparent 55%, ${palette.haze.replace(")", " / 0.06)")} 70%, transparent 88%)`,
                filter: `blur(${Math.max(6, size * 0.14)}px)`,
                mixBlendMode: "screen",
                zIndex: -2,
              }}
            />
          )}
        </>
      )}

      {/* SVG defs (3 turbulence filters shared by layered flame bodies) */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          {/* Slow drift — outer haze */}
          <filter id={turbSlow} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014 0.035"
              numOctaves="3"
              seed="2"
            >
              <animate
                attributeName="baseFrequency"
                dur={`${4.2 * speedMul}s`}
                values="0.012 0.03;0.022 0.05;0.014 0.038;0.024 0.06;0.012 0.03"
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                dur={`${7 * speedMul}s`}
                values="2;13;5;19;2"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
          {/* Mid licking — main body */}
          <filter id={turbMid} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025 0.06"
              numOctaves="3"
              seed="9"
            >
              <animate
                attributeName="baseFrequency"
                dur={`${2.4 * speedMul}s`}
                values="0.02 0.05;0.038 0.085;0.026 0.06;0.04 0.09;0.02 0.05"
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                dur={`${4 * speedMul}s`}
                values="9;22;4;17;9"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="4.5" />
          </filter>
          {/* Fast tip whip — inner + core */}
          <filter id={turbFast} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.05 0.11"
              numOctaves="2"
              seed="14"
            >
              <animate
                attributeName="baseFrequency"
                dur={`${1.6 * speedMul}s`}
                values="0.04 0.09;0.07 0.14;0.045 0.10;0.08 0.16;0.04 0.09"
                repeatCount="indefinite"
              />
              <animate
                attributeName="seed"
                dur={`${3 * speedMul}s`}
                values="14;27;6;31;14"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="3.2" />
          </filter>
        </defs>
      </svg>

      {/* 1. Volumetric backlight — lights up surroundings (mix-blend screen) */}
      {isWarm && (
        <span
          className="absolute left-1/2 bottom-0 rounded-full pointer-events-none"
          style={{
            width: size * 1.8,
            height: size * 1.7,
            transform: "translateX(-50%) translateY(8%)",
            background: `radial-gradient(ellipse at 50% 75%, ${palette.backlight.replace(")", " / 0.42)")} 0%, ${palette.haze.replace(")", " / 0.18)")} 38%, transparent 72%)`,
            filter: "blur(14px)",
            mixBlendMode: "screen",
            animation: `flame-backlight-breathe ${2.6 * speedMul}s ease-in-out infinite`,
          }}
        />
      )}

      {/* 2. Updraft cone — vertical hot air rising from base */}
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

      {/* 3. Heat distortion ring */}
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

      {/* Hot wick base — bright origin line + ember plate */}
      {isHot && (
        <>
          <span
            className="absolute left-1/2 rounded-full pointer-events-none"
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
          {/* Bright wick line — the believable origin */}
          <span
            className="absolute left-1/2 rounded-full pointer-events-none"
            style={{
              width: size * 0.18,
              height: size * 0.04,
              bottom: 0,
              background: `linear-gradient(90deg, transparent, ${palette.wick}, transparent)`,
              transform: "translateX(-50%)",
              boxShadow: `0 0 ${size * 0.18}px ${palette.wick}`,
              animation: `flame-wick-pulse ${1.8 * speedMul}s ease-in-out infinite`,
            }}
          />
        </>
      )}

      {/* ── Premium glass "source plate" — static (no animations). ──────────
          Three composited layers fake a polished glass/obsidian disc that the
          flame appears to rise from:
            (a) Disc body — dark obsidian puck with subtle warm tint
            (b) Top specular sweep — the polished rim catching the light
            (c) Inner caustic — warm pool of light reflected by the glass
          Pure presentation. No transforms over time, just static gradients. */}
      {isHot && (
        <>
          {/* (a) Glass disc body — sits below the wick, slightly wider than
                  the flame base. Layered gradients give it convexity + edge
                  refraction so it reads as a solid 3D puck. */}
          <span
            aria-hidden
            className="absolute left-1/2 rounded-[50%] pointer-events-none"
            style={{
              width: size * 1.05,
              height: size * 0.22,
              bottom: -size * 0.1,
              transform: "translateX(-50%)",
              background:
                // Top-down convex shading (lighter top edge, darker belly)
                `radial-gradient(ellipse at 50% 18%, hsl(0 0% 100% / 0.08) 0%, transparent 38%),` +
                // Side-edge refractive tint (cool blue facets at sides)
                `linear-gradient(90deg, hsl(210 60% 14% / 0.55) 0%, hsl(0 0% 6% / 0.8) 25%, hsl(0 0% 4% / 0.92) 50%, hsl(0 0% 6% / 0.8) 75%, hsl(210 60% 14% / 0.55) 100%),` +
                // Base obsidian
                `radial-gradient(ellipse at 50% 50%, hsl(0 0% 8%) 0%, hsl(0 0% 3%) 70%)`,
              boxShadow:
                // Outer contact shadow on the surface beneath
                `0 ${size * 0.04}px ${size * 0.18}px hsl(0 0% 0% / 0.6),` +
                // Inner top rim highlight (1px polished edge)
                `inset 0 1px 0 hsl(0 0% 100% / 0.22),` +
                // Inner bottom shadow (the disc has thickness)
                `inset 0 -1px 0 hsl(0 0% 0% / 0.7),` +
                // Warm halo seeping from above
                `0 -${size * 0.02}px ${size * 0.08}px ${palette.haze.replace(")", " / 0.35)")}`,
              zIndex: -1,
            }}
          />

          {/* (b) Top specular rim — bright pinched highlight where the polished
                  glass meets the light source above. The "wow" detail. */}
          <span
            aria-hidden
            className="absolute left-1/2 rounded-[50%] pointer-events-none"
            style={{
              width: size * 0.78,
              height: size * 0.06,
              bottom: -size * 0.005,
              transform: "translateX(-50%)",
              background:
                `linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / 0.18) 18%, ${palette.wick.replace(")", " / 0.92)")} 48%, hsl(0 0% 100% / 0.95) 50%, ${palette.wick.replace(")", " / 0.92)")} 52%, hsl(0 0% 100% / 0.18) 82%, transparent 100%)`,
              filter: "blur(0.5px)",
              mixBlendMode: "screen",
              opacity: 0.95,
            }}
          />

          {/* (c) Inner caustic — warm light pooling on the glass top surface,
                  as if the wick is dripping fuel. Gives the disc a "lit" feel. */}
          <span
            aria-hidden
            className="absolute left-1/2 rounded-[50%] pointer-events-none"
            style={{
              width: size * 0.55,
              height: size * 0.13,
              bottom: -size * 0.04,
              transform: "translateX(-50%)",
              background: `radial-gradient(ellipse at 50% 35%, ${palette.inner.replace(")", " / 0.7)")} 0%, ${palette.outer.replace(")", " / 0.35)")} 40%, transparent 75%)`,
              filter: "blur(2px)",
              mixBlendMode: "screen",
            }}
          />

          {/* (d) Side-facet glints — two small bright pips on the left/right
                  edges of the disc that catch ambient light, selling glass. */}
          {isWarm && (
            <>
              <span
                aria-hidden
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: Math.max(2, size * 0.04),
                  height: Math.max(2, size * 0.04),
                  left: `${50 - 42}%`,
                  bottom: -size * 0.06,
                  background: "hsl(200 90% 92% / 0.85)",
                  boxShadow: `0 0 ${size * 0.08}px hsl(200 90% 88% / 0.6)`,
                  filter: "blur(0.4px)",
                  mixBlendMode: "screen",
                }}
              />
              <span
                aria-hidden
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: Math.max(2, size * 0.04),
                  height: Math.max(2, size * 0.04),
                  right: `${50 - 42}%`,
                  bottom: -size * 0.06,
                  background: "hsl(42 100% 92% / 0.85)",
                  boxShadow: `0 0 ${size * 0.08}px ${palette.wick.replace(")", " / 0.7)")}`,
                  filter: "blur(0.4px)",
                  mixBlendMode: "screen",
                }}
              />
            </>
          )}
        </>
      )}



      {/* Composite of all SVG flame bodies — wrapped so we can hue-shift Legendary
          AND apply the slow inhale/exhale "breath" cycle. The wrapper transforms-only
          so it stays GPU-cheap; the existing per-layer flickers ride on top of it. */}
      <div
        className="absolute inset-0"
        style={{
          animation: hueAnim
            ? `${hueAnim}, flame-breathe ${(6 * speedMul).toFixed(2)}s ease-in-out infinite`
            : `flame-breathe ${(6 * speedMul).toFixed(2)}s ease-in-out infinite`,
          animationDelay: hueAnim ? `0s, -${breathOffset}s` : `-${breathOffset}s`,
          transformOrigin: "center bottom",
          willChange: "transform, filter",
        }}
      >
        {/* 4. Outer haze */}
        <svg
          className="flame-outer absolute left-1/2 bottom-[-2px]"
          width={size * 1.25}
          height={size * 1.3}
          viewBox="0 0 40 56"
          style={{
            transform: "translate(-50%, 0)",
            transformOrigin: "center bottom",
            animation: `flame-outer-flicker ${1.7 * speedMul}s ease-in-out infinite`,
            mixBlendMode: "screen",
            filter: `url(#${turbSlow}) blur(2.5px)`,
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

        {/* 5. Mid tongue — main warm body */}
        <svg
          className="flame-mid absolute left-1/2 bottom-0"
          width={size * 0.92}
          height={size * 1.08}
          viewBox="0 0 40 56"
          style={{
            transform: "translate(-50%, 0)",
            transformOrigin: "center bottom",
            animation: `flame-mid-flicker ${1.05 * speedMul}s ease-in-out infinite`,
            filter: `url(#${turbMid}) drop-shadow(0 0 7px ${palette.mid})`,
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

        {/* 6. Inner body */}
        <svg
          className="flame-inner absolute left-1/2 bottom-1"
          width={size * 0.62}
          height={size * 0.85}
          viewBox="0 0 40 56"
          style={{
            transform: "translate(-50%, 0)",
            transformOrigin: "center bottom",
            animation: `flame-inner-flicker ${0.8 * speedMul}s ease-in-out infinite`,
            filter: `url(#${turbFast}) drop-shadow(0 0 5px ${palette.inner})`,
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

        {/* 7. White-hot core */}
        <svg
          className="flame-core absolute left-1/2 bottom-2"
          width={size * 0.34}
          height={size * 0.6}
          viewBox="0 0 40 56"
          style={{
            transform: "translate(-50%, 0)",
            transformOrigin: "center bottom",
            animation: `flame-core-flicker ${0.6 * speedMul}s ease-in-out infinite`,
            filter: `url(#${turbFast}) drop-shadow(0 0 4px ${palette.core})`,
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

        {/* 7b. Heart bloom — pulsing white-hot bloom inside the core (Hot+).
            Sells the idea that the flame has a *living center*, not just paint. */}
        {isHot && (
          <span
            aria-hidden
            className="absolute left-1/2 pointer-events-none rounded-full"
            style={{
              width: size * 0.28,
              height: size * 0.36,
              bottom: size * 0.18,
              background: `radial-gradient(ellipse at 50% 60%, ${palette.core.replace(")", " / 0.95)")} 0%, ${palette.inner.replace(")", " / 0.55)")} 45%, transparent 78%)`,
              filter: `blur(${Math.max(2, size * 0.04)}px)`,
              transform: "translateX(-50%)",
              mixBlendMode: "screen",
              animation: `flame-heart-bloom ${(1.2 * speedMul).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `-${breathOffset}s`,
            }}
          />
        )}

        {/* 7c. Aurora rim — thin colored ring tracing the flame outline (Blazing+).
            Two stacked, counter-rotating hue shifts → flame edge feels iridescent. */}
        {isBlazing && (
          <>
            <svg
              aria-hidden
              className="absolute left-1/2 bottom-0 pointer-events-none"
              width={size * 0.84}
              height={size * 1.1}
              viewBox="0 0 40 56"
              style={{
                transform: "translateX(-50%)",
                transformOrigin: "center bottom",
                filter: `drop-shadow(0 0 ${size * 0.06}px ${palette.haze})`,
                mixBlendMode: "screen",
                opacity: 0.75,
                animation: `flame-aurora-hue ${(6 * speedMul).toFixed(2)}s linear infinite`,
              }}
            >
              <path
                d={FLAME_PATH}
                fill="none"
                stroke={palette.haze}
                strokeWidth={isInferno ? 0.8 : 0.55}
                strokeOpacity="0.8"
              />
            </svg>
            <svg
              aria-hidden
              className="absolute left-1/2 bottom-0 pointer-events-none"
              width={size * 0.78}
              height={size * 1.04}
              viewBox="0 0 40 56"
              style={{
                transform: "translateX(-50%)",
                transformOrigin: "center bottom",
                filter: `drop-shadow(0 0 ${size * 0.05}px ${palette.inner})`,
                mixBlendMode: "screen",
                opacity: 0.5,
                animation: `flame-aurora-hue ${(8 * speedMul).toFixed(2)}s linear infinite reverse`,
              }}
            >
              <path
                d={FLAME_PATH}
                fill="none"
                stroke={palette.inner}
                strokeWidth={0.45}
                strokeOpacity="0.7"
              />
            </svg>
          </>
        )}

        {/* 7d. Volumetric god-ray — single soft beam of light shooting up from
            the core (Diamond+). Sells the verticality and "burning upward" energy. */}
        {isDiamond && (
          <span
            aria-hidden
            className="absolute left-1/2 pointer-events-none"
            style={{
              width: size * 0.18,
              height: size * 1.6,
              bottom: size * 0.28,
              background: `linear-gradient(180deg, ${palette.core.replace(")", " / 0.55)")} 0%, ${palette.inner.replace(")", " / 0.28)")} 35%, transparent 80%)`,
              filter: `blur(${Math.max(3, size * 0.08)}px)`,
              transform: "translateX(-50%)",
              transformOrigin: "center bottom",
              mixBlendMode: "screen",
              animation: `flame-godray-pulse ${(2.4 * speedMul).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `-${breathOffset}s`,
              opacity: 0.7,
            }}
          />
        )}

        {/* 8. White-hot tip whip — tiny extra-fast whip on top of the core */}
        {isOnFire && (
          <svg
            className="absolute left-1/2"
            width={size * 0.2}
            height={size * 0.32}
            viewBox="0 0 40 56"
            style={{
              top: size * 0.18,
              transform: "translate(-50%, 0)",
              transformOrigin: "center bottom",
              animation: `flame-tip-whip ${0.45 * speedMul}s ease-in-out infinite`,
              filter: `url(#${turbFast}) drop-shadow(0 0 3px ${palette.core})`,
              mixBlendMode: "screen",
            }}
          >
            <ellipse cx="20" cy="40" rx="6" ry="14" fill={palette.core} fillOpacity="0.95" />
          </svg>
        )}

        {/* INFERNO ONLY — counter-rotating mirrored body that makes the flame visibly spiral */}
        {isInferno && size >= 64 && (
          <svg
            className="absolute left-1/2 bottom-0"
            width={size * 0.78}
            height={size * 1.0}
            viewBox="0 0 40 56"
            style={{
              transform: "translate(-50%, 0) scaleX(-1)",
              transformOrigin: "center bottom",
              animation: `flame-plasma-spiral ${1.4 * speedMul}s ease-in-out infinite`,
              filter: `url(#${turbMid}) drop-shadow(0 0 8px ${palette.outer})`,
              mixBlendMode: "screen",
              opacity: 0.7,
            }}
          >
            <defs>
              <linearGradient id={`spiralG-${uid}`} x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stopColor={palette.outer} stopOpacity="0.9" />
                <stop offset="50%"  stopColor={palette.mid}   stopOpacity="0.95" />
                <stop offset="100%" stopColor={palette.core}  stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={FLAME_PATH} fill={`url(#spiralG-${uid})`} />
          </svg>
        )}

        {/* INFERNO ONLY — internal lightning arc that crackles every ~7s */}
        {isInferno && size >= 64 && (
          <svg
            className="absolute left-1/2 bottom-0 pointer-events-none"
            width={size * 0.5}
            height={size * 0.95}
            viewBox="0 0 40 56"
            style={{
              transform: "translate(-50%, 0)",
              transformOrigin: "center bottom",
              mixBlendMode: "screen",
              filter: `drop-shadow(0 0 4px ${palette.core}) drop-shadow(0 0 8px ${palette.inner})`,
            }}
          >
            <path
              d="M20 4 L 17 18 L 22 22 L 16 36 L 23 40 L 18 52"
              stroke={palette.core}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: `flame-lightning-crack 7s ease-in-out infinite`,
              }}
            />
          </svg>
        )}
      </div>

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

      {/* Sparks — arcing trajectory (Blazing+) */}
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
            "--spark-xm": `${sp.xMid}px`,
            ["--spark-xe" as string]: `${sp.xEnd}px`,
            ["--spark-ym" as string]: `${sp.yMid}px`,
            ["--spark-ye" as string]: `${sp.yEnd}px`,
            animation: `flame-spark-arc ${sp.duration * speedMul}s ease-out infinite`,
            animationDelay: `${sp.delay}s`,
            mixBlendMode: "screen",
          }}
        />
      ))}

      {/* Smoke wisps — ribboning, with rotation drift (Blazing+) */}
      {smokes.map((s, i) => (
        <span
          key={`s-${i}`}
          className="flame-smoke absolute rounded-full"
          style={{
            width: 10,
            height: 10,
            left: `${s.leftPct}%`,
            top: -6,
            background: "radial-gradient(circle, hsl(0 0% 78% / 0.5), transparent 70%)",
            filter: "blur(4px)",
            opacity: 0,
            // @ts-expect-error custom prop
            "--smoke-x": `${s.xDrift}px`,
            ["--smoke-r" as string]: `${s.rotate}deg`,
            animation: `flame-smoke-ribbon ${s.duration}s ease-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Spark crown — fireflies above the tip (Diamond+) */}
      {crown.map((c, i) => (
        <span
          key={`cr-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: c.size,
            height: c.size,
            left: `${c.leftPct}%`,
            top: -size * 0.1,
            background: palette.core,
            boxShadow: `0 0 ${c.size * 3}px ${palette.inner}`,
            opacity: 0,
            animation: `flame-crown-firefly ${c.duration * speedMul}s ease-in-out infinite`,
            animationDelay: `${c.delay}s`,
            mixBlendMode: "screen",
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

      {/* Living ember field — drifts on global wind + local pointer wind (Diamond+).
          Replaces the static crown visually but coexists for layered density. */}
      {embers.map((em, i) => (
        <span
          key={`em-${i}`}
          className="flame-ember absolute rounded-full pointer-events-none"
          style={{
            width: em.dotSize,
            height: em.dotSize,
            left: `${em.leftPct}%`,
            bottom: size * 0.18,
            background: palette.core,
            boxShadow: `0 0 ${em.dotSize * 3}px ${palette.inner}, 0 0 ${em.dotSize * 6}px ${palette.mid.replace(")", " / 0.6)")}`,
            opacity: 0,
            ["--ember-rise" as string]: `${em.rise}px`,
            animation: `flame-ember-float ${em.duration.toFixed(2)}s ease-out infinite`,
            animationDelay: `${em.delay.toFixed(2)}s`,
            mixBlendMode: "screen",
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
  },
);

RealisticFlame.displayName = "RealisticFlame";


export default RealisticFlame;
