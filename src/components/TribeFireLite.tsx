import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * TribeFireLite — premium tribe-fire visual that uses ZERO JavaScript at
 * runtime. The original StylizedStreakFlame is 2400 lines + a RAF loop
 * + 3 SVG turbulence filters + pointer + device-orientation listeners
 * which dragged the whole app's frame budget on the Tribes page.
 *
 * Design:
 *  - 3 layered SVG flame silhouettes (back / mid / front)
 *  - Pure CSS keyframe animations for sway / breath / flicker
 *  - 6 subtle ember dots floating up via CSS translateY keyframes
 *  - Soft radial under-glow as a single absolute div
 *  - Tier drives:
 *      • flame height (more dramatic at higher tiers)
 *      • accent color (warm orange → white-hot)
 *      • ember count + speed
 *
 * Cost: 3 paths + 6 circles + 1 gradient — totally GPU-free for the JS
 * thread. No layout thrash, no per-frame re-paint of CSS vars.
 */

interface Props {
  /** 0–6 tier from collectiveStreakTier(). Higher = bigger + hotter. */
  tier: number;
  /** Outer accent color in hsl() string form. */
  accent: string;
  /** Container pixel size. The flame fills the container width. */
  size?: number;
  className?: string;
}

// Three handpicked silhouettes from the heavy component, kept minimal.
// All on viewBox 100×140 so we can scale uniformly.
const FLAME_BACK  = "M50 12 C 58 30, 72 38, 76 56 C 82 76, 78 96, 68 110 C 60 122, 54 132, 50 138 C 46 132, 40 122, 32 110 C 22 96, 18 76, 24 56 C 28 38, 42 30, 50 12 Z";
const FLAME_MID   = "M50 4 C 56 22, 66 32, 70 50 C 76 70, 72 92, 60 108 C 52 120, 50 130, 50 138 C 50 130, 40 120, 32 108 C 22 92, 24 70, 30 50 C 36 32, 48 22, 50 4 Z";
const FLAME_FRONT = "M50 -2 C 51 16, 58 28, 60 48 C 62 70, 58 94, 53 112 C 51 124, 50 132, 50 138 C 50 132, 49 124, 47 112 C 42 94, 38 70, 40 48 C 42 28, 49 16, 50 -2 Z";

