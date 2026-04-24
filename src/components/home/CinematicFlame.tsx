import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import flameImage from "@/assets/cinematic-flame.jpg";

interface CinematicFlameProps {
  className?: string;
  /** Height of the flame container in px. Defaults to 280. */
  height?: number;
}

/**
 * Ultra-realistic cinematic flame.
 *
 * Composition:
 *  • AI-generated photoreal flame still (deep blue base → orange body → white core)
 *  • Two stacked copies with `screen` blend, breathing scale + subtle sway
 *  • Heat-haze SVG displacement layer over the background
 *  • Rising ember particle field (DOM-based, GPU transforms only)
 *  • Volumetric ground-cast halo
 *  • Pointer parallax — flame leans toward the cursor / touch
 *
 * All motion is GPU-only (transform/opacity) and respects prefers-reduced-motion.
 */
const CinematicFlame = ({ className, height = 280 }: CinematicFlameProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Pointer parallax — flame leans toward pointer when it's near the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const handle = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width; // -0.5..0.5
        const dy = (e.clientY - cy) / rect.height;
        // Clamp so flame only reacts when pointer is reasonably close
        const nx = Math.max(-1, Math.min(1, dx * 2));
        const ny = Math.max(-1, Math.min(1, dy * 2));
        setTilt({ x: nx, y: ny });
      });
    };
    const reset = () => setTilt({ x: 0, y: 0 });
    window.addEventListener("pointermove", handle, { passive: true });
    window.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", handle);
      window.removeEventListener("pointerleave", reset);
    };
  }, []);

  // Pre-compute ember particle positions (stable across renders)
  const embers = useRef(
    Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      left: 35 + Math.random() * 30, // 35-65%
      delay: Math.random() * 4,
      duration: 3.2 + Math.random() * 2.8,
      size: 1.5 + Math.random() * 2.5,
      drift: (Math.random() - 0.5) * 60,
      hue: Math.random() > 0.7 ? 200 : 28 + Math.random() * 20,
    })),
  ).current;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden select-none",
        "bg-black",
        className,
      )}
      style={{ height }}
      aria-hidden
    >
      {/* SVG defs for heat-haze displacement */}
      <svg className="absolute inset-0 w-0 h-0" aria-hidden>
        <defs>
          <filter id="cinematic-heat-haze" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.028"
              numOctaves="2"
              seed="7"
            >
              <animate
                attributeName="baseFrequency"
                dur="9s"
                values="0.012 0.028;0.018 0.034;0.012 0.028"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="14" />
          </filter>
        </defs>
      </svg>

      {/* Deep ambient glow ground (volumetric ground cast) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: -height * 0.15,
          width: height * 1.6,
          height: height * 0.45,
          background:
            "radial-gradient(ellipse at center, hsl(28 95% 55% / 0.55) 0%, hsl(18 90% 45% / 0.25) 35%, transparent 70%)",
          filter: "blur(28px)",
          mixBlendMode: "screen",
          animation: "cinematic-ground-pulse 4.2s ease-in-out infinite",
        }}
      />

      {/* Background warm radial — fills the void around the flame */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 80% at 50% 75%, hsl(20 90% 50% / 0.18) 0%, hsl(265 60% 30% / 0.06) 45%, transparent 75%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Heat haze layer — distorts whatever is behind the flame */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 40% 70% at 50% 65%, hsl(28 90% 55% / 0.18), transparent 70%)",
          filter: "url(#cinematic-heat-haze)",
          mixBlendMode: "screen",
        }}
      />

      {/* PRIMARY flame image — slow breathing, pointer parallax */}
      <img
        src={flameImage}
        alt=""
        loading="eager"
        width={1024}
        height={1024}
        className="absolute left-1/2 bottom-0 pointer-events-none will-change-transform"
        style={{
          height: height * 1.1,
          width: "auto",
          transform: `translateX(calc(-50% + ${tilt.x * 6}px)) rotate(${tilt.x * 2.5}deg)`,
          transformOrigin: "50% 95%",
          transition: "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)",
          mixBlendMode: "screen",
          animation: "cinematic-flame-breathe 5.6s ease-in-out infinite",
          filter: "saturate(1.15) contrast(1.05)",
        }}
      />

      {/* SECONDARY flame copy — offset breath cycle, screen-blended for depth */}
      <img
        src={flameImage}
        alt=""
        loading="eager"
        width={1024}
        height={1024}
        className="absolute left-1/2 bottom-0 pointer-events-none will-change-transform opacity-70"
        style={{
          height: height * 1.05,
          width: "auto",
          transform: `translateX(calc(-50% + ${tilt.x * -4}px)) rotate(${tilt.x * -1.5}deg)`,
          transformOrigin: "50% 95%",
          transition: "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
          mixBlendMode: "screen",
          animation: "cinematic-flame-flicker 3.1s ease-in-out infinite",
          animationDelay: "-1.2s",
          filter: "blur(1.5px) saturate(1.3) hue-rotate(-6deg)",
        }}
      />

      {/* Bright core flicker overlay — adds white-hot pulse */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none rounded-full"
        style={{
          bottom: height * 0.18,
          width: height * 0.32,
          height: height * 0.5,
          background:
            "radial-gradient(ellipse at 50% 70%, hsl(45 100% 92% / 0.6) 0%, hsl(28 95% 65% / 0.25) 40%, transparent 70%)",
          filter: "blur(8px)",
          mixBlendMode: "screen",
          animation: "cinematic-core-pulse 1.4s ease-in-out infinite",
        }}
      />

      {/* Rising embers — DOM particles with random drift */}
      {embers.map((e) => (
        <span
          key={e.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${e.left}%`,
            bottom: 0,
            width: e.size,
            height: e.size,
            background: `hsl(${e.hue} 100% 75%)`,
            boxShadow: `0 0 ${e.size * 4}px hsl(${e.hue} 100% 60% / 0.85)`,
            opacity: 0,
            animation: `cinematic-ember-rise ${e.duration}s ease-out infinite`,
            animationDelay: `${e.delay}s`,
            ["--cf-drift" as string]: `${e.drift + tilt.x * 30}px`,
            ["--cf-rise" as string]: `-${height * 0.95}px`,
          }}
        />
      ))}

      {/* Smoke wisps — desaturated drift above the flame */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          top: 0,
          width: height * 0.7,
          height: height * 0.5,
          background:
            "radial-gradient(ellipse at 50% 80%, hsl(258 8% 45% / 0.35) 0%, transparent 65%)",
          filter: "blur(18px)",
          mixBlendMode: "screen",
          animation: "cinematic-smoke-drift 7s ease-in-out infinite",
        }}
      />

      {/* Vignette for cinematic framing */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 90% at 50% 60%, transparent 40%, hsl(0 0% 0% / 0.7) 100%)",
        }}
      />
    </div>
  );
};

export default CinematicFlame;
