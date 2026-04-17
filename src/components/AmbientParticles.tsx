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

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let w = 0;
    let h = 0;

    const computeCount = () => {
      const area = window.innerWidth * window.innerHeight;
      const mem = (navigator as any).deviceMemory || 4;
      // Base ~ 1 particle per 24k px², clamped, scaled down for low-mem devices.
      const base = Math.min(40, Math.max(14, Math.round(area / 24000)));
      return mem <= 2 ? Math.round(base * 0.5) : base;
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

    const animate = () => {
      if (!running.current) return;
      ctx.clearRect(0, 0, w, h);

      const list = particles.current;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.y -= p.speedY;
        p.x += Math.sin(p.y * 0.006) * p.speedX;
        p.opacity += 0.004 * p.fadeDir;

        if (p.opacity >= 0.6) p.fadeDir = -1;
        if (p.opacity <= 0 || p.y < -10) {
          Object.assign(p, createParticle(w, h, true));
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},80%,${p.lightness}%,${p.opacity})`;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(animate);
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
      style={{ opacity: 0.7, willChange: "transform" }}
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
    size: 0.6 + Math.random() * 1.8,
    speedY: 0.1 + Math.random() * 0.4,
    speedX: 0.15 + Math.random() * 0.45,
    opacity: Math.random() * 0.25,
    fadeDir: 1,
    hue,
    lightness,
  };
}

export default AmbientParticles;
