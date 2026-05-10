import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  fadeDir: number;
  hue: number;
  lightness: number;
  /** Pre-built "hsla(h,90%,l%," prefix — avoids string interpolation per draw call. */
  fillPrefix: string;
}

/**
 * GPU-friendly ambient particle field.
 * - Caps DPR at 1.25 (huge perf win on retina)
 * - Adapts particle count to viewport area + device memory
 * - Single fill per particle (no costly multi-arc bloom)
 * - Pauses when tab/window hidden
 * - Skips entirely on devices that prefer reduced motion
 */
const AmbientParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>(0);
  const running = useRef(true);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    // Skip entirely on tiny / very low-memory devices (e.g. old phones) — saves real frames.
    const mem = (navigator as any).deviceMemory || 4;
    if (window.innerWidth < 360 || mem <= 1) return;
    // Save-Data / very slow connection: skip the ambient field entirely.
    const conn = (navigator as any).connection;
    if (conn?.saveData || conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return;

    // Mobile/touch devices get a much lighter field — Safari iOS canvas fill is expensive.
    const isMobile = window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;
    // Low-end desktop (≤4 logical cores or ≤2GB) gets the same lighter treatment.
    const cores = (navigator as any).hardwareConcurrency || 8;
    const isLowEnd = cores <= 4 || mem <= 2;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Cap DPR aggressively even on desktop — particles are ambient, no one notices.
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 0.85 : 1);
    let w = 0;
    let h = 0;

    const computeCount = () => {
      const area = window.innerWidth * window.innerHeight;
      // Lighter field — fewer particles, lower fill cost across the board.
      const base = Math.min(
        isMobile ? 14 : 22,
        Math.max(8, Math.round(area / (isMobile ? 65000 : 48000))),
      );
      return isLowEnd ? Math.round(base * 0.55) : base;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = computeCount();
      if (particles.current.length !== target) {
        particles.current = Array.from({ length: target }, () => createParticle(w, h));
      }
    };
    resize();

    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Pause when the browser tab is hidden.
    const onVisibility = () => {
      running.current = canvasVisible && !document.hidden;
      if (running.current) raf.current = requestAnimationFrame(animate);
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Also pause when the canvas itself is scrolled/hidden out of the viewport
    // (important for TabHost which keeps all tabs mounted but sets them hidden).
    let canvasVisible = true;
    const io = new IntersectionObserver(
      (entries) => {
        canvasVisible = entries[0]?.isIntersecting ?? true;
        running.current = canvasVisible && !document.hidden;
        if (running.current) raf.current = requestAnimationFrame(animate);
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    // Throttle frame rate — 18fps mobile / low-end, 24fps desktop. Ambient drift doesn't need more.
    const FRAME_MS = 1000 / (isMobile || isLowEnd ? 18 : 24);
    let last = 0;
    // Pause RAF entirely while the user is actively scrolling — canvas redraws
    // contend with scroll for the GPU, which the user perceives as jank. We
    // resume ~150 ms after the last scroll event (scroll-end heuristic).
    let isScrolling = false;
    let scrollEndTimer = 0;
    const onScroll = () => {
      isScrolling = true;
      window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(() => {
        isScrolling = false;
        // Restart RAF if we paused mid-scroll
        if (running.current) raf.current = requestAnimationFrame(animate);
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    const animate = (now: number) => {
      if (!running.current) return;
      // Skip the frame budget AND skip queueing the next frame while scrolling.
      // The scroll-end timer above will re-queue when the user stops.
      if (isScrolling) return;
      raf.current = requestAnimationFrame(animate);
      if (now - last < FRAME_MS) return;
      last = now;

      ctx.clearRect(0, 0, w, h);

      const list = particles.current;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.y -= p.speedY;
        p.x += Math.sin(p.y * 0.006) * p.speedX;
        p.opacity += 0.005 * p.fadeDir;

        if (p.opacity >= 0.85) p.fadeDir = -1;
        if (p.opacity <= 0 || p.y < -10) {
          Object.assign(p, createParticle(w, h, true));
        }

        // Single fill — bloom dropped (was costing ~2x fill rate per particle).
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        // fillPrefix is pre-built at particle creation — avoids 4-token interpolation per frame.
        ctx.fillStyle = p.fillPrefix + p.opacity.toFixed(2) + ")";
        ctx.fill();
      }
    };

    raf.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, { capture: true } as any);
      window.clearTimeout(scrollEndTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.95, willChange: "transform", mixBlendMode: "screen", contain: "strict", transform: "translateZ(0)" }}
      aria-hidden
    />
  );
};

function createParticle(w: number, h: number, fromBottom = false): Particle {
  const type = Math.random();
  let hue: number, lightness: number;
  if (type < 0.65) {
    hue = 36 + Math.random() * 14;
    lightness = 52 + Math.random() * 16;
  } else if (type < 0.85) {
    hue = 28 + Math.random() * 10;
    lightness = 54 + Math.random() * 14;
  } else if (type < 0.94) {
    hue = 265 + Math.random() * 15;
    lightness = 58 + Math.random() * 12;
  } else {
    hue = 168 + Math.random() * 10;
    lightness = 48 + Math.random() * 14;
  }

  return {
    x: Math.random() * w,
    y: fromBottom ? h + 10 : Math.random() * h,
    size: 0.9 + Math.random() * 2.4,
    speedY: 0.12 + Math.random() * 0.5,
    speedX: 0.18 + Math.random() * 0.55,
    opacity: Math.random() * 0.35,
    fadeDir: 1,
    hue,
    lightness,
    // Pre-build static portion of fillStyle — only opacity varies per frame.
    fillPrefix: `hsla(${hue},90%,${Math.min(lightness + 6, 80)}%,`,
  };
}

export default AmbientParticles;
