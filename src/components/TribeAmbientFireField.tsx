import { useMemo } from "react";

interface TribeAmbientFireFieldProps {
  /** Collective heat — drives intensity (0 = nothing, >=30 ignites). */
  total: number;
  /** Accent color of the current collective tier. */
  accent: string;
  className?: string;
}

/**
 * Full-page ambient fire field rendered behind the tribe page content.
 * Slow drifting embers that intensify with collective heat:
 *   • <30: nothing (fire is cold)
 *   • 30-100: faint ambient embers
 *   • 100-300: more embers + faint heat haze at bottom
 *   • 300+: roaring ambient field with cinder rain
 *
 * GPU-only, fixed inset. Position absolute inside a relative container.
 */
const TribeAmbientFireField = ({ total, accent, className }: TribeAmbientFireFieldProps) => {
  // Particle count scales with heat
  const count = total >= 1500 ? 26 : total >= 700 ? 22 : total >= 300 ? 18 : total >= 100 ? 12 : total >= 30 ? 6 : 0;
  const intensity = Math.min(1, total / 1500);

  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      // Deterministic pseudo-random based on index
      const r = (n: number) => ((Math.sin((i + 1) * (n + 7) * 9301) + 1) / 2) % 1;
      return {
        leftPct: r(1) * 100,
        size: 1.5 + r(2) * 3.2,
        duration: 8 + r(3) * 9,
        delay: r(4) * 12,
        drift: (r(5) - 0.5) * 80,
        bright: r(6) > 0.7,
      };
    });
  }, [count]);

  if (count === 0) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      style={{ contain: "paint" }}
    >
      {/* Bottom-up heat haze for high tiers */}
      {total >= 100 && (
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "55%",
            background: `radial-gradient(ellipse at 50% 100%, ${accent.replace(")", ` / ${0.10 + intensity * 0.16})`)} 0%, transparent 70%)`,
            filter: "blur(20px)",
            mixBlendMode: "screen",
            animation: "ambient-haze-breath 6s ease-in-out infinite",
          }}
        />
      )}

      {/* Cinder rain for 300+ — embers drifting upward across the whole page */}
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.leftPct}%`,
            bottom: -12,
            width: p.size,
            height: p.size,
            background: p.bright ? "hsl(48 100% 88%)" : accent,
            boxShadow: `0 0 ${4 + p.size * 1.5}px ${accent}, 0 0 ${10 + p.size * 2}px ${accent.replace(")", " / 0.55)")}`,
            opacity: 0,
            ["--ambient-x" as string]: `${p.drift}px`,
            animation: `ambient-cinder-rise ${p.duration}s linear ${p.delay}s infinite`,
            mixBlendMode: "screen",
          }}
        />
      ))}

      {/* Top vignette so embers fade out near the top */}
      <div
        className="absolute inset-x-0 top-0 h-24"
        style={{
          background: "linear-gradient(180deg, hsl(var(--background)) 0%, transparent 100%)",
        }}
      />
    </div>
  );
};

export default TribeAmbientFireField;
