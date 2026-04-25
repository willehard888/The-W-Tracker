import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * StylizedStreakFlame v4 — layered "real bonfire" silhouettes.
 *
 * Design:
 *  - NO outer glow / aura halos. Pure flame silhouettes — the fire IS the visual.
 *  - 3–9 overlapping flame shapes, each a unique hand-drawn organic teardrop with
 *    side licks and curls — like the reference photo of layered tongues of fire.
 *  - Each flame: own height, own width, own lateral offset, own animation phase,
 *    own gradient (back flames cooler/redder, front flames hotter/yellow-white).
 *  - Color depth via vertical gradients per flame: deep red base → orange body
 *    → yellow shoulder → near-white tip. A subtle blue "neck" at the very base
 *    on stage 3+ (physically real).
 *  - Progressive: stage 1 = 1 small flame; stage 8 = 9 layered flames in a wider
 *    bed with the tallest reaching the top of the panel.
 *  - Roar via SVG turbulence + per-flame lerp on displacement scale & speed.
 *  - Per-instance random seed so adjacent panels never sync.
 *  - Reduced motion safe (handled by global rule on `[style*="stylized-"]`).
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

/**
 * Hand-drawn flame silhouettes — viewBox 100x140.
 * Each path is unique: different curl direction, side licks, tip sharpness.
 * They are designed to layer organically: A is widest/shortest (back row),
 * E is tallest/sharpest (foreground centre), and the rest fill between.
 */
const FLAME_PATHS = [
  // A — wide, low, broad shoulders, double-tip — back-row body
  "M50 10 C 56 28, 70 36, 76 52 C 84 70, 82 92, 72 108 C 64 122, 56 132, 50 138 C 44 132, 36 122, 28 108 C 18 92, 16 70, 24 52 C 30 36, 44 28, 50 10 Z",
  // B — taller, leaning slightly left, with a side lick
  "M50 4 C 54 22, 66 32, 70 50 C 76 70, 72 92, 60 108 C 52 120, 50 130, 50 138 C 50 130, 40 120, 32 108 C 22 92, 24 70, 30 50 C 36 32, 48 22, 50 4 Z",
  // C — slim & tall, sharp tip — central tongue
  "M50 0 C 52 18, 60 30, 62 50 C 64 72, 58 94, 54 110 C 52 122, 50 132, 50 138 C 50 132, 48 122, 46 110 C 42 94, 36 72, 38 50 C 40 30, 48 18, 50 0 Z",
  // D — leans right, double-curl tip
  "M50 6 C 56 22, 64 30, 68 48 C 74 68, 70 90, 60 106 C 54 118, 52 130, 50 138 C 48 130, 44 118, 38 106 C 30 90, 28 68, 34 48 C 38 30, 46 22, 50 6 Z",
  // E — tallest, narrowest, fox-tail tip — foreground hero flame
  "M50 -2 C 51 16, 58 28, 60 48 C 62 70, 58 94, 53 112 C 51 124, 50 132, 50 138 C 50 132, 49 124, 47 112 C 42 94, 38 70, 40 48 C 42 28, 49 16, 50 -2 Z",
  // F — short, fat candle-base flame for filling the back-left
  "M50 22 C 56 36, 70 44, 74 58 C 80 74, 78 92, 70 106 C 62 118, 56 130, 50 138 C 44 130, 38 118, 30 106 C 22 92, 20 74, 26 58 C 30 44, 44 36, 50 22 Z",
  // G — tall narrow with big right curl
  "M50 4 C 58 20, 68 28, 70 48 C 72 68, 64 90, 56 106 C 52 118, 50 130, 50 138 C 50 130, 46 118, 42 106 C 34 90, 32 68, 36 48 C 40 28, 46 20, 50 4 Z",
  // H — back-row right, leans right, double-shoulder
  "M50 16 C 58 30, 70 38, 74 54 C 80 72, 76 92, 66 108 C 58 120, 54 130, 50 138 C 46 130, 40 120, 32 108 C 22 92, 22 72, 28 54 C 32 38, 44 30, 50 16 Z",
  // I — slim flicker, far back-left
  "M50 18 C 54 32, 62 40, 64 56 C 66 72, 60 92, 56 108 C 52 120, 50 130, 50 138 C 50 130, 48 120, 44 108 C 40 92, 34 72, 36 56 C 38 40, 46 32, 50 18 Z",
];