const TribeFireLite = ({ tier, accent, size = 200, className }: Props) => {
  // Tier-driven knobs
  const tierBoost = Math.max(0, Math.min(6, tier)) / 6; // 0..1
  const innerHot = accent;
  const innerWarm = accent.replace(/(\d+)%\)/, (_m, l) => `${Math.min(100, parseInt(l) + 12)}%)`);

  // Ember positions — deterministic, decided once per tier
  const embers = useMemo(() => {
    const count = 4 + Math.round(tierBoost * 4); // 4..8 embers
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      // distribute horizontally with slight stagger
      x: 30 + ((i * 47) % 40) + (i % 2 === 0 ? -8 : 8),
      // staggered start delay so they don't all rise in sync
      delay: (i * 0.42) % 3,
      // duration varies slightly per ember
      dur: 2.6 + (i % 3) * 0.4,
      // size varies
      r: 1.2 + (i % 3) * 0.6,
    }));
  }, [tierBoost]);

  const flameHeightPx = size * (0.9 + tierBoost * 0.25);

  return (
    <div
      className={cn("relative flex items-end justify-center", className)}
      style={{
        width: size,
        height: flameHeightPx,
        // Single GPU layer — keeps the page repaint cost minimal
        contain: "layout paint",
        willChange: "transform",
      }}
      aria-hidden
    >
      {/* Under-glow — radial gradient pool beneath the fire */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: size * 0.6,
          background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${accent.replace(")", " / 0.28)")} 0%, ${accent.replace(")", " / 0.09)")} 38%, transparent 72%)`,
          filter: "blur(10px)",
          opacity: 0.45 + tierBoost * 0.3,
        }}
      />

      {/* SVG flames — 3 layers, CSS-keyframe sway only */}
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYEnd meet"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Per-flame vertical gradients — deep red base → hot tip */}
          <linearGradient id="tfl-back" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"  stopColor="hsl(10 76% 36%)" stopOpacity="0.85" />
            <stop offset="40%" stopColor={innerHot} stopOpacity="0.78" />
            <stop offset="80%" stopColor={innerWarm} stopOpacity="0.68" />
            <stop offset="100%" stopColor="hsl(42 82% 66%)" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="tfl-mid" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"  stopColor="hsl(8 80% 40%)" stopOpacity="0.95" />
            <stop offset="35%" stopColor={innerHot} stopOpacity="0.9" />
            <stop offset="75%" stopColor="hsl(42 84% 62%)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="hsl(50 82% 82%)" stopOpacity="0.62" />
          </linearGradient>
          <linearGradient id="tfl-front" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%"  stopColor="hsl(10 84% 46%)" stopOpacity="0.96" />
            <stop offset="30%" stopColor="hsl(28 86% 54%)" stopOpacity="0.96" />
            <stop offset="65%" stopColor="hsl(46 86% 66%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(54 82% 86%)" stopOpacity="0.7" />
          </linearGradient>
          {/* Ember gradient — bright warm core */}
          <radialGradient id="tfl-ember">
            <stop offset="0%"  stopColor="hsl(50 100% 80%)" stopOpacity="1" />
            <stop offset="60%" stopColor="hsl(20 100% 60%)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(10 100% 50%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* BACK — slow, wide sway */}
        <g style={{ animation: "tfl-sway-back 5.4s ease-in-out infinite", transformOrigin: "50% 100%" }}>
          <path d={FLAME_BACK} fill="url(#tfl-back)" />
        </g>

        {/* MID — medium sway, slightly faster, opposite direction */}
        <g style={{ animation: "tfl-sway-mid 4.2s ease-in-out infinite", transformOrigin: "50% 100%" }}>
          <path d={FLAME_MID} fill="url(#tfl-mid)" />
        </g>

        {/* FRONT — quickest sway + flicker */}
        <g style={{ animation: "tfl-sway-front 3.1s ease-in-out infinite", transformOrigin: "50% 100%" }}>
          <path
            d={FLAME_FRONT}
            fill="url(#tfl-front)"
            style={{ animation: "tfl-flicker 1.8s ease-in-out infinite" }}
          />
        </g>

        {/* Embers — small dots rising from the base */}
        {embers.map((e) => (
          <circle
            key={e.id}
            cx={e.x}
            cy={130}
            r={e.r}
            fill="url(#tfl-ember)"
            style={{
              animation: `tfl-ember-rise ${e.dur}s linear ${e.delay}s infinite`,
              transformOrigin: "center",
            }}
          />
        ))}
      </svg>

      {/* Scoped keyframes — only this component pays for them */}
      <style>{`
        @keyframes tfl-sway-back {
          0%, 100% { transform: rotate(-0.8deg) scaleY(0.99); }
          50%      { transform: rotate(0.8deg)  scaleY(1.01); }
        }
        @keyframes tfl-sway-mid {
          0%, 100% { transform: rotate(1deg) scaleY(1); }
          50%      { transform: rotate(-1deg) scaleY(0.985); }
        }
        @keyframes tfl-sway-front {
          0%, 100% { transform: rotate(-1.2deg) scaleY(1.01); }
          50%      { transform: rotate(1.2deg)  scaleY(0.985); }
        }
        @keyframes tfl-flicker {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.92; }
        }
        @keyframes tfl-ember-rise {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
          15%  { opacity: 0.95; }
          70%  { opacity: 0.7; }
          100% { transform: translate(var(--tfl-ember-drift, -4px), -90px) scale(0.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="tfl-sway"],
          [style*="tfl-flicker"],
          [style*="tfl-ember-rise"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TribeFireLite;
