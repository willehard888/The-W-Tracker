import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 35;

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  fadeDir: number;
  hue: number;
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

    // Init particles
    particles.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(canvas.width, canvas.height));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles.current) {
        p.y -= p.speedY;
        p.x += Math.sin(p.y * 0.008) * p.speedX;
        p.opacity += 0.003 * p.fadeDir;

        if (p.opacity >= 0.6) p.fadeDir = -1;
        if (p.opacity <= 0 || p.y < -10) {
          Object.assign(p, createParticle(canvas.width, canvas.height, true));
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        // Gold to warm amber range
        ctx.fillStyle = `hsla(${p.hue}, 78%, 54%, ${p.opacity})`;
        ctx.fill();

        // Subtle glow
        if (p.size > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 78%, 54%, ${p.opacity * 0.15})`;
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
      style={{ opacity: 0.7 }}
    />
  );
};

function createParticle(w: number, h: number, fromBottom = false): Particle {
  return {
    x: Math.random() * w,
    y: fromBottom ? h + 10 : Math.random() * h,
    size: 0.8 + Math.random() * 2,
    speedY: 0.15 + Math.random() * 0.4,
    speedX: 0.3 + Math.random() * 0.5,
    opacity: Math.random() * 0.3,
    fadeDir: 1,
    hue: 36 + Math.random() * 12, // gold range
  };
}

export default AmbientParticles;