interface FlameLayer {
  pathIndex: number;
  scale: number;        // overall scale (0.55 .. 1.0)
  xOffset: number;      // -1 .. 1, fraction of bed width
  zIndex: number;
  speed: number;        // animation speed multiplier
  delaySeed: number;    // per-flame phase
  hueShift: number;     // -8 .. +8 degrees (subtle variation)
  intensity: number;    // 0..1, how "hot" — affects gradient stops
  filterId: 0 | 1 | 2;  // which turbulence filter to use
}

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
    };
  }, [uid]);

  // Stage-up burst (kept minimal — short brightness pop on the bed, no halo)
  const [burst, setBurst] = useState(false);
  const prevStageRef = useRef(stage);
  useEffect(() => {
    if (stage > prevStageRef.current) {
      setBurst(true);
      const id = setTimeout(() => setBurst(false), 700);
      prevStageRef.current = stage;
      return () => clearTimeout(id);
    }
    prevStageRef.current = stage;
  }, [stage]);

  // ── Reactivity: lean & flicker in response to pointer / touch movement.
  // We track the global pointer and translate its movement into:
  //   --ssf-wind-x : -1..1 horizontal lean intensity (smoothed)
  //   --ssf-gust   : 0..1  short-lived "gust" amplitude that triggers on
  //                  fast pointer moves, fades back to 0 (~600ms).
  // Animations in CSS read these vars to tilt and energise the flame.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isCold) return;
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    let targetWind = 0;
    let currentWind = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();
    let gust = 0;
    let gustDecay = 0;

    const onPointer = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.65;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // Distance falloff: full influence within 1.5× size, none beyond 4× size
      const dist = Math.hypot(dx, dy);
      const influence = Math.max(0, Math.min(1, 1 - (dist - size * 1.5) / (size * 2.5)));
      // Lean opposite to pointer (fire bends AWAY from incoming wind)
      targetWind = Math.max(-1, Math.min(1, -dx / (size * 1.2))) * influence;
      // Gust = pointer speed
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt; // px/ms
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      const gustHit = Math.min(1, speed / 1.8) * influence;
      if (gustHit > gust) {
        gust = gustHit;
        gustDecay = 0.018; // decay rate per frame
      }
    };

    const tick = () => {
      // Smooth lerp towards target (snappy but not jittery)
      currentWind += (targetWind - currentWind) * 0.12;
      // Decay gust
      gust = Math.max(0, gust - gustDecay);
      el.style.setProperty("--ssf-wind-x", currentWind.toFixed(3));
      el.style.setProperty("--ssf-gust", gust.toFixed(3));
      // Slowly bleed the wind target back to neutral if pointer is idle
      targetWind *= 0.985;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(raf);
    };
  }, [isCold, size]);

  // How many flames at this stage — fuller fire: 2..14 layered tongues
  const flameCount = isCold ? 0 : Math.min(14, 2 + stage * 2);

  // Bed width (how wide the flames spread) and tallest flame height — wider, taller, smoother
  const bedWidth = lerp(0.55, 1.25, t) * size;
  const tallestH = lerp(0.75, 1.3, t) * size;

  // Build layer plan deterministically per (uid, stage, t)
  const layers: FlameLayer[] = useMemo(() => {
    if (flameCount === 0) return [];
    // 14 curated layers — back→front for organic depth, fuller bonfire feel.
    const plan: Omit<FlameLayer, "delaySeed">[] = [
      // ── BACK ROW (4) — cooler, shorter, soft warp ──
      { pathIndex: 0, scale: 0.78, xOffset: -0.7,  zIndex: 1, speed: 1.05, hueShift: -5, intensity: 0.42, filterId: 0 },
      { pathIndex: 5, scale: 0.74, xOffset:  0.7,  zIndex: 1, speed: 1.1,  hueShift: -3, intensity: 0.46, filterId: 0 },
      { pathIndex: 8, scale: 0.7,  xOffset: -0.18, zIndex: 1, speed: 1.15, hueShift: -4, intensity: 0.5,  filterId: 0 },
      { pathIndex: 0, scale: 0.66, xOffset:  0.22, zIndex: 1, speed: 1.0,  hueShift: -2, intensity: 0.5,  filterId: 0 },
      // ── MID ROW (5) — fills the body of the fire ──
      { pathIndex: 1, scale: 0.86, xOffset: -0.45, zIndex: 2, speed: 0.92, hueShift: -1, intensity: 0.68, filterId: 1 },
      { pathIndex: 7, scale: 0.84, xOffset:  0.46, zIndex: 2, speed: 0.95, hueShift:  1, intensity: 0.7,  filterId: 1 },
      { pathIndex: 3, scale: 0.82, xOffset: -0.15, zIndex: 2, speed: 0.88, hueShift:  2, intensity: 0.76, filterId: 1 },
      { pathIndex: 1, scale: 0.8,  xOffset:  0.18, zIndex: 2, speed: 0.9,  hueShift:  0, intensity: 0.74, filterId: 1 },
      { pathIndex: 6, scale: 0.78, xOffset:  0.0,  zIndex: 2, speed: 0.86, hueShift:  3, intensity: 0.8,  filterId: 1 },
      // ── FRONT ROW (4) — hottest, sharpest tongues ──
      { pathIndex: 2, scale: 0.96, xOffset: -0.28, zIndex: 3, speed: 0.72, hueShift:  3, intensity: 0.88, filterId: 2 },
      { pathIndex: 6, scale: 0.94, xOffset:  0.3,  zIndex: 3, speed: 0.76, hueShift:  4, intensity: 0.9,  filterId: 2 },
      { pathIndex: 3, scale: 0.92, xOffset: -0.08, zIndex: 3, speed: 0.7,  hueShift:  5, intensity: 0.92, filterId: 2 },
      { pathIndex: 7, scale: 0.9,  xOffset:  0.12, zIndex: 3, speed: 0.74, hueShift:  4, intensity: 0.92, filterId: 2 },
      // ── HERO — tallest, dead centre, sharpest tip ──
      { pathIndex: 4, scale: 1.05, xOffset:  0.0,  zIndex: 4, speed: 0.62, hueShift:  6, intensity: 1.0,  filterId: 2 },
    ];

    // Take the right number, but always include the hero (last) when count >= 4
    let chosen: typeof plan;
    if (flameCount <= 3) {
      // Tiny fires: pick from front row + hero
      chosen = [...plan.slice(9, 9 + (flameCount - 1)), plan[plan.length - 1]].slice(0, flameCount);
    } else {
      const heroLayer = plan[plan.length - 1];
      const others = plan.slice(0, plan.length - 1);
      // priority: mid → front → back so the body fills out first
      const ordered = [
        ...others.slice(4, 9),            // mid row (5)
        ...others.slice(9, 13),           // front row (4)
        ...others.slice(0, 4),            // back row (4) last
      ];
      chosen = [...ordered.slice(0, flameCount - 1), heroLayer];
    }

    // Sort by zIndex so back renders first
    chosen.sort((a, b) => a.zIndex - b.zIndex);

    return chosen.map((c, i) => ({
      ...c,
      delaySeed: -((seed.a * (i + 1) + seed.b * (i + 3) + seed.c * (i + 5)) % 2300) / 1000,
    }));
  }, [flameCount, seed.a, seed.b, seed.c]);

  // Cold state — thin outline candle
  if (isCold) {
    return (
      <div
        className={cn("relative pointer-events-none flex items-end justify-center", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg width={size * 0.3} height={size * 0.5} viewBox="0 0 100 140" fill="none" className="opacity-30">
          <path d={FLAME_PATHS[2]} stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className="text-muted-foreground" />
        </svg>
      </div>
    );
  }

  // Three turbulence filters — slow (back), medium (mid), fast (front)
  // Each combined with an internal Gaussian-blur bloom to give the flame a
  // self-emissive 3D feel WITHOUT a fake outer halo. The bloom is composited
  // back over the source so the flame edge stays crisp while the body glows.
  const filterIds = [`ssf-t0-${uid}`, `ssf-t1-${uid}`, `ssf-t2-${uid}`];

  // ── Streak-based FEROCITY (0..1) — extra non-linear curve on top of `t`
  // Stage 1 = calm, Stage 8 = berserk inferno. This drives turbulence,
  // particle counts, smoke density, ember speed/size and trail length.
  const ferocity = Math.min(1, Math.pow(stage / MAX_STAGE_INDEX, 0.85) * lerp(0.85, 1.15, t));
  const ferocityFront = Math.min(1, ferocity * 1.15); // front layer reacts hardest

  const turbConfigs = [
    // back row — soft warp, deeper bloom (slow & smooth)
    {
      freq: "0.020 0.048",
      peakFreq: "0.040 0.082",
      baseScale: lerp(2.0, 3.6, ferocity),
      peakScale: lerp(3.4, 6.2, ferocity),
      dur: lerp(2.6, 1.6, ferocity),
      bloomStdDev: lerp(4.4, 6.0, ferocity),
    },
    // mid row — flowing roar
    {
      freq: "0.030 0.066",
      peakFreq: "0.060 0.12",
      baseScale: lerp(2.6, 4.6, ferocity),
      peakScale: lerp(4.4, 7.2, ferocity),
      dur: lerp(1.8, 1.1, ferocity),
      bloomStdDev: lerp(2.6, 3.8, ferocity),
    },
    // front row — sharper, but smoother whip
    {
      freq: "0.046 0.10",
      peakFreq: "0.090 0.18",
      baseScale: lerp(3.2, 5.6, ferocityFront),
      peakScale: lerp(5.4, 9.0, ferocityFront),
      dur: lerp(1.25, 0.75, ferocityFront),
      bloomStdDev: lerp(1.4, 2.2, ferocity),
    },
  ];
  const intensityBoost = lerp(0.95, 1.65, ferocity);

  // Floor light pool — wash beneath the flames simulating ground reflection
  const floorPoolColor = stage >= 6 ? "hsl(22 100% 55%)" : stage >= 4 ? "hsl(18 100% 50%)" : "hsl(14 95% 45%)";

  return (
    <div
      ref={containerRef}
      className={cn("relative pointer-events-none flex items-end justify-center", className)}
      style={{
        width: size,
        height: size,
        animation: `stylized-flame-bob ${(2.6).toFixed(2)}s ease-in-out infinite`,
        // Reactive lean: derived from pointer-tracked --ssf-wind-x (-1..1) and gust (0..1).
        ["--ssf-wind" as string]: `calc(var(--ssf-wind-x, 0) * 12deg + var(--ssf-gust, 0) * 6deg)`,
        // Gust energises the fire — brighter & more saturated when reacting
        filter: `brightness(calc(1 + var(--ssf-gust, 0) * 0.25)) saturate(calc(1 + var(--ssf-gust, 0) * 0.3))`,
        transition: "filter 0.25s ease-out",
      }}
      aria-hidden
    >
      {/* SVG defs — turbulence + internal bloom filters + per-layer gradients */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          {turbConfigs.map((cfg, i) => (
            <filter
              key={i}
              id={filterIds[i]}
              x="-40%" y="-30%" width="180%" height="160%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={cfg.freq}
                numOctaves="2"
                seed={seed.a + i * 7}
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  dur={`${cfg.dur.toFixed(2)}s`}
                  values={`${cfg.freq};${cfg.peakFreq};${cfg.freq}`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="seed"
                  dur={`${(cfg.dur * 2.1).toFixed(2)}s`}
                  values={`${seed.a + i * 7};${seed.b + i * 11};${seed.c + i * 13};${seed.a + i * 7}`}
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" result="warped">
                <animate
                  attributeName="scale"
                  dur={`${(cfg.dur * 0.9).toFixed(2)}s`}
                  values={`${(cfg.baseScale * intensityBoost).toFixed(2)};${(cfg.peakScale * intensityBoost).toFixed(2)};${(cfg.baseScale * intensityBoost * 0.85).toFixed(2)};${(cfg.baseScale * intensityBoost).toFixed(2)}`}
                  repeatCount="indefinite"
                />
              </feDisplacementMap>
              {/* Internal bloom — blur warped flame and merge it back over itself */}
              <feGaussianBlur in="warped" stdDeviation={cfg.bloomStdDev} result="bloomLarge" />
              <feGaussianBlur in="warped" stdDeviation={cfg.bloomStdDev * 0.4} result="bloomTight" />
              <feMerge>
                <feMergeNode in="bloomLarge" />
                <feMergeNode in="bloomLarge" />
                <feMergeNode in="bloomTight" />
                <feMergeNode in="warped" />
              </feMerge>
            </filter>
          ))}

          {/* Per-layer vertical gradients — DEEP ORANGE palette
              (charred ember → blood-red → deep tangerine → burnt orange → glowing amber → cream apex)
              Yellows pushed back, oranges/reds dominate the body. */}
          {layers.map((layer, i) => {
            const gradId = `ssf-grad-${uid}-${i}`;
            const hShift = layer.hueShift;
            const inten = layer.intensity;
            const showBlue = stage >= 4 && layer.zIndex >= 2 && inten > 0.65;
            const bottomBlue = showBlue
              ? `hsl(${210 + hShift} 95% ${lerp(58, 70, inten)}%)`
              : `hsl(${4 + hShift} 90% ${lerp(18, 28, inten)}%)`;
            const charred   = `hsl(${2 + hShift}  88% ${lerp(20, 30, inten)}%)`; // charred ember
            const ember     = `hsl(${6 + hShift}  95% ${lerp(30, 40, inten)}%)`; // blood ember red
            const deepBase  = `hsl(${12 + hShift} 100% ${lerp(38, 48, inten)}%)`;// dark crimson-orange
            const body      = `hsl(${18 + hShift} 100% ${lerp(46, 56, inten)}%)`;// deep blood-orange
            const shoulder  = `hsl(${24 + hShift} 100% ${lerp(52, 62, inten)}%)`;// burnt orange
            const upperBody = `hsl(${30 + hShift} 100% ${lerp(58, 68, inten)}%)`;// rich tangerine
            const tipColor  = inten > 0.85
              ? `hsl(${38 + hShift} 100% ${lerp(70, 82, inten)}%)`              // glowing amber (no straw yellow)
              : `hsl(${34 + hShift} 100% ${lerp(64, 74, inten)}%)`;
            const apex      = inten > 0.94 ? `hsl(44 100% 90%)` : tipColor;     // pulled-back cream apex

            return (
              <linearGradient key={gradId} id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%"   stopColor={bottomBlue} stopOpacity={showBlue ? 0.85 : 0.92} />
                <stop offset="5%"   stopColor={charred}    stopOpacity="1" />
                <stop offset="14%"  stopColor={ember}      stopOpacity="1" />
                <stop offset="28%"  stopColor={deepBase}   stopOpacity="1" />
                <stop offset="46%"  stopColor={body}       stopOpacity="1" />
                <stop offset="62%"  stopColor={shoulder}   stopOpacity="0.99" />
                <stop offset="78%"  stopColor={upperBody}  stopOpacity="0.95" />
                <stop offset="92%"  stopColor={tipColor}   stopOpacity="0.7" />
                <stop offset="100%" stopColor={apex}       stopOpacity="0" />
              </linearGradient>
            );
          })}

          {/* Inner core — deep amber heart, smaller white pinprick */}
          {layers.filter((l) => l.zIndex >= 3).map((_, idx) => {
            const id = `ssf-core-${uid}-${idx}`;
            return (
              <radialGradient key={id} id={id} cx="50%" cy="60%" r="44%">
                <stop offset="0%"   stopColor="hsl(46 100% 92%)" stopOpacity="1" />
                <stop offset="14%"  stopColor="hsl(38 100% 78%)" stopOpacity="0.95" />
                <stop offset="38%"  stopColor="hsl(28 100% 62%)" stopOpacity="0.7" />
                <stop offset="68%"  stopColor="hsl(18 100% 52%)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="hsl(10 95% 42%)"  stopOpacity="0" />
              </radialGradient>
            );
          })}
        </defs>
      </svg>

      {/* ─── FLOOR LIGHT POOL — ground lit by the fire (3D depth cue) ─── */}
      <span
        className="absolute left-1/2"
        style={{
          width: bedWidth * 2.2,
          height: size * 0.18,
          bottom: -size * 0.04,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 0%, ${floorPoolColor.replace(")", " / 0.55)")} 0%, ${floorPoolColor.replace(")", " / 0.18)")} 38%, transparent 75%)`,
          filter: `blur(${Math.max(6, size * 0.07)}px)`,
          mixBlendMode: "screen",
          animation: `stylized-floor-pool 2.2s ease-in-out infinite`,
          zIndex: 0,
          opacity: lerp(0.55, 1, t),
        }}
      />

      {/* ─── ATMOSPHERIC HAZE between back & front flame rows ─── */}
      {stage >= 3 && (
        <span
          className="absolute left-1/2"
          style={{
            width: bedWidth * 1.6,
            height: tallestH * 0.85,
            bottom: size * 0.06,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 78%, hsl(22 100% 50% / 0.32) 0%, hsl(14 95% 42% / 0.18) 40%, hsl(6 85% 32% / 0.08) 70%, transparent 88%)`,
            filter: `blur(${Math.max(8, size * 0.09)}px)`,
            mixBlendMode: "screen",
            animation: `stylized-haze-drift 4s ease-in-out infinite`,
            zIndex: 2,
            opacity: lerp(0.4, 0.9, t),
          }}
        />
      )}

      {/* ─── EMBER BED — burning fuel line ─── */}
      <span
        className="absolute left-1/2"
        style={{
          width: bedWidth * 1.05,
          height: Math.max(4, size * 0.04),
          bottom: size * 0.02,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at 50% 50%, hsl(40 100% 80% / 1) 0%, hsl(28 100% 62% / 0.95) 22%, hsl(18 100% 52% / 0.85) 48%, hsl(10 95% 42% / 0.6) 72%, hsl(4 88% 28% / 0.3) 90%, transparent 100%)`,
          filter: "blur(2.5px)",
          borderRadius: "50%",
          mixBlendMode: "screen",
          animation: `stylized-bed-pulse 1.4s ease-in-out infinite`,
          zIndex: 1,
        }}
      />
      {/* Glowing coal pinpoints */}
      {!isCold && Array.from({ length: Math.min(6, flameCount + 1) }).map((_, i) => {
        const span = bedWidth * 0.85;
        const left = -span / 2 + (span / Math.max(1, flameCount + 1)) * (i + 0.5);
        const dot = lerp(2, 3.5, t);
        return (
          <span
            key={`coal-${i}`}
            className="absolute left-1/2 rounded-full"
            style={{
              width: dot,
              height: dot,
              bottom: size * 0.025,
              transform: `translateX(calc(-50% + ${left.toFixed(1)}px))`,
              background: i % 3 === 0 ? "hsl(54 100% 90%)" : "hsl(38 100% 68%)",
              boxShadow: `0 0 ${dot * 2}px hsl(28 100% 58%)`,
              animation: `stylized-coal-pulse ${(1.6 + i * 0.27).toFixed(2)}s ease-in-out infinite`,
              animationDelay: `${(i * 0.3).toFixed(2)}s`,
              zIndex: 1,
            }}
          />
        );
      })}

      {/* ─── FLAME WRAPPER (wind sway + 3D perspective) ─── */}
      <div
        className="absolute left-1/2"
        style={{
          left: "50%",
          bottom: size * 0.05,
          // Reactive lean + gust scale handled inside @keyframes stylized-flame-sway
          // (it reads --ssf-wind-x / --ssf-wind / --ssf-gust set by the pointer effect)
          transform: "translateX(-50%)",
          width: bedWidth,
          height: tallestH,
          transformOrigin: "center bottom",
          animation: `stylized-flame-sway 3.4s ease-in-out infinite`,
          perspective: `${size * 4}px`,
          transformStyle: "preserve-3d",
          willChange: "transform",
          transition: "transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      >
        {(() => {
          let frontIdx = 0;
          return layers.map((layer, i) => {
            const flameH = tallestH * layer.scale;
            const flameW = flameH * (100 / 140) * lerp(0.95, 1.05, (i % 3) / 2);
            const xPx = (bedWidth * 0.5 - flameW * 0.5) * layer.xOffset;
            const gradId = `ssf-grad-${uid}-${i}`;
            const filterId = filterIds[layer.filterId];
            const speedDur = layer.speed * lerp(1.4, 0.85, t);
            const swayDur = layer.speed * lerp(2.6, 1.5, t);

            // 3D z-depth: back row receded, front pushed forward
            const zDepth = layer.zIndex === 1 ? -size * 0.18 : layer.zIndex === 2 ? -size * 0.05 : size * 0.04;
            // Atmospheric dimming for back layers
            const layerOpacity = layer.zIndex === 1 ? 0.78 : layer.zIndex === 2 ? 0.92 : 1;

            const isFront = layer.zIndex >= 3;
            const coreId = isFront ? `ssf-core-${uid}-${frontIdx++}` : null;

            return (
              <div
                key={`flame-${i}`}
                className="absolute"
                style={{
                  left: `calc(50% + ${xPx.toFixed(1)}px)`,
                  bottom: 0,
                  width: flameW,
                  height: flameH,
                  transform: `translateX(-50%) translateZ(${zDepth.toFixed(1)}px)`,
                  transformOrigin: "center bottom",
                  zIndex: layer.zIndex,
                  animation: `stylized-flame-sway-${(i % 3) + 1} ${swayDur.toFixed(2)}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
                  animationDelay: `${layer.delaySeed.toFixed(2)}s`,
                  willChange: "transform",
                  mixBlendMode: "screen",
                  opacity: layerOpacity,
                }}
              >
                {/* Main body — turbulence + internal bloom = self-emissive depth */}
                <svg
                  width={flameW}
                  height={flameH}
                  viewBox="0 0 100 140"
                  preserveAspectRatio="none"
                  style={{
                    filter: `url(#${filterId})`,
                    animation: `stylized-flame-flicker-${(i % 3) + 1} ${speedDur.toFixed(2)}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                    animationDelay: `${(layer.delaySeed - 0.3).toFixed(2)}s`,
                    transformOrigin: "center bottom",
                    willChange: "transform, opacity",
                  }}
                >
                  <path d={FLAME_PATHS[layer.pathIndex]} fill={`url(#${gradId})`} />
                </svg>

                {/* Front-row inner WHITE-HOT CORE — biggest 3D depth cue */}
                {isFront && coreId && (
                  <svg
                    width={flameW * 0.55}
                    height={flameH * 0.72}
                    viewBox="0 0 100 140"
                    preserveAspectRatio="none"
                    className="absolute left-1/2"
                    style={{
                      bottom: flameH * 0.08,
                      transform: "translateX(-50%)",
                      filter: `url(#${filterId})`,
                      animation: `stylized-flame-flicker-${((i + 1) % 3) + 1} ${(speedDur * 0.8).toFixed(2)}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                      animationDelay: `${(layer.delaySeed - 0.5).toFixed(2)}s`,
                      transformOrigin: "center bottom",
                      mixBlendMode: "screen",
                      opacity: lerp(0.55, 0.95, t),
                    }}
                  >
                    <path d={FLAME_PATHS[layer.pathIndex]} fill={`url(#${coreId})`} />
                  </svg>
                )}
              </div>
            );
          });
        })()}

        {/* ─── SIDE FLAME LASHES — periodic lateral bursts shooting LEFT and RIGHT ───
            These give the bonfire that "wind-licked" feel where flames briefly
            whip out sideways instead of always reaching up. Always present (even
            on stage 1), with cadence and reach scaling with ferocity. */}
        {(() => {
          // 2 per side at low ferocity, up to 4 per side at high ferocity
          const perSide = Math.max(2, Math.round(lerp(2, 4, ferocity)));
          const sides: Array<"l" | "r"> = ["l", "r"];
          return sides.flatMap((side) =>
            Array.from({ length: perSide }).map((_, i) => {
              const sideKey = `${side}${i}`;
              const sw = bedWidth * lerp(0.09, 0.16, (i % 3) / 2);
              const sh = tallestH * lerp(0.55, 0.85, ferocity) * lerp(0.85, 1.05, (i % 3) / 2);
              // Vertical anchor — start from low/mid of fire (where wind catches)
              const vBottom = size * lerp(0.06, 0.18, (i * 0.4 + (side === "l" ? 0 : 0.2)) % 1);
              // Horizontal anchor — close to flame body edge
              const hOffset = bedWidth * 0.3 * (side === "l" ? -1 : 1);
              // Cadence: stagger so left & right alternate
              const dur = lerp(2.6, 1.7, ferocity) + (i * 0.23);
              const phaseOffset = side === "l" ? 0 : dur * 0.5;
              const delay = -(((i * 0.71 + seed.a * 0.013) % dur) + phaseOffset) % dur;
              const filterId = filterIds[1]; // mid filter — softer than front
              const gradId = `ssf-grad-${uid}-${(i + 3) % Math.max(1, layers.length)}`;
              const pathIdx = (i * 5 + 1) % FLAME_PATHS.length;
              return (
                <svg
                  key={`side-${sideKey}`}
                  width={sw}
                  height={sh}
                  viewBox="0 0 100 140"
                  preserveAspectRatio="none"
                  className="absolute"
                  style={{
                    left: `calc(50% + ${hOffset.toFixed(1)}px)`,
                    bottom: vBottom,
                    transformOrigin: side === "l" ? "right bottom" : "left bottom",
                    filter: `url(#${filterId}) saturate(1.08)`,
                    animation: `stylized-flame-side-${side} ${dur.toFixed(2)}s cubic-bezier(0.22, 0.61, 0.36, 1) infinite`,
                    animationDelay: `${delay.toFixed(2)}s`,
                    mixBlendMode: "screen",
                    zIndex: 3,
                    opacity: lerp(0.7, 1, ferocity),
                    willChange: "transform, opacity",
                  }}
                >
                  <path d={FLAME_PATHS[pathIdx]} fill={`url(#${gradId})`} />
                </svg>
              );
            })
          );
        })()}

        {/* ─── WILD TONGUES — rogue licks shooting up randomly (front emits) ─── */}
        {stage >= 2 && Array.from({ length: Math.min(8, Math.round(lerp(2, 8, ferocityFront))) }).map((_, i) => {
          const tongueW = bedWidth * lerp(0.07, 0.16, (i % 3) / 2);
          const tongueH = tallestH * lerp(0.45, 1.0, ferocityFront) * lerp(0.7, 1.1, (i % 4) / 3);
          const xPos = ((i * 37 + seed.a * 13) % 100) / 100;
          const xPx = (bedWidth * 0.85) * (xPos - 0.5);
          const dur = lerp(1.6, 0.8, ferocity) + (i % 3) * 0.12;
          const delay = -((i * 0.37 + seed.b * 0.013) % dur);
          const filterId = filterIds[2];
          const gradId = `ssf-grad-${uid}-${(i + 1) % Math.max(1, layers.length)}`;
          return (
            <svg
              key={`tongue-${i}`}
              width={tongueW}
              height={tongueH}
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
              className="absolute left-1/2"
              style={{
                bottom: 0,
                transform: `translateX(calc(-50% + ${xPx.toFixed(1)}px))`,
                filter: `url(#${filterId})`,
                animation: `stylized-flame-tongue ${dur.toFixed(2)}s ease-out infinite`,
                animationDelay: `${delay.toFixed(2)}s`,
                mixBlendMode: "screen",
                zIndex: 4,
                willChange: "transform, opacity",
              }}
            >
              <path d={FLAME_PATHS[4]} fill={`url(#${gradId})`} />
            </svg>
          );
        })}

        {/* ─── MICRO FLAMES — small, fast-dancing tongues that fill gaps & add depth ───
            These ride between the main flame layers (back of front-row, front of mid-row)
            adding the small "tongue clusters" you see in real bonfires around bigger flames. */}
        {Array.from({ length: Math.min(10, Math.round(lerp(3, 10, ferocity))) }).map((_, i) => {
          // Two clusters: low/wide and mid-height tighter
          const isLow = i % 2 === 0;
          const microW = bedWidth * lerp(0.05, 0.11, (i % 4) / 3);
          const microH = tallestH * (isLow ? lerp(0.22, 0.42, (i % 3) / 2) : lerp(0.35, 0.6, (i % 3) / 2));
          // Spread them across the bed, denser toward the centre
          const t01 = ((i * 29 + seed.b * 7) % 100) / 100;
          // Bias toward centre with a parabolic curve
          const centred = (t01 - 0.5) * (0.6 + Math.abs(t01 - 0.5) * 0.8);
          const xPx = bedWidth * 0.95 * centred;
          const bottom = size * (isLow ? 0.04 : lerp(0.06, 0.12, (i % 3) / 2));
          const dur = lerp(1.4, 0.85, ferocity) + (i % 4) * 0.13;
          const delay = -((i * 0.19 + seed.c * 0.009) % dur);
          // Slight per-instance hue rotation so micro-flames don't look identical
          const hueRot = ((i * 17) % 8) - 3;
          const filterId = filterIds[isLow ? 1 : 2];
          // Reuse a varied path for organic shape variation
          const pathIdx = (i * 3 + 2) % FLAME_PATHS.length;
          const gradId = `ssf-grad-${uid}-${(i + 2) % Math.max(1, layers.length)}`;
          // Z between mid (2) and front (3) so they nestle BETWEEN main layers
          const zIdx = isLow ? 2 : 3;
          return (
            <svg
              key={`micro-${i}`}
              width={microW}
              height={microH}
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
              className="absolute left-1/2"
              style={{
                bottom,
                transform: `translateX(calc(-50% + ${xPx.toFixed(1)}px))`,
                filter: `url(#${filterId}) hue-rotate(${hueRot}deg) saturate(1.05)`,
                animation: `stylized-flame-flicker-${(i % 3) + 1} ${dur.toFixed(2)}s cubic-bezier(0.4, 0, 0.6, 1) infinite, stylized-flame-sway-${(i % 3) + 1} ${(dur * 1.6).toFixed(2)}s ease-in-out infinite`,
                animationDelay: `${delay.toFixed(2)}s, ${(delay * 0.7).toFixed(2)}s`,
                mixBlendMode: "screen",
                opacity: lerp(0.65, 0.95, ferocity) * (isLow ? 0.85 : 1),
                zIndex: zIdx,
                transformOrigin: "center bottom",
                willChange: "transform, opacity",
              }}
            >
              <path d={FLAME_PATHS[pathIdx]} fill={`url(#${gradId})`} />
            </svg>
          );
        })}

        {/* ─── FRONT-ROW SHARP EMBERS with TRAILS — bright, fast, lingering ─── */}
        {stage >= 3 && Array.from({ length: Math.min(14, Math.round(lerp(4, 14, ferocityFront))) }).map((_, i) => {
          const xPos = ((i * 53 + seed.c * 11) % 100) / 100;
          const xPx = (bedWidth * 0.9) * (xPos - 0.5);
          const drift = ((i % 2 === 0 ? 1 : -1) * (4 + (i * 3) % 14)) * lerp(0.7, 1.4, ferocity);
          const dur = lerp(2.2, 1.3, ferocity) + ((i * 0.21) % 1.0);
          const delay = -((i * 0.27 + seed.a * 0.011) % dur);
          const sparkSize = lerp(1.6, 3.0, (i % 3) / 2) * lerp(0.85, 1.25, ferocity);
          const color = i % 4 === 0 ? "hsl(54 100% 94%)" : i % 3 === 0 ? "hsl(42 100% 74%)" : "hsl(28 100% 62%)";
          const riseDist = lerp(110, 170, ferocity); // %
          // Trail = stacked box-shadows behind the spark (tail effect)
          const trailLen = Math.max(2, Math.round(lerp(2, 6, ferocity)));
          const trail = Array.from({ length: trailLen })
            .map((_, k) => {
              const off = (k + 1) * (sparkSize * 0.9);
              const a = (1 - (k + 1) / (trailLen + 1)) * 0.7;
              return `0 ${off.toFixed(1)}px ${(sparkSize * 1.6).toFixed(1)}px hsl(28 100% 60% / ${a.toFixed(2)})`;
            })
            .join(", ");
          return (
            <span
              key={`spark-${i}`}
              className="absolute rounded-full"
              style={{
                width: sparkSize,
                height: sparkSize,
                left: `calc(50% + ${xPx.toFixed(1)}px)`,
                bottom: size * 0.04,
                background: color,
                boxShadow: `0 0 ${sparkSize * 2.8}px ${color}, ${trail}`,
                ["--spark-x" as string]: "0px",
                ["--spark-drift" as string]: `${drift}px`,
                ["--spark-rise" as string]: `-${riseDist}%`,
                animation: `stylized-spark-rise ${dur.toFixed(2)}s ease-out infinite`,
                animationDelay: `${delay.toFixed(2)}s`,
                mixBlendMode: "screen",
                zIndex: 5,
                willChange: "transform, opacity",
              }}
            />
          );
        })}

        {/* ─── BACK-ROW SOFT SMOKY WISPS — slow, large, fading puffs ─── */}
        {stage >= 2 && Array.from({ length: Math.min(8, Math.round(lerp(2, 8, ferocity))) }).map((_, i) => {
          const xPos = ((i * 41 + seed.b * 17) % 100) / 100;
          const xPx = (bedWidth * 1.0) * (xPos - 0.5);
          const drift = ((i % 2 === 0 ? -1 : 1) * (8 + (i * 5) % 18));
          const dur = lerp(4.5, 3.0, ferocity) + (i % 3) * 0.4;
          const delay = -((i * 0.61 + seed.c * 0.017) % dur);
          const wispSize = lerp(8, 18, (i % 3) / 2) * lerp(0.9, 1.4, ferocity);
          const tint = i % 3 === 0 ? "hsl(20 30% 60% / 0.35)" : "hsl(28 18% 50% / 0.28)";
          return (
            <span
              key={`wisp-${i}`}
              className="absolute rounded-full"
              style={{
                width: wispSize,
                height: wispSize,
                left: `calc(50% + ${xPx.toFixed(1)}px)`,
                bottom: size * 0.18,
                background: `radial-gradient(circle at 50% 50%, ${tint} 0%, transparent 70%)`,
                filter: `blur(${(wispSize * 0.18).toFixed(1)}px)`,
                ["--spark-x" as string]: "0px",
                ["--spark-drift" as string]: `${drift}px`,
                ["--spark-rise" as string]: `-${lerp(140, 200, ferocity)}%`,
                animation: `stylized-smoke-puff ${dur.toFixed(2)}s ease-out infinite`,
                animationDelay: `${delay.toFixed(2)}s`,
                mixBlendMode: "screen",
                zIndex: 0,
                opacity: lerp(0.4, 0.85, ferocity),
                willChange: "transform, opacity",
              }}
            />
          );
        })}
      </div>

      {/* ─── Stage-up bed flash ─── */}
      {burst && (
        <span
          className="absolute left-1/2 rounded-full pointer-events-none"
          style={{
            width: bedWidth * 1.3,
            height: Math.max(6, size * 0.06),
            bottom: size * 0.02,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 50%, hsl(54 100% 92%) 0%, hsl(40 100% 65%) 35%, transparent 75%)`,
            filter: "blur(3px)",
            mixBlendMode: "screen",
            animation: "stylized-bed-flash 0.7s ease-out forwards",
            zIndex: 5,
          }}
        />
      )}
    </div>
  );
};

export default StylizedStreakFlame;
