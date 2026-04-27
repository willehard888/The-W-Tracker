import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Detect device performance class once per page load.
 * - "low": reduced-motion preference, low-core CPUs, or tiny screens → halve density
 * - "high": desktops/tablets with 6+ cores and DPR>=2 → full inferno
 */
const detectPerfClass = (): "low" | "mid" | "high" => {
  if (typeof window === "undefined") return "mid";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "low";
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio ?? 1;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || mem <= 3) return "low";
  if (cores >= 8 && dpr >= 2 && mem >= 6) return "high";
  return "mid";
};
let _perfClassCache: "low" | "mid" | "high" | null = null;
const getPerfClass = () => (_perfClassCache ??= detectPerfClass());

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
  /**
   * Multiplier on visual intensity (extra ferocity, brightness, glow).
   * 1 = normal (default). Tribe fire uses 10 → max-out everything for
   * a dramatic "collective inferno" effect.
   */
  intensify?: number;
  /** Optional accent color (hsl) for outer aura when intensify > 1. */
  accent?: string;
  /**
   * Snap-back duration in ms after the user lifts their finger. During this
   * window, wind/proximity/gust/blast vaimenevat ~3× nopeammin kuin
   * passiivisessa driftissä, jolloin liekki "rentoutuu" terävästi.
   * - Mobile / coarse pointer (sormi): default 260 ms — terävin tuntu
   * - Desktop / fine pointer (hiiri):  default 600 ms — pehmeämpi
   * Pass an explicit number to override device autodetection.
   * Range: 80–1500 ms (clamped).
   */
  releaseSnapMs?: number;
  className?: string;
}

/**
 * Detect whether the primary input device is a coarse pointer (touch/finger).
 * Used to default the snap-back to a tighter, more tactile value on mobile.
 */
const isCoarsePointer = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
};

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

