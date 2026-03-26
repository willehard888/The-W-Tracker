import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 55;

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

const AmbientParticles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    particles.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(canvas.width, canvas.height));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles.current) {
        p.y -= p.speedY;
        p.x += Math.sin(p.y * 0.006) * p.speedX;
        p.opacity += 0.004 * p.fadeDir;

        if (p.opacity >= 0.7) p.fadeDir = -1;
        if (p.opacity <= 0 || p.y < -10) {
          Object.assign(p, createParticle(canvas.width, canvas.height, true));
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, ${p.lightness}%, ${p.opacity})`;
        ctx.fill();

        // Outer glow — bigger and brighter
        if (p.size > 1.2) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, ${p.lightness}%, ${p.opacity * 0.18})`;
          ctx.fill();
        }

        // Extra bloom for large particles
        if (p.size > 2.2) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 7, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 70%, ${p.lightness + 10}%, ${p.opacity * 0.06})`;
          ctx.fill();
        }
      }

      raf.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  );
};

function createParticle(w: number, h: number, fromBottom = false): Particle {
  const type = Math.random();
  // Mix of gold, amber, and occasional purple/teal
  let hue: number, lightness: number;
  if (type < 0.6) {
    hue = 36 + Math.random() * 14; // gold
    lightness = 52 + Math.random() * 16;
  } else if (type < 0.8) {
    hue = 28 + Math.random() * 10; // amber
    lightness = 54 + Math.random() * 14;
  } else if (type < 0.92) {
    hue = 265 + Math.random() * 15; // purple
    lightness = 58 + Math.random() * 12;
  } else {
    hue = 168 + Math.random() * 10; // teal
    lightness = 48 + Math.random() * 14;
  }

  return {
    x: Math.random() * w,
    y: fromBottom ? h + 10 : Math.random() * h,
    size: 0.6 + Math.random() * 2.8,
    speedY: 0.1 + Math.random() * 0.5,
    speedX: 0.2 + Math.random() * 0.6,
    opacity: Math.random() * 0.25,
    fadeDir: 1,
    hue,
    lightness,
  };
}

export default AmbientParticles;
