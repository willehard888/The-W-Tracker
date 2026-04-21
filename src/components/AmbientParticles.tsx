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

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1);
    let w = 0;
    let h = 0;

    const computeCount = () => {
      const area = window.innerWidth * window.innerHeight;
      // Denser field for a more cinematic, visible ambient glow.
      const base = Math.min(44, Math.max(18, Math.round(area / 22000)));
      return mem <= 2 ? Math.round(base * 0.55) : base;
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

    const onVisibility = () => {
      running.current = !document.hidden;
      if (running.current) {
        raf.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Throttle to ~30 fps — visually identical for ambient drift, halves the GPU cost.
    const FRAME_MS = 1000 / 30;
    let last = 0;
    const animate = (now: number) => {
      if (!running.current) return;
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

        // Soft bloom halo for a more cinematic feel (single extra fill).
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},85%,${p.lightness}%,${p.opacity * 0.18})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},90%,${Math.min(p.lightness + 6, 80)}%,${p.opacity})`;
        ctx.fill();
      }
    };

    raf.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.95, willChange: "transform", mixBlendMode: "screen" }}
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
  };
}

export default AmbientParticles;
