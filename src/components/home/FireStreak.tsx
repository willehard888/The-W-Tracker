import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FireStreakProps {
  className?: string;
  /** How often a new streak fires across the screen (ms). Default 5200. */
  intervalMs?: number;
  /** Force a streak immediately (e.g. on mount). Default true. */
  fireOnMount?: boolean;
}

interface StreakRun {
  id: number;
  /** Vertical position 0..1 within container */
  y: number;
  /** Direction: 1 = left→right, -1 = right→left */
  dir: 1 | -1;
  /** Slight tilt in degrees */
  tilt: number;
  /** Speed multiplier for animation duration */
  speed: number;
  /** Random hue offset for plasma core */
  hueShift: number;
}

/**
 * FireStreak — AAA-game style blazing fire streak that shoots across
 * the screen with long trailing flames, glowing embers, motion blur,
 * heat distortion, and a plasma energy core.
 *
 * Composition (per run):
 *  • Wide horizontal trail (orange→white-hot core→blue plasma edge)
 *  • Secondary blurred trail for motion-blur depth
 *  • Bright leading head (white-hot ball with chromatic glow)
 *  • Spark burst that scatters from the head
 *  • Heat-haze SVG displacement on the trail
 *
 * Fully GPU (transform/opacity only). Respects prefers-reduced-motion.
 */