const StylizedStreakFlame = ({ streak, size = 140, intensify = 1, accent, releaseSnapMs, className }: StylizedStreakFlameProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Intensify clamped & normalized: 1 = base, 10 = inferno
  const intensity = Math.max(1, Math.min(10, intensify));
  const intensityNorm = (intensity - 1) / 9; // 0..1
  // When intensify > 1, push the effective streak deep into the max stage
  // so the flame uses its biggest, most ferocious configuration.
  const effectiveStreak = streak + Math.round(intensityNorm * 220);
  const stage = stageFromStreak(effectiveStreak);
  const t = progressFromStreak(effectiveStreak);
  const isCold = stage === 0 && intensity <= 1;

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

  // ── REACTIVITY v2 — multi-axis lean, proximity bloom, scroll gust,
  //    tap blast (with haptic), and idle breath. All driven via CSS vars
  //    on the container so animations read live state without rerender.
  //      --ssf-wind-x   : -1..1 horizontal lean (pointer X)
  //      --ssf-wind-y   : -1..1 vertical reach  (pointer above flame = +)
  //      --ssf-gust     :  0..1 short-lived burst (fast pointer / scroll)
  //      --ssf-proximity:  0..1 closeness boost (brightness + saturation)
  //      --ssf-blast    :  0..1 tap pop, decays ~800 ms
  //      --ssf-idle     :  0..1 idle dimming (no input >4 s)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [blastSparks, setBlastSparks] = useState<Array<{ id: number; angle: number; dist: number; size: number }>>([]);
  // (blastRingKey poistettu — tap-blast valkoinen rengas oli cheap glow)
  useEffect(() => {
    if (isCold) return;
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    let targetWindX = 0;
    let targetWindY = 0;
    let currentWindX = 0;
    let currentWindY = 0;
    let proximity = 0;
    let targetProximity = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();
    let gust = 0;
    let gustDecay = 0;
    let blast = 0;
    let idle = 0;
    let lastInputT = performance.now();
    let inProximity = false; // hysteresis flag

    // (Haptic-kutsut poistettu — käyttäjän pyyntö: ei vähtelyä)

    const triggerBlast = () => {
      blast = 1;
      lastInputT = performance.now();
      // (haptic poistettu)
      const baseId = Date.now();
      const sparks = Array.from({ length: 8 }).map((_, i) => ({
        id: baseId + i,
        angle: (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        dist: size * (0.55 + Math.random() * 0.45),
        size: 2 + Math.random() * 2.4,
      }));
      setBlastSparks(sparks);
      // (rengasvälähdys poistettu — vain kipinät jäävät)
      window.setTimeout(() => setBlastSparks([]), 900);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.6;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const influence = Math.max(0, Math.min(1, 1 - (dist - size * 1.4) / (size * 2.6)));
      // Bend AWAY from pointer X
      targetWindX = Math.max(-1, Math.min(1, -dx / (size * 1.1))) * influence;
      // Reach UP toward pointer when above (dy<0), shrink slightly when below
      targetWindY = Math.max(-1, Math.min(1, -dy / (size * 1.0))) * influence;
      // Proximity 0..1 (peaks within ~1× size)
      targetProximity = Math.max(0, Math.min(1, 1 - dist / (size * 1.6)));
      // (proximity-haptic poistettu)
      if (targetProximity > 0.7 && !inProximity) {
        inProximity = true;
      } else if (targetProximity < 0.4 && inProximity) {
        inProximity = false;
      }
      // Gust = pointer speed × influence
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      const gustHit = Math.min(1, speed / 1.6) * influence;
      if (gustHit > gust) {
        gust = gustHit;
        gustDecay = 0.020;
      }
      lastInputT = now;
    };

    const onPointerDown = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left - 24 && e.clientX <= rect.right + 24 &&
        e.clientY >= rect.top - 24 && e.clientY <= rect.bottom + 24;
      if (inside) triggerBlast();
    };

    let lastScrollY = window.scrollY;
    let lastScrollT = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(16, now - lastScrollT);
      const dy = window.scrollY - lastScrollY;
      const speed = Math.abs(dy) / dt;
      lastScrollY = window.scrollY;
      lastScrollT = now;
      const hit = Math.min(1, speed / 2.4);
      if (hit > gust) { gust = hit; gustDecay = 0.025; }
      // Scroll direction nudges horizontal lean
      targetWindX += (dy > 0 ? -0.35 : 0.35) * hit;
      targetWindX = Math.max(-1, Math.min(1, targetWindX));
      lastInputT = now;
      // (scroll-haptic poistettu)
    };

    // Perlin-tyyppinen luonnollinen turbulenssi (deterministinen sin-summa)
    // — antaa liekille orgaanisen "ei-koskaan-täysin-paikallaan" tunnun.
    // RAUHALLINEN amplitudi: lähes huomaamaton sivellin ilman kosketusta.
    const t0 = performance.now();
    const turbulence = (now: number) => {
      const t = (now - t0) / 1000;
      // Hitaammat taajuudet + pienempi amplitudi → rauhallinen idle-tila.
      const x = Math.sin(t * 0.55) * 0.6 + Math.sin(t * 1.27 + 1.3) * 0.25 + Math.sin(t * 2.4 + 2.1) * 0.08;
      const y = Math.cos(t * 0.48 + 0.5) * 0.5 + Math.sin(t * 1.4 + 1.9) * 0.2 + Math.cos(t * 2.7 + 0.8) * 0.06;
      return { x: x * 0.09, y: y * 0.06 }; // Puolitettu — todella hienovarainen
    };

    // Pointer-tila: kun käyttäjä päästää irti, vapautamme reaktiot AGGRESSIIVISESTI
    // takaisin nollaan (eri vaimennuskertoimet kuin "passiivinen drift").
    let pointerActive = false;
    let releaseT = 0; // milloin pointer vapautettiin → nopea snap-back -ikkuna

    // Resolve snap-back duration:
    //   - explicit prop wins (clamped to 80–1500 ms)
    //   - else: 260 ms on coarse pointer (mobile/touch), 600 ms otherwise
    const resolvedSnapMs = (() => {
      if (typeof releaseSnapMs === "number" && Number.isFinite(releaseSnapMs)) {
        return Math.max(80, Math.min(1500, releaseSnapMs));
      }
      return isCoarsePointer() ? 260 : 600;
    })();

    // Pre-compute lerp coefficients that produce the requested snap duration.
    // 60fps → ~16.7ms/frame. To reach ~95% of target in N frames we need
    // lerp ≈ 1 - 0.05^(1/N). We cap at 0.55 so motion stays smooth (no jank).
    const framesInWindow = Math.max(4, Math.round(resolvedSnapMs / 16.7));
    const baseLerp = Math.min(0.55, 1 - Math.pow(0.05, 1 / framesInWindow));
    const releaseLerpX = baseLerp;             // sway/wind X — snappiest axis
    const releaseLerpY = baseLerp * 0.88;      // Y slightly softer (vertical reach)
    const releaseLerpProx = baseLerp * 0.94;   // proximity bloom decays smoothly
    // Decay-per-frame for additive scalars (gust/blast).
    // ~95% gone in `framesInWindow` frames.
    const releaseGustDecay = Math.min(0.18, 1 - Math.pow(0.05, 1 / framesInWindow));
    const releaseBlastDecay = releaseGustDecay * 0.78;
    // Target multipliers per frame (push targets toward 0 hard during snap).
    const targetSnapMul = Math.pow(0.05, 1 / framesInWindow); // → ~0.05 left after window
    const targetSnapMulX = Math.max(0.6, targetSnapMul);
    const targetSnapMulY = Math.max(0.55, targetSnapMul);
    const targetSnapMulProx = Math.max(0.5, targetSnapMul);

    const onPointerUp = () => {
      pointerActive = false;
      releaseT = performance.now();
      inProximity = false;
      // (release-haptic poistettu)
    };

    const onPointerDownTrack = (e: PointerEvent) => {
      pointerActive = true;
      onPointerDown(e);
    };

    // Adaptive frame budget — full 60 fps when visible, 12 fps when off-screen,
    // paused when tab/app is hidden. The flame ALWAYS keeps animating when
    // visible per user spec; off-screen we only down-throttle, never freeze.
    let isVisible = true;
    let isPageHidden = typeof document !== "undefined" && document.hidden;
    let lastFrameT = 0;

    const tick = (now: number) => {
      // Off-screen throttle: cap to ~12 fps to save battery without freezing.
      const minDelta = isVisible ? 0 : 80;
      if (now - lastFrameT < minDelta) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrameT = now;

      const turb = turbulence(now);
      // Kun käyttäjä on lähellä, turb feidaa pois → input vie vallan.
      const turbBlend = Math.max(0.25, 1 - proximity * 1.4);
      const effectiveTargetX = targetWindX + turb.x * turbBlend;
      const effectiveTargetY = targetWindY + turb.y * turbBlend;

      // Reaktiivisuus: pointer aktiivisena = pehmeä lerp; vapautuksen jälkeen
      // resolvedSnapMs aikaikkuna käyttää NOPEAA snap-backia jotta liekki
      // "rentoutuu" terävästi. Mobiilissa lyhyempi → tactile, desktopilla
      // pidempi → pehmeä.
      const sinceRelease = now - releaseT;
      const isReleasing = !pointerActive && releaseT > 0 && sinceRelease < resolvedSnapMs;
      const windLerpX = isReleasing ? releaseLerpX : 0.13;
      const windLerpY = isReleasing ? releaseLerpY : 0.10;
      const proxLerp  = isReleasing ? releaseLerpProx : 0.08;
      currentWindX += (effectiveTargetX - currentWindX) * windLerpX;
      currentWindY += (effectiveTargetY - currentWindY) * windLerpY;
      proximity += (targetProximity - proximity) * proxLerp;
      // Gust ja blast vaimentuvat nopeammin vapautuksen jälkeen
      const gustStep = isReleasing ? Math.max(gustDecay, releaseGustDecay) : gustDecay;
      gust = Math.max(0, gust - gustStep);
      blast = Math.max(0, blast - (isReleasing ? releaseBlastDecay : 0.018));

      // Idle ramp: pidetään liekki AINA elossa — idle on rajoitettu 0.5 maksimiin
      // jotta turbulenssi (sway/breathing) säilyy näkyvänä ilman vuorovaikutustakin.
      // Tämä on käyttäjän vaatimus: liekit ovat koko ajan päällä, ei koskaan jähmettyneenä.
      const sinceInput = now - lastInputT;
      const idleTarget = sinceInput > 1500 ? Math.min(0.5, (sinceInput - 1500) / 2400) : 0;
      idle += (idleTarget - idle) * 0.05;

      // Vapautuksen jälkeen targets vetäytyvät NOPEASTI nollaan (kerroin
      // skaalattu snap-ikkunan mukaan); muuten klassinen passiivinen drift.
      if (isReleasing) {
        targetWindX *= targetSnapMulX;
        targetWindY *= targetSnapMulY;
        targetProximity *= targetSnapMulProx;
      } else {
        targetWindX *= 0.985;
        targetWindY *= 0.97;
        targetProximity *= 0.92;
      }

      el.style.setProperty("--ssf-wind-x", currentWindX.toFixed(3));
      el.style.setProperty("--ssf-wind-y", currentWindY.toFixed(3));
      el.style.setProperty("--ssf-gust", gust.toFixed(3));
      el.style.setProperty("--ssf-proximity", proximity.toFixed(3));
      el.style.setProperty("--ssf-blast", blast.toFixed(3));
      el.style.setProperty("--ssf-idle", idle.toFixed(3));
      // Heat-haze morph: hidas, riippumaton turbulence-aalto
      el.style.setProperty("--ssf-haze", (Math.sin(now / 1700) * 0.5 + 0.5).toFixed(3));

      if (!isPageHidden) raf = requestAnimationFrame(tick);
    };

    // ── Visibility observers — keep the flame alive when visible, throttle off-
    //    screen, and pause completely when the tab/app is in background. On
    //    resume we re-seed lastInputT so the idle ramp doesn't pop, and we
    //    restart the rAF loop instantly.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) isVisible = e.isIntersecting;
      },
      { threshold: 0.01 },
    );
    io.observe(el);

    const onVisibility = () => {
      const wasHidden = isPageHidden;
      isPageHidden = document.hidden;
      if (wasHidden && !isPageHidden) {
        // App resumed — reset input timestamp & relaunch the loop instantly.
        lastInputT = performance.now();
        lastFrameT = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDownTrack, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── DEVICE ORIENTATION & MOTION — millisekuntitason reagointi laitteen
    //    kallistukseen ja liikkeeseen. Toimii sekä webissä (DeviceOrientation API)
    //    että natiivissa Capacitor-buildissa. iOS 13+ vaatii permissionin →
    //    pyydetään kerran ensimmäisen tap-eventin yhteydessä.
    //    - beta  = etu-taakse kallistus (-180..180), käytetään y-tuulena
    //    - gamma = sivuttainen kallistus (-90..90), käytetään x-tuulena
    //    - rotationRate.alpha/beta/gamma → gust (kun puhelinta heilutetaan nopeasti)
    let lastTiltX = 0;
    let lastTiltY = 0;
    let lastTiltT = performance.now();
    const TILT_LERP_INTO_TARGET = 0.85; // erittäin nopea (ms-tason) responsiivisuus
    const onOrientation = (e: DeviceOrientationEvent) => {
      // Normalisoi: gamma -45..45 → -1..1 (kallistus käytännössä tuolla välillä)
      const gamma = typeof e.gamma === "number" ? e.gamma : 0;
      const beta = typeof e.beta === "number" ? e.beta : 0;
      // Liekki taipuu KALLISTUSTA VASTAAN (kuin painovoima/inertia)
      const tiltX = Math.max(-1, Math.min(1, -gamma / 35));
      // Beta: 0=pysty, 90=vaakasuora. Käytetään pieni offsetti pysty-asennon ympärillä.
      const tiltY = Math.max(-1, Math.min(1, -(beta - 60) / 45));
      // Syötä SUORAAN target-arvoon → seuraavalla rAF-tickillä currentWind seuraa
      // Painotetaan kovaa: tilt vie hallinnan jos käyttäjä ei kosketa
      if (!pointerActive) {
        targetWindX = targetWindX * (1 - TILT_LERP_INTO_TARGET) + tiltX * TILT_LERP_INTO_TARGET;
        targetWindY = targetWindY * (1 - TILT_LERP_INTO_TARGET) + tiltY * TILT_LERP_INTO_TARGET;
      } else {
        // Pointer aktiivinen → tilt sekoittuu kevyesti
        targetWindX = targetWindX * 0.7 + tiltX * 0.3;
        targetWindY = targetWindY * 0.8 + tiltY * 0.2;
      }
      // Tilt-derivaatta = gust (nopea heilautus → puuska)
      const now = performance.now();
      const dt = Math.max(8, now - lastTiltT);
      const dTilt = Math.hypot(tiltX - lastTiltX, tiltY - lastTiltY);
      const tiltSpeed = dTilt / (dt / 1000); // per second
      const gustHit = Math.min(1, tiltSpeed / 4);
      if (gustHit > gust) {
        gust = gustHit;
        gustDecay = 0.022;
      }
      lastTiltX = tiltX;
      lastTiltY = tiltY;
      lastTiltT = now;
      lastInputT = now;
    };
    const onMotion = (e: DeviceMotionEvent) => {
      // RotationRate antaa kulmanopeuden °/s — heilautukset → gust
      const rr = e.rotationRate;
      if (!rr) return;
      const speed = Math.hypot(rr.alpha || 0, rr.beta || 0, rr.gamma || 0);
      const gustHit = Math.min(1, speed / 220); // 220°/s = vahva heilautus
      if (gustHit > gust) {
        gust = gustHit;
        gustDecay = 0.025;
      }
      if (gustHit > 0.05) lastInputT = performance.now();
    };
    // iOS 13+ vaatii permissionin — yritetään hiljaa, fallback web-eventteihin
    const requestOrientationPermission = () => {
      const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
      const reqs: Promise<string>[] = [];
      if (DOE && typeof DOE.requestPermission === "function") reqs.push(DOE.requestPermission());
      if (DME && typeof DME.requestPermission === "function") reqs.push(DME.requestPermission());
      if (reqs.length === 0) return;
      Promise.all(reqs).catch(() => {});
    };
    // Ensimmäinen pointerdown laukaisee permissionin (iOS vaatimus)
    const onFirstTouch = () => {
      requestOrientationPermission();
      window.removeEventListener("pointerdown", onFirstTouch);
    };
    window.addEventListener("pointerdown", onFirstTouch, { once: true, passive: true });
    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    window.addEventListener("devicemotion", onMotion, { passive: true });

    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDownTrack);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("pointerdown", onFirstTouch);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [isCold, size, releaseSnapMs]);


  // How many flames at this stage — TIUKEMPI cap suorituskyvyn vuoksi.
  // SVG feTurbulence + feDisplacementMap on raskasta: jokainen liekki maksaa
  // ~1 GPU-blittauksen per frame. Liian monta = lag mobiilissa.
  // high = 3× (max 36), mid = 2× (max 24), low = 1.5× (max 16).
  const perfClass = getPerfClass();
  const fullPassMultiplier = perfClass === "high" ? 3 : perfClass === "mid" ? 2 : 1.5;
  const flameCap = perfClass === "high" ? 36 : perfClass === "mid" ? 24 : 16;

  // Progressive boot: render hero + front-row instantly (PASSES=1), then ramp up
  // to full density on the next animation frame so the perceived first paint is
  // virtually instant. Layers stack additively in `screen` mode, so the upgrade
  // is visually seamless — fire only gets richer.
  const [passMultiplier, setPassMultiplier] = useState(() => Math.min(1, fullPassMultiplier));
  useEffect(() => {
    if (passMultiplier >= fullPassMultiplier) return;
    // Defer the upgrade until after first paint + a short idle window
    const raf = requestAnimationFrame(() => {
      const id = setTimeout(() => setPassMultiplier(fullPassMultiplier), 140);
      return () => clearTimeout(id);
    });
    return () => cancelAnimationFrame(raf);
  }, [fullPassMultiplier, passMultiplier]);

  const flameCount = isCold ? 0 : Math.min(flameCap, Math.round((2 + stage * 2) * passMultiplier));

  // Bed width (how wide the flames spread) and tallest flame height — wider, taller, smoother
  const bedWidth = lerp(0.55, 1.25, t) * size;
  const tallestH = lerp(0.75, 1.3, t) * size;

  // Build layer plan deterministically per (uid, stage, t)
  const layers: FlameLayer[] = useMemo(() => {
    if (flameCount === 0) return [];
    // Base 14 curated layers — back→front for organic depth, fuller bonfire feel.
    const basePlan: Omit<FlameLayer, "delaySeed">[] = [
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

    // ── 6× the plan: 6 passes per base layer with deterministic jitter
    // (different scale, xOffset, speed, hue) so layers stack as parallax
    // copies instead of identical clones — no two flames look the same.
    const PASSES = passMultiplier;
    const plan: Omit<FlameLayer, "delaySeed">[] = [];
    for (let pass = 0; pass < PASSES; pass++) {
      basePlan.forEach((b, idx) => {
        // Jitter values vary per (pass, idx) — deterministic, no randomness
        const j = (pass * 17 + idx * 11) % 13;
        const scaleJ = 1 + ((j - 6) / 60);                       // ±10% scale
        const xJ = ((j - 6) / 80);                                // ±0.075 xOffset
        const speedJ = 1 + ((j - 6) / 50);                        // ±12% speed
        const hueJ = ((j - 6) / 6);                               // ±1 hue
        // Pass intensity rotates so layers stratify into front/mid/back parallax bands
        const intenCycle = [1, 0.92, 1.04, 0.88, 1.06, 0.96];
        const intenJ = intenCycle[pass % intenCycle.length];
        const pathJ = (b.pathIndex + pass * 2) % FLAME_PATHS.length;
        plan.push({
          ...b,
          pathIndex: pathJ,
          scale: Math.max(0.5, Math.min(1.18, b.scale * scaleJ)),
          xOffset: Math.max(-0.85, Math.min(0.85, b.xOffset + xJ)),
          speed: Math.max(0.5, b.speed * speedJ),
          hueShift: b.hueShift + hueJ,
          intensity: Math.max(0.35, Math.min(1, b.intensity * intenJ)),
        });
      });
    }

    // Take the right number, but always include the hero (last of pass 0)
    let chosen: typeof plan;
    if (flameCount <= 3) {
      // Tiny fires: pick from front row + hero of pass 0
      chosen = [...plan.slice(9, 9 + (flameCount - 1)), plan[13]].slice(0, flameCount);
    } else {
      const heroLayer = plan[13]; // hero from pass 0
      // Build a priority order across all passes: mid → front → back, pass 0 first
      const passSlice = (p: number) => plan.slice(p * 14, (p + 1) * 14);
      const ordered: typeof plan = [];
      for (let p = 0; p < PASSES; p++) {
        const passLayers = passSlice(p);
        ordered.push(
          ...passLayers.slice(4, 9),            // mid row (5)
          ...passLayers.slice(9, 13),           // front row (4)
          ...passLayers.slice(0, 4),            // back row (4)
        );
      }
      chosen = [...ordered.slice(0, flameCount - 1), heroLayer];
    }

    // Sort by zIndex so back renders first
    chosen.sort((a, b) => a.zIndex - b.zIndex);

    return chosen.map((c, i) => ({
      ...c,
      delaySeed: -((seed.a * (i + 1) + seed.b * (i + 3) + seed.c * (i + 5)) % 2300) / 1000,
    }));
  }, [flameCount, passMultiplier, seed.a, seed.b, seed.c]);

  // Cold state — thin outline candle, gold-soft so it stays on-theme
  if (isCold) {
    return (
      <div
        className={cn("relative pointer-events-none flex items-end justify-center", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg width={size * 0.3} height={size * 0.5} viewBox="0 0 100 140" fill="none" className="opacity-40">
          <path d={FLAME_PATHS[2]} stroke="currentColor" strokeWidth="3" strokeLinejoin="round" style={{ color: "hsl(var(--gold-soft) / 0.55)" }} />
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
    // back row — soft warp, moderate bloom (slow & smooth)
    {
      freq: "0.020 0.048",
      peakFreq: "0.040 0.082",
      baseScale: lerp(2.0, 3.6, ferocity),
      peakScale: lerp(3.4, 6.2, ferocity),
      dur: lerp(2.6, 1.6, ferocity),
      bloomStdDev: lerp(2.6, 3.4, ferocity), // reduced for sharper silhouette
    },
    // mid row — flowing roar, crisper edges
    {
      freq: "0.030 0.066",
      peakFreq: "0.060 0.12",
      baseScale: lerp(2.6, 4.6, ferocity),
      peakScale: lerp(4.4, 7.2, ferocity),
      dur: lerp(1.8, 1.1, ferocity),
      bloomStdDev: lerp(1.4, 2.0, ferocity), // reduced
    },
    // front row — SHARP whip, minimal bloom for crisp 3D edges
    {
      freq: "0.046 0.10",
      peakFreq: "0.090 0.18",
      baseScale: lerp(3.2, 5.6, ferocityFront),
      peakScale: lerp(5.4, 9.0, ferocityFront),
      dur: lerp(1.25, 0.75, ferocityFront),
      bloomStdDev: lerp(0.6, 1.1, ferocity), // razor-sharp tips
    },
  ];
  const intensityBoost = lerp(0.95, 1.65, ferocity);

  // Floor light pool — wash beneath the flames simulating ground reflection
  const floorPoolColor = stage >= 6 ? "hsl(14 100% 50%)" : stage >= 4 ? "hsl(10 100% 46%)" : "hsl(6 95% 42%)";

  // (Tribe outer aura halo removed — looked like cheap glow.
  //  Tribe intensity now expressed purely through doubled flame count + ferocity.)

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-end justify-center", className)}
      style={{
        width: size,
        height: size,
        // Container needs pointer events so taps register; inner aria-hidden children remain decorative.
        pointerEvents: "auto",
        animation: `stylized-flame-bob ${(3.4).toFixed(2)}s cubic-bezier(0.22, 0.61, 0.36, 1) infinite`,
        // Reactive lean: pointer-X + gust + scroll. Wind degrees fed to sway keyframes.
        ["--ssf-wind" as string]: `calc(var(--ssf-wind-x, 0) * 16deg + var(--ssf-gust, 0) * 8deg)`,
        // Filter: intensify-base + proximity bloom + gust flash + blast pop − idle dim
        filter: `brightness(calc(${(1 + intensityNorm * 0.35).toFixed(3)} + var(--ssf-gust, 0) * 0.25 + var(--ssf-proximity, 0) * 0.25 + var(--ssf-blast, 0) * 0.55 - var(--ssf-idle, 0) * 0.18)) saturate(calc(${(1 + intensityNorm * 0.4).toFixed(3)} + var(--ssf-proximity, 0) * 0.3 + var(--ssf-gust, 0) * 0.3 - var(--ssf-idle, 0) * 0.12))`,
        transition: "filter 0.18s ease-out",
      }}
      aria-hidden
    >
      {/* (Tap-blast valkoinen rengasvälähdys poistettu — luki cheap-glown.
          Vain orange/red-kipinät sinkoutuvat ulos, jolloin pysytään puhtaassa
          tuli-värimaailmassa.) */}
      {/* ── TAP-BLAST SPARKS — 8 lämmin-oranssia kipunaa sinkoutuu radiaalisesti ── */}
      {blastSparks.map((sp) => {
        const tx = Math.cos(sp.angle) * sp.dist;
        const ty = Math.sin(sp.angle) * sp.dist - size * 0.08; // pieni nostebias
        // Värit pidetään puhtaasti tulipaletissa: keltainen → oranssi → punainen
        const sparkPalette = [
          { core: "hsl(48 100% 62%)",  glow: "hsl(38 100% 55%)" },  // keltainen kipuna
          { core: "hsl(28 100% 56%)",  glow: "hsl(18 100% 48%)" },  // oranssi kipuna
          { core: "hsl(12 95% 50%)",   glow: "hsl(4 90% 42%)"  },   // punainen kipuna
        ];
        const c = sparkPalette[sp.id % 3];
        return (
          <span
            key={`blast-spark-${sp.id}`}
            className="absolute pointer-events-none rounded-full"
            style={{
              width: sp.size,
              height: sp.size,
              left: "50%",
              top: "60%",
              background: c.core,
              // Tighter shadow — ei levitä blurmaista hehkua
              boxShadow: `0 0 ${sp.size * 1.4}px ${c.glow}`,
              ["--blast-tx" as string]: `${tx.toFixed(1)}px`,
              ["--blast-ty" as string]: `${ty.toFixed(1)}px`,
              animation: "ssf-blast-spark 850ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards",
              mixBlendMode: "screen",
              zIndex: 7,
            }}
          />
        );
      })}
      {/* (Tribe inferno aura halo removed — used to be a soft radial glow,
          read as cheap lens-flare. Tribe intensity is now expressed only via
          doubled flame count + reactive ferocity.) */}
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
              {/* Internal bloom — single soft pass, then crisp source on top
                  for sharp 3D edges (not soft halo). */}
              <feGaussianBlur in="warped" stdDeviation={cfg.bloomStdDev} result="bloomLarge" />
              <feMerge>
                <feMergeNode in="bloomLarge" />
                <feMergeNode in="warped" />
                <feMergeNode in="warped" />
              </feMerge>
            </filter>
          ))}

          {/* Per-layer vertical gradients — PURE FIRE palette
              (charred ember → blood-red → deep tangerine → burnt orange → glowing amber → warm yellow apex)
              VAIN punainen / oranssi / keltainen — ei sinistä kaasubasea, ei valkoista cream-apex. */}
          {layers.map((layer, i) => {
            const gradId = `ssf-grad-${uid}-${i}`;
            const hShift = layer.hueShift;
            const inten = layer.intensity;
            // Pohjasta lämmin tumma punainen — ei sinistä happikaasua (luki "scifi-light"-sävyltä).
            // Koko paletti siirretty PUNAISEMPAAN suuntaan: vähemmän keltaista, enemmän verenpunaa & syvää oranssia.
            const fuelShadow = `hsl(${0 + hShift} 60% ${lerp(8, 13, inten)}%)`;        // near-black blood base
            const neckBase   = `hsl(${2 + hShift} 95% ${lerp(18, 26, inten)}%)`;        // syvä punainen pohja
            const charred    = `hsl(${0 + hShift}  92% ${lerp(20, 30, inten)}%)`;       // charred crimson ember
            const ember      = `hsl(${4 + hShift}  98% ${lerp(30, 40, inten)}%)`;       // blood ember red
            const deepBase   = `hsl(${8 + hShift} 100% ${lerp(38, 48, inten)}%)`;       // deep red-orange
            const body       = `hsl(${12 + hShift} 100% ${lerp(46, 55, inten)}%)`;      // crimson-orange body
            const shoulder   = `hsl(${16 + hShift} 100% ${lerp(50, 58, inten)}%)`;      // burnt blood-orange
            const upperBody  = `hsl(${20 + hShift} 100% ${lerp(50, 57, inten)}%)`;      // deep tangerine
            const tipColor   = inten > 0.85
              ? `hsl(${24 + hShift} 100% ${lerp(52, 58, inten)}%)`                      // syvä oranssi (ei amber/keltainen)
              : `hsl(${22 + hShift} 100% ${lerp(48, 54, inten)}%)`;
            // Apex: kylläinen syvä oranssi — EI keltaista, EI valkoista.
            const apex       = inten > 0.94 ? `hsl(28 100% 56%)` : tipColor;


            return (
              <linearGradient key={gradId} id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
                {/* Pohja: tummaa hiiltynyttä punaista — pinnaa liekin maahan */}
                <stop offset="0%"   stopColor={fuelShadow} stopOpacity="0.92" />
                <stop offset="4%"   stopColor={neckBase}   stopOpacity="0.97" />
                <stop offset="10%"  stopColor={charred}    stopOpacity="1" />
                <stop offset="20%"  stopColor={ember}      stopOpacity="1" />
                {/* Keskirunko: täydet värit, kaikki kuumin alue */}
                <stop offset="35%"  stopColor={deepBase}   stopOpacity="0.98" />
                <stop offset="52%"  stopColor={body}       stopOpacity="0.95" />
                <stop offset="68%"  stopColor={shoulder}   stopOpacity="0.88" />
                {/* Yläosa: NOPEA alpha-feidaus → läpinäkyvä kärki kuten oikeassa liekissä */}
                <stop offset="82%"  stopColor={upperBody}  stopOpacity="0.65" />
                <stop offset="91%"  stopColor={tipColor}   stopOpacity="0.32" />
                <stop offset="97%"  stopColor={apex}       stopOpacity="0.1" />
                <stop offset="100%" stopColor={apex}       stopOpacity="0" />
              </linearGradient>
            );
          })}

          {/* Inner core — kylläinen oranssi-punainen sydän, EI valkoista hot-spot. */}
          {layers.filter((l) => l.zIndex >= 3).map((_, idx) => {
            const id = `ssf-core-${uid}-${idx}`;
            return (
              <radialGradient key={id} id={id} cx="50%" cy="62%" r="38%">
                {/* Pure red-orange core — keskipiste syvä oranssi, EI keltainen, EI vaalea. */}
                <stop offset="0%"   stopColor="hsl(24 100% 54%)" stopOpacity="1" />
                <stop offset="14%"  stopColor="hsl(18 100% 50%)" stopOpacity="0.92" />
                <stop offset="32%"  stopColor="hsl(12 100% 46%)" stopOpacity="0.72" />
                <stop offset="56%"  stopColor="hsl(6 98% 40%)"  stopOpacity="0.4" />
                <stop offset="80%"  stopColor="hsl(2 95% 32%)"   stopOpacity="0.15" />
                <stop offset="100%" stopColor="hsl(0 90% 24%)"   stopOpacity="0" />
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
          // (blur poistettu käyttäjän pyynnöstä)
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
            background: `radial-gradient(ellipse at 50% 78%, hsl(14 100% 46% / 0.32) 0%, hsl(6 95% 38% / 0.18) 40%, hsl(0 88% 28% / 0.08) 70%, transparent 88%)`,
            // (blur poistettu)
            mixBlendMode: "screen",
            animation: `stylized-haze-drift 4s ease-in-out infinite`,
            zIndex: 2,
            opacity: lerp(0.4, 0.9, t),
          }}
        />
      )}

      {/* ─── HEAT-HAZE — kuumuuden aiheuttama ilmanvärähtely liekin yläpuolella ─── */}
      {stage >= 2 && (
        <span
          className="absolute left-1/2 pointer-events-none"
          style={{
            width: bedWidth * 1.1,
            height: tallestH * 0.55,
            bottom: tallestH * 0.55,
            transform: `translateX(-50%) translateY(calc(var(--ssf-haze, 0.5) * -3px)) scaleY(calc(1 + var(--ssf-haze, 0.5) * 0.04))`,
            background: `radial-gradient(ellipse at 50% 30%, hsl(18 80% 65% / 0.10) 0%, hsl(10 70% 55% / 0.05) 45%, transparent 80%)`,
            // (blur poistettu)
            mixBlendMode: "screen",
            zIndex: 5,
            opacity: lerp(0.5, 1, t),
            transition: "transform 0.08s linear",
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
          background: `radial-gradient(ellipse at 50% 50%, hsl(28 100% 56% / 1) 0%, hsl(18 100% 50% / 0.95) 22%, hsl(10 100% 45% / 0.85) 48%, hsl(4 95% 36% / 0.6) 72%, hsl(0 88% 24% / 0.3) 90%, transparent 100%)`,
          // (blur poistettu)
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
              background: i % 3 === 0 ? "hsl(28 100% 56%)" : "hsl(16 100% 50%)",
              boxShadow: `0 0 ${dot * 1.4}px hsl(8 100% 44%)`,
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
            // Atmospheric perspective ILMAN bluria — pelkkä saturate + brightness
            // → parallax-syvyys värisävyllä, ei sumealla pehmeydellä.
            const layerAirFilter = layer.zIndex === 1
              ? "saturate(0.9) brightness(0.92)"
              : layer.zIndex === 2
                ? "saturate(0.98)"
                : "brightness(1.05) saturate(1.06)";
            // Per-liekki tuulivaste: etummaiset reagoivat enemmän kuin takarivin
            // (lähempänä ilmavirtaa) → orgaaninen 3D-tunnu kun kallistat puhelinta.
            const windRespX = layer.zIndex === 3 ? 5 : layer.zIndex === 2 ? 3 : 1.6;
            const windRespY = windRespX * 0.55;

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
                  // Per-liekki parallax: oma tuulivaste päälle + pohjana wrapper sway
                  transform: `translateX(calc(-50% + var(--ssf-wind-x, 0) * ${windRespX.toFixed(1)}px)) translateY(calc(var(--ssf-wind-y, 0) * ${(-windRespY).toFixed(1)}px)) translateZ(${zDepth.toFixed(1)}px)`,
                  transformOrigin: "center bottom",
                  zIndex: layer.zIndex,
                  animation: `stylized-flame-sway-${(i % 3) + 1} ${swayDur.toFixed(2)}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
                  animationDelay: `${layer.delaySeed.toFixed(2)}s`,
                  willChange: layer.zIndex >= 3 ? "transform" : "auto",
                  mixBlendMode: "screen",
                  opacity: layerOpacity,
                  filter: layerAirFilter,
                }}
              >
                {/* ─── REALISTINEN YHDISTELMÄ — kolme kerrosta jotka jäljittelevät
                     oikean liekin fysiikkaa: ulkoreuna kirkas (kaasu reagoi hapen
                     kanssa), keskus läpinäkyvämpi (kuumin pyrolyysi-zoni), pohja
                     syvän punainen. Yksi multiply-outline POISTETTU → ~25%
                     kevyempi per liekki ilman että näyttää litteältä. */}

                {/* 1) BODY — turbulenssilla muotoiltu päärunko vertikaalilla
                     gradientilla. Tämä antaa silhouettin ja "lihan". */}
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
                    willChange: layer.zIndex >= 3 ? "transform, opacity" : "auto",
                    overflow: "visible",
                  }}
                >
                  <path d={FLAME_PATHS[layer.pathIndex]} fill={`url(#${gradId})`} />
                </svg>

                {/* 2) RIM-LIGHT — kapea kirkas reuna (screen-blend) joka jäljittelee
                     oikean liekin "neon-edge"-efektiä referenssikuvassa. Tämä on
                     se mikä saa liekin näyttämään LÄPINÄKYVÄLTÄ ja ELÄVÄLTÄ
                     pelkän tumman outlinen sijaan. Kustannus: 1 turbulenssikäyttö
                     mutta vain stroke (ei fill) → halpa. */}
                <svg
                  width={flameW}
                  height={flameH}
                  viewBox="0 0 100 140"
                  preserveAspectRatio="none"
                  className="absolute inset-0"
                  style={{
                    animation: `stylized-flame-flicker-${(i % 3) + 1} ${speedDur.toFixed(2)}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                    animationDelay: `${(layer.delaySeed - 0.3).toFixed(2)}s`,
                    transformOrigin: "center bottom",
                    mixBlendMode: "screen",
                    pointerEvents: "none",
                    filter: `url(#${filterId})`,
                    overflow: "visible",
                  }}
                >
                  {/* Ulompi pehmeä lämpöhehku — antaa "kuuman ilman" tunnun */}
                  <path
                    d={FLAME_PATHS[layer.pathIndex]}
                    fill="none"
                    stroke={layer.zIndex >= 3 ? "hsl(28 100% 58%)" : layer.zIndex === 2 ? "hsl(20 100% 52%)" : "hsl(14 95% 46%)"}
                    strokeWidth={layer.zIndex >= 3 ? 2.4 : 1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={layer.zIndex >= 3 ? 0.55 : layer.zIndex === 2 ? 0.42 : 0.3}
                    style={{ filter: "blur(0.8px)" }}
                  />
                  {/* Sisempi terävä rim — keltais-oranssi viiva */}
                  <path
                    d={FLAME_PATHS[layer.pathIndex]}
                    fill="none"
                    stroke={layer.zIndex >= 3 ? "hsl(36 100% 62%)" : layer.zIndex === 2 ? "hsl(26 100% 54%)" : "hsl(18 95% 48%)"}
                    strokeWidth={layer.zIndex >= 3 ? 1.0 : 0.7}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={layer.zIndex >= 3 ? 0.9 : layer.zIndex === 2 ? 0.72 : 0.5}
                  />
                </svg>

                {/* 3) DARK BASE — pelkkä ALAOSAN tummennus (ei koko outlinea).
                     Pinnaa liekin maahan ja antaa kontrastia. KEVYT: ei filtteriä,
                     vain pieni gradient-stroke alapäässä. */}
                {layer.zIndex >= 2 && (
                  <svg
                    width={flameW}
                    height={flameH * 0.35}
                    viewBox="0 0 100 49"
                    preserveAspectRatio="none"
                    className="absolute left-0"
                    style={{
                      bottom: 0,
                      mixBlendMode: "multiply",
                      pointerEvents: "none",
                      opacity: layer.zIndex >= 3 ? 0.7 : 0.5,
                    }}
                  >
                    <path
                      d={FLAME_PATHS[layer.pathIndex]}
                      fill="none"
                      stroke="hsl(0 85% 8%)"
                      strokeWidth={2.2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                {/* 4) FRONT CORE — kuuma sisäydin: kapea + matala → keskelle jää
                     "rako" jota näkyy oikeissa liekeissä (kuumin kaasu palaa
                     reunoilla, keskus on osittain läpinäkyvä). */}
                {isFront && coreId && (
                  <svg
                    width={flameW * 0.42}
                    height={flameH * 0.6}
                    viewBox="0 0 100 140"
                    preserveAspectRatio="none"
                    className="absolute left-1/2"
                    style={{
                      bottom: flameH * 0.06,
                      transform: "translateX(-50%)",
                      filter: `url(#${filterId})`,
                      animation: `stylized-flame-flicker-${((i + 1) % 3) + 1} ${(speedDur * 0.8).toFixed(2)}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                      animationDelay: `${(layer.delaySeed - 0.5).toFixed(2)}s`,
                      transformOrigin: "center bottom",
                      mixBlendMode: "screen",
                      opacity: lerp(0.5, 0.9, t),
                    }}
                  >
                    <path d={FLAME_PATHS[layer.pathIndex]} fill={`url(#${coreId})`} />
                  </svg>
                )}
              </div>
            );
          });
        })()}

        {/* ─── EDGE LICKS — pieniä liekkejä ISON liekin REUNOILLA (vasemmalla & oikealla),
             eivät juuressa. Painottuvat siluetin reunoja seuraavaan kaareen, kallistuvat ulospäin
             jotta tuli näyttää "kuhisevan" reunoiltaan. Tiukasti rajattu määrä → sulava 60fps. */}
        {(() => {
          // 20× tiheämpi: high=560, mid=400, low=280. Suuri osa renderöidään
          // KEVYESTI ilman turbulence-filtteriä — vain joka 6. saa filtterin
          // (näkyvämmät, lähempänä kameraa). Loput käyttävät pelkkää fill+stroke
          // SVG:tä → ~10× halvempi per liekki, sallii massiivisen tiheyden.
          const COUNT = perfClass === "high" ? 560 : perfClass === "mid" ? 400 : 280;
          const items: JSX.Element[] = [];
          for (let i = 0; i < COUNT; i++) {
            const side = i % 2 === 0 ? -1 : 1; // vuorotellen vasen/oikea
            const idxOnSide = Math.floor(i / 2);
            const perSide = Math.ceil(COUNT / 2);
            // y-paikka 0 (alhaalla) .. 1 (ylhäällä keskuksen seinämässä)
            const yT = (idxOnSide + 0.5) / perSide; // 0..1
            // Reuna kaartuu sisäänpäin ylöspäin → x-offset pienenee korkeammalla
            const edgeCurve = 1 - Math.pow(yT, 1.6) * 0.7;
            // Pieni jitter etteivät istu rivissä
            const yJitter = (((i * 31 + seed.b * 7) % 100) / 100 - 0.5) * 0.06;
            const xJitter = (((i * 47 + seed.c * 11) % 100) / 100 - 0.5) * bedWidth * 0.03;
            // LÄHEMPÄNÄ ison liekin reunaa: bedWidth*0.28 (oli 0.45) + 0.02 puskuri (oli 0.06)
            // → liekit hipovat varsinaista flame-bodya, eivät leiju kaukana
            const xPx = side * (bedWidth * 0.28 * edgeCurve + bedWidth * 0.02) + xJitter;
            const bottom = size * (0.05 + (yT + yJitter) * 0.55);
            // Kallistus: alhaalla pystyssä, ylhäällä noussee enemmän ulospäin (mutta hillitymmin koska lähempänä)
            const tiltDeg = side * (8 + yT * 22);
            // Koko: pieniä mutta filtteristä yli (>=10px). 20× lisää → laaja kokoskaala
            // jotta tiheä massa ei näytä uniformilta — pienimmät 6px (sub-pixel kipinät).
            const sizeBoost = ((i * 13 + seed.a * 5) % 11) / 11;
            const lickW = Math.max(6, bedWidth * lerp(0.04, 0.12, sizeBoost));
            const lickH = Math.max(14, tallestH * lerp(0.10, 0.30, sizeBoost) * (1 - yT * 0.3));
            // Yksi animaatio per liekki — ei sway-keyframea joka pyyhkisi rotation
            const flickDur = lerp(1.6, 1.0, ferocity) + ((i * 0.17) % 0.5);
            const delay = -(((i * 0.27 + seed.c * 0.011) % flickDur));
            // OPTIMOINTI: vain joka 6. liekki saa kalliin turbulence-filtterin
            // → tiheys 6× halvempi GPU:lle. Loput näyttävät silti elävältä koska
            // CSS-flicker-keyframe pumppaa scale/opacity, ja stroke-rim antaa kontrastin.
            const useFilter = i % 6 === 0;
            const fId = filterIds[i % 2 === 0 ? 1 : 2];
            const gradId = `ssf-grad-${uid}-${i % Math.max(1, layers.length)}`;
            const pathIdx = (i * 3 + 5) % FLAME_PATHS.length;
            // Z-PARALLAX SYVYYS: kauempana keskuksesta = taaempana
            // (negatiivinen depth → blur + dim → ilmaperspektiivi).
            const depthBucket = (i * 7) % 5; // 0..4 (0 = lähimpänä, 4 = kaukana)
            const depthBlur = depthBucket * 0.35; // 0..1.4 px
            const depthDim = 1 - depthBucket * 0.08; // 1.0 .. 0.68
            // Per-liekki tuulivaste: pienempi kuin päärungolla mutta orgaaninen
            const windResp = lerp(2, 6, sizeBoost); // pienemmät reagoivat herkemmin
            const baseOpacity = lerp(0.6, 0.9, ferocity) * (1 - yT * 0.2) * depthDim;
            items.push(
              <div
                key={`edge-lick-${i}`}
                className="absolute left-1/2"
                style={{
                  bottom,
                  width: lickW,
                  height: lickH,
                  // Tuulivaste suoraan transformiin → joka ainoa pieni liekki
                  // taipuu kun käyttäjä siirtää sormea / kallistaa puhelinta
                  transform: `translateX(calc(-50% + ${xPx.toFixed(1)}px + var(--ssf-wind-x, 0) * ${windResp.toFixed(1)}px)) translateY(calc(var(--ssf-wind-y, 0) * ${(-windResp * 0.6).toFixed(1)}px)) rotate(calc(${tiltDeg.toFixed(1)}deg + var(--ssf-wind-x, 0) * ${(side * 4).toFixed(1)}deg))`,
                  transformOrigin: "center bottom",
                  zIndex: 3 - Math.floor(depthBucket / 2),
                  pointerEvents: "none",
                  mixBlendMode: "screen",
                  opacity: baseOpacity,
                  filter: depthBlur > 0 ? `blur(${depthBlur.toFixed(2)}px) saturate(${depthDim.toFixed(2)})` : undefined,
                  // Containment → composite layer eristyy → ei aiheuta layoutia
                  contain: "layout paint" as React.CSSProperties["contain"],
                  willChange: "transform, opacity",
                }}
                aria-hidden
              >
                <svg
                  width={lickW}
                  height={lickH}
                  viewBox="0 0 100 140"
                  preserveAspectRatio="none"
                  style={{
                    filter: useFilter ? `url(#${fId})` : undefined,
                    animation: `stylized-flame-flicker-${(i % 3) + 1} ${flickDur.toFixed(2)}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                    animationDelay: `${delay.toFixed(2)}s`,
                    transformOrigin: "center bottom",
                    overflow: "visible",
                  }}
                >
                  <path d={FLAME_PATHS[pathIdx]} fill={`url(#${gradId})`} />
                  <path
                    d={FLAME_PATHS[pathIdx]}
                    fill="none"
                    stroke="hsl(6 98% 14%)"
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                </svg>
              </div>
            );
          }
          return items;
        })()}

        {/* ─── MEDIUM EDGE LICKS — 20× tiheämpi: 1000/680/440 keskikokoista liekkiä.
             Suurempia kuin pienet edge licks, sijoitetaan hieman kauemmas siluetista
             ja jakautuvat laajemmalle korkeusalueelle → tuovat täyteyttä, leveyttä
             ja syvyyttä. Vain joka 8. saa turbulence-filtterin → 8× kevyempi. */}
        {(() => {
          const COUNT = perfClass === "high" ? 1000 : perfClass === "mid" ? 680 : 440;
          const items: JSX.Element[] = [];
          for (let i = 0; i < COUNT; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const idxOnSide = Math.floor(i / 2);
            const perSide = Math.ceil(COUNT / 2);
            const yT = (idxOnSide + 0.5) / perSide; // 0..1
            // Reuna kaartuu sisäänpäin ylös, mutta lievemmin kuin small licks
            const edgeCurve = 1 - Math.pow(yT, 1.5) * 0.6;
            const yJitter = (((i * 41 + seed.a * 9) % 100) / 100 - 0.5) * 0.08;
            const xJitter = (((i * 53 + seed.b * 13) % 100) / 100 - 0.5) * bedWidth * 0.05;
            // Massiivinen tiheys vaatii laajemman x-skaalan jotta liekit eivät
            // pinoudu samalle viivalle — käytetään xLane-vaihtelua sisäänpäin/ulospäin
            const lane = ((i * 19 + seed.b * 3) % 5) / 5; // 0..1, lane within 0.16..0.30 band
            const xRadius = lerp(0.16, 0.30, lane);
            const xPx = side * (bedWidth * xRadius * edgeCurve + bedWidth * 0.012) + xJitter;
            const bottom = size * (0.03 + (yT + yJitter) * 0.62);
            const tiltDeg = side * (10 + yT * 26);
            // Laaja kokoskaala — pienistä keskikokoisiin → uniformiton massa
            const sizeBoost = ((i * 17 + seed.c * 7) % 13) / 13;
            const lickW = Math.max(8, bedWidth * lerp(0.06, 0.18, sizeBoost));
            const lickH = Math.max(18, tallestH * lerp(0.16, 0.42, sizeBoost) * (1 - yT * 0.25));
            // OMA RYTMI per liekki — kolme deterministista pseudosatunnaista lukua → ainutlaatuinen kesto, viive ja keyframe-variantti
            const r1 = ((i * 73 + seed.a * 17 + seed.b * 3) % 1000) / 1000; // 0..1
            const r2 = ((i * 109 + seed.b * 23 + seed.c * 5) % 1000) / 1000;
            const r3 = ((i * 157 + seed.c * 29 + seed.a * 7) % 1000) / 1000;
            // Kesto vaihtelee 0.85s..2.4s — leveä jakauma → ei syntyisi yhteistä rytmiä
            const flickDur = lerp(0.85, 2.4, r1);
            // Viive negatiivinen ja täysi kesto → eri vaiheet
            const delay = -(r2 * flickDur);
            // Kolme keyframe-varianttia (1/2/3) deterministisesti per liekki
            const variant = Math.floor(r3 * 3) + 1; // 1..3
            // Easing-variaatio: vuorottelee jotta liike ei tunnu mekaaniselta
            const easings = [
              "cubic-bezier(0.4, 0, 0.6, 1)",
              "cubic-bezier(0.5, 0.1, 0.5, 0.9)",
              "cubic-bezier(0.65, 0, 0.35, 1)",
              "ease-in-out",
            ];
            const easing = easings[(i + Math.floor(r1 * 4)) % easings.length];
            // OPTIMOINTI: vain joka 8. saa kalliin turbulence-filtterin
            const useFilter = i % 8 === 0;
            const fId = filterIds[i % 2 === 0 ? 1 : 2];
            const gradId = `ssf-grad-${uid}-${i % Math.max(1, layers.length)}`;
            const pathIdx = (i * 5 + 3) % FLAME_PATHS.length;
            // SYVYYS-PARALLAX: kauempana keskuksesta → blur + dim → ilmaperspektiivi
            const depthBucket = (i * 11) % 6; // 0..5
            const depthBlur = depthBucket * 0.3; // 0..1.5 px
            const depthDim = 1 - depthBucket * 0.07; // 1.0 .. 0.65
            // Per-liekki tuulivaste — keskikokoiset reagoivat kohtuullisesti
            const windResp = lerp(3, 8, sizeBoost);
            const baseOpacity = lerp(0.55, 0.85, ferocity) * (1 - yT * 0.18) * depthDim;
            items.push(
              <div
                key={`med-edge-lick-${i}`}
                className="absolute left-1/2"
                style={{
                  bottom,
                  width: lickW,
                  height: lickH,
                  transform: `translateX(calc(-50% + ${xPx.toFixed(1)}px + var(--ssf-wind-x, 0) * ${windResp.toFixed(1)}px)) translateY(calc(var(--ssf-wind-y, 0) * ${(-windResp * 0.5).toFixed(1)}px)) rotate(calc(${tiltDeg.toFixed(1)}deg + var(--ssf-wind-x, 0) * ${(side * 5).toFixed(1)}deg))`,
                  transformOrigin: "center bottom",
                  zIndex: 2 - Math.floor(depthBucket / 3), // 2 (etu) → 1 (taka) → 0 (kauimmainen)
                  pointerEvents: "none",
                  mixBlendMode: "screen",
                  opacity: baseOpacity,
                  filter: depthBlur > 0 ? `blur(${depthBlur.toFixed(2)}px) saturate(${depthDim.toFixed(2)})` : undefined,
                  contain: "layout paint" as React.CSSProperties["contain"],
                  willChange: "transform, opacity",
                }}
                aria-hidden
              >
                <svg
                  width={lickW}
                  height={lickH}
                  viewBox="0 0 100 140"
                  preserveAspectRatio="none"
                  style={{
                    filter: useFilter ? `url(#${fId})` : undefined,
                    animation: `stylized-flame-flicker-${variant} ${flickDur.toFixed(2)}s ${easing} infinite`,
                    animationDelay: `${delay.toFixed(2)}s`,
                    transformOrigin: "center bottom",
                    overflow: "visible",
                  }}
                >
                  <path d={FLAME_PATHS[pathIdx]} fill={`url(#${gradId})`} />
                  <path
                    d={FLAME_PATHS[pathIdx]}
                    fill="none"
                    stroke="hsl(6 98% 14%)"
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.75}
                  />
                </svg>
              </div>
            );
          }
          return items;
        })()}

        {/* ─── BACK-ROW SIDE FLAME LICKS — depth layer behind main flames ───
            Slower, larger, dimmer tongues sitting BEHIND the central body so the
            fire reads as a 3D volume with flames wrapping around the back rather
            than a flat silhouette. Cooler hue (back-row filter), heavier blur. */}
        {(() => {
          // 2 per side at low ferocity, up to 4 per side at high ferocity
          const perSideBack = Math.max(2, Math.round(lerp(2, 4, ferocity)));
          const sides: Array<"l" | "r"> = ["l", "r"];
          return sides.flatMap((side) =>
            Array.from({ length: perSideBack }).map((_, i) => {
              const sideKey = `back-${side}${i}`;
              // Wider & taller than front side licks — they form the silhouette halo
              const sw = bedWidth * lerp(0.10, 0.16, (i % 3) / 2);
              const sh = tallestH * lerp(0.55, 0.8, ferocity) * lerp(0.95, 1.15, (i % 3) / 2);
              // Anchor low — close to flame base
              const vBottom = size * lerp(0.03, 0.10, (i * 0.37 + (side === "l" ? 0.1 : 0.3)) % 1);
              // TIGHTER: hug the body edge instead of peeking far out
              const hOffset = bedWidth * lerp(0.06, 0.14, (i % 3) / 2) * (side === "l" ? -1 : 1);
              // Slower cadence — back layers breathe at a calmer rhythm
              const dur = lerp(4.2, 3.0, ferocity) + (i * 0.53);
              const phaseOffset = side === "l" ? dur * 0.25 : dur * 0.75;
              const delay = -(((i * 0.97 + seed.b * 0.017) % dur) + phaseOffset) % dur;
              const filterId = filterIds[0]; // back filter — softer warp, deeper bloom
              const gradId = `ssf-grad-${uid}-${i % Math.max(1, layers.length)}`;
              const pathIdx = (i * 7 + 3) % FLAME_PATHS.length;
              return (
                <svg
                  key={sideKey}
                  width={sw}
                  height={sh}
                  viewBox="0 0 100 140"
                  preserveAspectRatio="none"
                  className="absolute"
                  style={{
                    left: `calc(50% + ${hOffset.toFixed(1)}px)`,
                    bottom: vBottom,
                    transformOrigin: side === "l" ? "right bottom" : "left bottom",
                    // Extra blur + slight desaturation for atmospheric distance
                    filter: `url(#${filterId}) blur(0.8px) saturate(0.92) brightness(0.88)`,
                    animation: `stylized-flame-side-${side} ${dur.toFixed(2)}s cubic-bezier(0.36, 0.04, 0.44, 1) infinite`,
                    animationDelay: `${delay.toFixed(2)}s`,
                    mixBlendMode: "screen",
                    zIndex: 1, // BEHIND main flames (mid=2, front=3)
                    opacity: lerp(0.42, 0.62, ferocity),
                    willChange: "transform, opacity",
                  }}
                >
                  <path d={FLAME_PATHS[pathIdx]} fill={`url(#${gradId})`} />
                  <path d={FLAME_PATHS[pathIdx]} fill="none" stroke="hsl(10 95% 24%)" strokeWidth={1.4} strokeLinejoin="round" opacity={0.55} />
                </svg>
              );
            })
          );
        })()}

        {/* ─── SIDE FLAME LICKS — gentle lateral tongues that lean outward ───
            Restrained: small lean, mostly upward growth, soft fade. Real flames
            "breathing" sideways rather than horizontal jets. */}
        {(() => {
          // 1 per side at low ferocity, up to 2 per side at high ferocity
          const perSide = Math.max(1, Math.round(lerp(1, 2, ferocity)));
          const sides: Array<"l" | "r"> = ["l", "r"];
          return sides.flatMap((side) =>
            Array.from({ length: perSide }).map((_, i) => {
              const sideKey = `${side}${i}`;
              // Smaller, slimmer tongues — closer to a real flame lick scale
              const sw = bedWidth * lerp(0.07, 0.11, (i % 2));
              const sh = tallestH * lerp(0.45, 0.65, ferocity) * lerp(0.9, 1.05, (i % 2));
              // Anchor low on fire body where wind catches naturally
              const vBottom = size * lerp(0.05, 0.12, (i * 0.5 + (side === "l" ? 0 : 0.25)) % 1);
              // Sit closer to the body so they read as part of the fire, not detached
              const hOffset = bedWidth * 0.22 * (side === "l" ? -1 : 1);
              // Slower, calmer cadence — gentle breaths rather than rapid bursts
              const dur = lerp(3.4, 2.4, ferocity) + (i * 0.41);
              const phaseOffset = side === "l" ? 0 : dur * 0.5;
              const delay = -(((i * 0.83 + seed.a * 0.013) % dur) + phaseOffset) % dur;
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
                    filter: `url(#${filterId}) saturate(1.04)`,
                    animation: `stylized-flame-side-${side} ${dur.toFixed(2)}s cubic-bezier(0.34, 0.04, 0.4, 1) infinite`,
                    animationDelay: `${delay.toFixed(2)}s`,
                    mixBlendMode: "screen",
                    zIndex: 3,
                    opacity: lerp(0.55, 0.85, ferocity),
                    willChange: "transform, opacity",
                  }}
                >
                  <path d={FLAME_PATHS[pathIdx]} fill={`url(#${gradId})`} />
                  <path d={FLAME_PATHS[pathIdx]} fill="none" stroke="hsl(12 95% 26%)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" opacity={0.78} />
                </svg>
              );
            })
          );
        })()}

        {/* ─── WILD TONGUES — rogue licks shooting up randomly (front emits) ─── */}
        {stage >= 2 && Array.from({ length: Math.min(3, Math.round(lerp(1, 3, ferocityFront))) }).map((_, i) => {
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
              <path d={FLAME_PATHS[4]} fill="none" stroke="hsl(14 95% 26%)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" opacity={0.82} />
            </svg>
          );
        })}

        {/* ─── MICRO FLAMES — small, fast-dancing tongues that fill gaps & add depth ───
            These ride between the main flame layers (back of front-row, front of mid-row)
            adding the small "tongue clusters" you see in real bonfires around bigger flames. */}
        {Array.from({ length: Math.min(4, Math.round(lerp(2, 4, ferocity))) }).map((_, i) => {
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
              <path d={FLAME_PATHS[pathIdx]} fill="none" stroke="hsl(10 95% 22%)" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
            </svg>
          );
        })}

        {/* ─── FRONT MICRO FLAMES — small dancing tongues in FRONT of main body ───
            Adds 3D parallax: tiny flames flicker in front of the hero flame,
            making the fire feel volumetric. Brighter accent layer. */}
        {Array.from({ length: Math.min(5, Math.round(lerp(2, 5, ferocity))) }).map((_, i) => {
          // Tighter cluster around the centre — they hug the hero flame
          const microW = bedWidth * lerp(0.04, 0.085, (i % 3) / 2);
          const microH = tallestH * lerp(0.18, 0.38, (i % 4) / 3);
          // Parabolic centre-bias so they cluster around the hero
          const t01 = ((i * 41 + seed.c * 9) % 100) / 100;
          const centred = (t01 - 0.5) * 0.95;
          const xPx = bedWidth * 0.6 * centred;
          const bottom = size * lerp(0.05, 0.15, (i % 4) / 3);
          // Slower & calmer than back micro-flames so they don't add visual noise
          const dur = lerp(1.7, 1.1, ferocity) + (i % 3) * 0.15;
          const delay = -((i * 0.31 + seed.a * 0.011) % dur);
          const hueRot = ((i * 13) % 6) - 2;
          const filterId = filterIds[2]; // sharpest filter — front detail
          const pathIdx = (i * 7 + 4) % FLAME_PATHS.length;
          const gradId = `ssf-grad-${uid}-${(i + 1) % Math.max(1, layers.length)}`;
          return (
            <svg
              key={`front-micro-${i}`}
              width={microW}
              height={microH}
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
              className="absolute left-1/2"
              style={{
                bottom,
                transform: `translateX(calc(-50% + ${xPx.toFixed(1)}px))`,
                // Brighter: stronger saturation + brightness boost for hot accent
                filter: `url(#${filterId}) hue-rotate(${hueRot}deg) saturate(1.18) brightness(1.18)`,
                animation: `stylized-flame-flicker-${(i % 3) + 1} ${dur.toFixed(2)}s cubic-bezier(0.4, 0, 0.6, 1) infinite, stylized-flame-sway-${((i + 1) % 3) + 1} ${(dur * 1.7).toFixed(2)}s ease-in-out infinite`,
                animationDelay: `${delay.toFixed(2)}s, ${(delay * 0.6).toFixed(2)}s`,
                mixBlendMode: "screen",
                // Kirkkaammat — selvästi näkyvät mutta eivät peitä pääliekkiä
                opacity: lerp(0.7, 0.95, ferocity),
                zIndex: 4, // FRONT of main flames (front row = 3)
                transformOrigin: "center bottom",
                willChange: "transform, opacity",
              }}
            >
              <path d={FLAME_PATHS[pathIdx]} fill={`url(#${gradId})`} />
              <path d={FLAME_PATHS[pathIdx]} fill="none" stroke="hsl(14 95% 24%)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
            </svg>
          );
        })}

        {/* ─── FRONT-ROW SHARP EMBERS with TRAILS — bright, fast, lingering ─── */}
        {stage >= 3 && Array.from({ length: Math.min(6, Math.round(lerp(2, 6, ferocityFront))) }).map((_, i) => {
          const xPos = ((i * 53 + seed.c * 11) % 100) / 100;
          const xPx = (bedWidth * 0.9) * (xPos - 0.5);
          const drift = ((i % 2 === 0 ? 1 : -1) * (4 + (i * 3) % 14)) * lerp(0.7, 1.4, ferocity);
          const dur = lerp(2.2, 1.3, ferocity) + ((i * 0.21) % 1.0);
          const delay = -((i * 0.27 + seed.a * 0.011) % dur);
          const sparkSize = lerp(1.6, 3.0, (i % 3) / 2) * lerp(0.85, 1.25, ferocity);
          const color = i % 4 === 0 ? "hsl(28 100% 56%)" : i % 3 === 0 ? "hsl(16 100% 50%)" : "hsl(6 95% 44%)";
          const riseDist = lerp(110, 170, ferocity); // %
          // Trail = stacked box-shadows behind the spark (tail effect)
          const trailLen = Math.max(2, Math.round(lerp(2, 6, ferocity)));
          const trail = Array.from({ length: trailLen })
            .map((_, k) => {
              const off = (k + 1) * (sparkSize * 0.9);
              const a = (1 - (k + 1) / (trailLen + 1)) * 0.7;
              return `0 ${off.toFixed(1)}px ${(sparkSize * 1.6).toFixed(1)}px hsl(18 100% 54% / ${a.toFixed(2)})`;
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

        {/* ─── MICRO-EMBERS — sub-pixel kipinämeri liekin pään yläpuolella
            (1–2px nopeasti syttyviä ja sammuvia välähdyksiä — antaa "kipinämeren" tunnun). */}
        {stage >= 2 && perfClass !== "low" && Array.from({ length: perfClass === "high" ? 6 : 4 }).map((_, i) => {
          const xPos = ((i * 67 + seed.b * 19) % 100) / 100;
          const xPx = (bedWidth * 0.7) * (xPos - 0.5);
          const startBottom = tallestH * lerp(0.45, 0.7, (i % 4) / 3);
          const dur = lerp(1.2, 0.7, ferocity) + ((i * 0.13) % 0.6);
          const delay = -((i * 0.19 + seed.a * 0.013) % dur);
          const dotSize = 1 + ((i % 3) * 0.5); // 1.0 / 1.5 / 2.0 px
          const drift = ((i % 2 === 0 ? 1 : -1) * (3 + (i * 2) % 8));
          const color = i % 3 === 0 ? "hsl(30 100% 58%)" : i % 2 === 0 ? "hsl(20 100% 52%)" : "hsl(10 95% 46%)";
          return (
            <span
              key={`micro-ember-${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: dotSize,
                height: dotSize,
                left: `calc(50% + ${xPx.toFixed(1)}px)`,
                bottom: startBottom,
                background: color,
                boxShadow: `0 0 ${(dotSize * 3).toFixed(1)}px ${color}`,
                ["--spark-drift" as string]: `${drift}px`,
                ["--spark-rise" as string]: `-${lerp(50, 95, ferocity).toFixed(0)}%`,
                animation: `stylized-spark-rise ${dur.toFixed(2)}s ease-out infinite`,
                animationDelay: `${delay.toFixed(2)}s`,
                mixBlendMode: "screen",
                zIndex: 5,
                opacity: lerp(0.7, 1, ferocity),
              }}
            />
          );
        })}

        {/* ─── BACK-ROW SOFT SMOKY WISPS — slow, large, fading puffs ─── */}
        {stage >= 2 && Array.from({ length: Math.min(3, Math.round(lerp(1, 3, ferocity))) }).map((_, i) => {
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
        {/* ─── CHROMATIC HEAT ABERRATION — yksi punertava + yksi keltainen
             "haamukopio" hero-liekistä, hieman siirrettynä → kuumuus rikkoo värin
             kanavat reunoista. Tämä on se efekti joka erottaa CGI-tulen halvasta. */}
        {stage >= 3 && perfClass !== "low" && (() => {
          const heroPath = FLAME_PATHS[4];
          const heroH = tallestH * 1.05;
          const heroW = heroH * (100 / 140);
          return (
            <>
              {/* Punainen kanava liu'utettu ylös-vasemmalle */}
              <svg
                width={heroW}
                height={heroH}
                viewBox="0 0 100 140"
                preserveAspectRatio="none"
                className="absolute left-1/2"
                style={{
                  bottom: 0,
                  transform: "translateX(calc(-50% - 1.4px)) translateY(-1.2px)",
                  filter: `url(#${filterIds[2]})`,
                  mixBlendMode: "screen",
                  opacity: lerp(0.18, 0.32, ferocity),
                  zIndex: 4,
                  willChange: "transform",
                  pointerEvents: "none",
                }}
                aria-hidden
              >
                <path d={heroPath} fill="hsl(2 100% 48% / 0.55)" />
              </svg>
              {/* Keltainen kanava liu'utettu alas-oikealle */}
              <svg
                width={heroW}
                height={heroH}
                viewBox="0 0 100 140"
                preserveAspectRatio="none"
                className="absolute left-1/2"
                style={{
                  bottom: 0,
                  transform: "translateX(calc(-50% + 1.4px)) translateY(0.8px)",
                  filter: `url(#${filterIds[2]})`,
                  mixBlendMode: "screen",
                  opacity: lerp(0.16, 0.28, ferocity),
                  zIndex: 4,
                  willChange: "transform",
                  pointerEvents: "none",
                }}
                aria-hidden
              >
                <path d={heroPath} fill="hsl(28 100% 52% / 0.5)" />
              </svg>
            </>
          );
        })()}

        {/* ─── REACTIVE INNER HEART — kylläinen ydin joka pulsoi --ssf-proximity
             ja --ssf-blast-arvojen mukaan. Sormea tuotaessa lähelle: liekki
             "hengittää" kirkkaammin — tämä on hienovarainen mutta tuntuu elävältä. */}
        {stage >= 2 && (
          <span
            className="absolute left-1/2 pointer-events-none rounded-full"
            style={{
              width: bedWidth * 0.55,
              height: tallestH * 0.55,
              bottom: size * 0.12,
              transform: `translateX(-50%) scale(calc(1 + var(--ssf-proximity, 0) * 0.08 + var(--ssf-blast, 0) * 0.18))`,
              background: `radial-gradient(ellipse at 50% 70%, hsl(26 100% 56% / 0.55) 0%, hsl(14 100% 46% / 0.32) 32%, hsl(4 95% 36% / 0.14) 60%, transparent 85%)`,
              filter: `blur(${Math.max(4, size * 0.05)}px)`,
              mixBlendMode: "screen",
              opacity: `calc(${lerp(0.45, 0.85, ferocity).toFixed(2)} + var(--ssf-proximity, 0) * 0.35 + var(--ssf-blast, 0) * 0.6)` as unknown as number,
              transformOrigin: "center bottom",
              transition: "opacity 0.18s ease-out, transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1)",
              zIndex: 4,
              animation: `stylized-heart-pulse ${(2.4).toFixed(2)}s ease-in-out infinite`,
            }}
          />
        )}

        {/* ─── HEAT SHIMMER FLOOR — maasta nouseva conic-gradient lämpövärähtely
             (subtle, melkein huomaamaton — antaa "kuuma maa" -tunteen). */}
        {stage >= 4 && perfClass === "high" && (
          <span
            className="absolute left-1/2 pointer-events-none"
            style={{
              width: bedWidth * 1.4,
              height: tallestH * 0.4,
              bottom: size * 0.04,
              transform: "translateX(-50%)",
              background: `conic-gradient(from 0deg at 50% 100%, transparent 0deg, hsl(14 100% 50% / 0.06) 30deg, transparent 60deg, hsl(6 95% 44% / 0.05) 90deg, transparent 120deg, hsl(20 100% 52% / 0.05) 180deg, transparent 220deg, hsl(10 95% 46% / 0.06) 280deg, transparent 320deg)`,
              filter: `blur(${Math.max(8, size * 0.1)}px)`,
              mixBlendMode: "screen",
              animation: `stylized-heat-shimmer 7s linear infinite`,
              zIndex: 0,
              opacity: lerp(0.55, 0.95, ferocity),
            }}
          />
        )}
      </div>

      {/* ─── VOLUMETRIC BACK-LIGHT BLOOM — liekki valaisee taustaa TAKAA;
           pehmeä radiaali heittovalo joka istuu liekin TAKANA, antaa "tuli on
           huoneessa" -syvyyden. Eri kuin "ulkohehku-rengas" — tämä on aidosti
           takavalo joka näkyy reunaan saakka. */}
      {stage >= 3 && (
        <span
          className="absolute left-1/2 pointer-events-none"
          style={{
            width: size * 1.55,
            height: size * 1.4,
            bottom: -size * 0.05,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 65%, hsl(14 100% 46% / ${lerp(0.18, 0.32, ferocity).toFixed(2)}) 0%, hsl(6 95% 38% / ${lerp(0.10, 0.18, ferocity).toFixed(2)}) 22%, hsl(0 88% 28% / ${lerp(0.06, 0.10, ferocity).toFixed(2)}) 42%, transparent 70%)`,
            filter: `blur(${Math.max(14, size * 0.18)}px)`,
            mixBlendMode: "screen",
            zIndex: -1,
            opacity: `calc(${lerp(0.6, 1, ferocity).toFixed(2)} + var(--ssf-proximity, 0) * 0.2 + var(--ssf-blast, 0) * 0.3 - var(--ssf-idle, 0) * 0.15)`,
            transition: "opacity 0.25s ease-out",
          }}
        />
      )}

      {/* ─── Stage-up bed flash ─── */}
      {burst && (
        <span
          className="absolute left-1/2 rounded-full pointer-events-none"
          style={{
            width: bedWidth * 1.3,
            height: Math.max(6, size * 0.06),
            bottom: size * 0.02,
            transform: "translateX(-50%)",
            background: `radial-gradient(ellipse at 50% 50%, hsl(28 100% 58%) 0%, hsl(14 100% 48%) 35%, transparent 75%)`,
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