const FireStreak = ({
  className,
  intervalMs = 5200,
  fireOnMount = true,
}: FireStreakProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [runs, setRuns] = useState<StreakRun[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const fire = () => {
      const id = ++idRef.current;
      const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      const run: StreakRun = {
        id,
        y: 0.25 + Math.random() * 0.5, // mid-band
        dir,
        tilt: (Math.random() - 0.5) * 14,
        speed: 0.85 + Math.random() * 0.5,
        hueShift: Math.random() > 0.7 ? -25 : Math.random() * 12,
      };
      setRuns((prev) => [...prev, run]);
      // Cleanup after animation finishes (~2.4s max)
      window.setTimeout(() => {
        setRuns((prev) => prev.filter((r) => r.id !== id));
      }, 2800);
    };

    if (fireOnMount) {
      const t = window.setTimeout(fire, 600);
      const interval = window.setInterval(fire, intervalMs);
      return () => {
        window.clearTimeout(t);
        window.clearInterval(interval);
      };
    }

    const interval = window.setInterval(fire, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, fireOnMount]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 pointer-events-none overflow-hidden",
        className,
      )}
      aria-hidden
    >
      {/* SVG defs for heat-haze displacement on trails */}
      <svg className="absolute inset-0 w-0 h-0" aria-hidden>
        <defs>
          <filter id="firestreak-haze" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.04" numOctaves="2" seed="3">
              <animate
                attributeName="baseFrequency"
                dur="2.4s"
                values="0.018 0.04;0.026 0.052;0.018 0.04"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="8" />
          </filter>
        </defs>
      </svg>

      {runs.map((r) => {
        const duration = 1.9 * r.speed;
        const startX = r.dir === 1 ? "-40vw" : "140vw";
        const endX = r.dir === 1 ? "140vw" : "-40vw";
        const tilt = r.dir === 1 ? r.tilt : -r.tilt;

        return (
          <div
            key={r.id}
            className="absolute left-0 will-change-transform"
            style={{
              top: `${r.y * 100}%`,
              width: "100%",
              height: 0,
              transform: `rotate(${tilt}deg)`,
              transformOrigin: "50% 50%",
              ["--fs-start" as string]: startX,
              ["--fs-end" as string]: endX,
              ["--fs-duration" as string]: `${duration}s`,
              animation: `firestreak-traverse ${duration}s cubic-bezier(0.22, 0.65, 0.18, 1) forwards`,
              filter: `hue-rotate(${r.hueShift}deg)`,
            }}
          >
            {/* Outer wide trail — soft volumetric warmth */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: r.dir === 1 ? "auto" : 0,
                right: r.dir === 1 ? 0 : "auto",
                width: "62vw",
                height: 28,
                background:
                  r.dir === 1
                    ? "linear-gradient(90deg, transparent 0%, hsl(18 95% 50% / 0) 5%, hsl(18 95% 55% / 0.35) 28%, hsl(28 100% 60% / 0.7) 60%, hsl(45 100% 80% / 0.95) 88%, hsl(48 100% 92% / 1) 100%)"
                    : "linear-gradient(270deg, transparent 0%, hsl(18 95% 50% / 0) 5%, hsl(18 95% 55% / 0.35) 28%, hsl(28 100% 60% / 0.7) 60%, hsl(45 100% 80% / 0.95) 88%, hsl(48 100% 92% / 1) 100%)",
                filter: "blur(10px) url(#firestreak-haze)",
                mixBlendMode: "screen",
                borderRadius: 9999,
                opacity: 0.9,
              }}
            />

            {/* Mid trail — sharper orange core */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: r.dir === 1 ? "auto" : 0,
                right: r.dir === 1 ? 0 : "auto",
                width: "48vw",
                height: 10,
                background:
                  r.dir === 1
                    ? "linear-gradient(90deg, transparent 0%, hsl(18 95% 58% / 0.55) 30%, hsl(32 100% 65% / 0.95) 70%, hsl(50 100% 95% / 1) 100%)"
                    : "linear-gradient(270deg, transparent 0%, hsl(18 95% 58% / 0.55) 30%, hsl(32 100% 65% / 0.95) 70%, hsl(50 100% 95% / 1) 100%)",
                filter: "blur(3.5px)",
                mixBlendMode: "screen",
                borderRadius: 9999,
              }}
            />

            {/* Plasma blue edge — fantasy energy aura along outer rim */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: r.dir === 1 ? "auto" : 0,
                right: r.dir === 1 ? 0 : "auto",
                width: "55vw",
                height: 36,
                background:
                  r.dir === 1
                    ? "linear-gradient(90deg, transparent 0%, hsl(210 100% 65% / 0.18) 40%, hsl(195 100% 70% / 0.32) 75%, hsl(190 100% 85% / 0.45) 100%)"
                    : "linear-gradient(270deg, transparent 0%, hsl(210 100% 65% / 0.18) 40%, hsl(195 100% 70% / 0.32) 75%, hsl(190 100% 85% / 0.45) 100%)",
                filter: "blur(14px)",
                mixBlendMode: "screen",
                borderRadius: 9999,
                opacity: 0.85,
              }}
            />

            {/* White-hot core line — razor sharp center */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: r.dir === 1 ? "auto" : 0,
                right: r.dir === 1 ? 0 : "auto",
                width: "40vw",
                height: 2,
                background:
                  r.dir === 1
                    ? "linear-gradient(90deg, transparent 0%, hsl(45 100% 90% / 0.7) 50%, hsl(0 0% 100% / 1) 100%)"
                    : "linear-gradient(270deg, transparent 0%, hsl(45 100% 90% / 0.7) 50%, hsl(0 0% 100% / 1) 100%)",
                filter: "blur(0.6px)",
                mixBlendMode: "screen",
                borderRadius: 9999,
              }}
            />

            {/* Leading head — white-hot ball with chromatic plasma glow */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                right: r.dir === 1 ? -8 : "auto",
                left: r.dir === 1 ? "auto" : -8,
                width: 56,
                height: 56,
                marginTop: -28,
                background:
                  "radial-gradient(circle at 50% 50%, hsl(0 0% 100% / 1) 0%, hsl(48 100% 85% / 0.95) 18%, hsl(28 100% 60% / 0.75) 38%, hsl(18 95% 50% / 0.4) 58%, hsl(210 100% 60% / 0.18) 80%, transparent 100%)",
                filter: "blur(2px)",
                mixBlendMode: "screen",
                borderRadius: "50%",
                animation: "firestreak-head-pulse 0.18s ease-in-out infinite",
              }}
            />

            {/* Spark burst — small embers scattering from the head */}
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const dist = 30 + Math.random() * 40;
              const sx = Math.cos(angle) * dist * (r.dir === 1 ? -1 : 1);
              const sy = Math.sin(angle) * dist;
              return (
                <span
                  key={i}
                  className="absolute top-1/2 rounded-full"
                  style={{
                    right: r.dir === 1 ? 0 : "auto",
                    left: r.dir === 1 ? "auto" : 0,
                    width: 3,
                    height: 3,
                    marginTop: -1.5,
                    background: i % 3 === 0 ? "hsl(195 100% 80%)" : "hsl(35 100% 70%)",
                    boxShadow: `0 0 8px ${i % 3 === 0 ? "hsl(195 100% 70% / 0.9)" : "hsl(28 100% 60% / 0.95)"}`,
                    ["--fs-spark-x" as string]: `${sx}px`,
                    ["--fs-spark-y" as string]: `${sy}px`,
                    animation: `firestreak-spark 0.85s ease-out ${i * 0.04}s forwards`,
                    opacity: 0,
                    mixBlendMode: "screen",
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default FireStreak;
