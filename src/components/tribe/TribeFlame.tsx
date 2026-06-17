import { cn } from "@/lib/utils";

/**
 * TribeFlame — the signature, premium fire of the Tribe experience.
 *
 * Real, organic flame: an SVG flame body warped by animated fractal turbulence
 * (so the edges lick and flicker like real fire), a bright white-gold core, a
 * soft bloom, a molten floor pool, and rising embers. GPU/compositor-friendly
 * — one animated <feTurbulence>, no per-frame JS — so it stays smooth.
 *
 * `intensity` (0..1) scales brightness, embers and bloom; `hue` shifts the
 * whole flame (gold → ember → violet) so it can reflect a tribe's tier.
 */
interface TribeFlameProps {
  size?: number;       // rendered height in px
  intensity?: number;  // 0..1
  /** Base hue: 28 = ember-gold (default), 14 = lava, 280 = legend violet, 190 = firestorm cyan */
  hue?: number;
  className?: string;
}

const TribeFlame = ({ size = 220, intensity = 1, hue = 28, className }: TribeFlameProps) => {
  const w = size * 0.78;
  const i = Math.max(0, Math.min(1, intensity));
  const emberCount = 6;

  return (
    <div
      className={cn("relative pointer-events-none select-none", className)}
      style={{ width: w, height: size }}
      aria-hidden
    >
      {/* Outer bloom */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: w * 2.1,
          height: size * 1.9,
          background: `radial-gradient(ellipse 50% 55% at 50% 58%, hsl(${hue} 95% 55% / ${0.34 * i}) 0%, hsl(${hue + 14} 95% 55% / ${0.12 * i}) 38%, transparent 72%)`,
          filter: "blur(6px)",
        }}
      />

      {/* Molten floor pool */}
      <div
        className="absolute left-1/2 bottom-[6%] -translate-x-1/2 rounded-full"
        style={{
          width: w * 0.92,
          height: size * 0.12,
          background: `radial-gradient(ellipse at center, hsl(${hue + 8} 100% 62% / ${0.55 * i}) 0%, hsl(${hue - 6} 95% 48% / ${0.25 * i}) 45%, transparent 75%)`,
          filter: "blur(3px)",
          animation: "tribeflame-pool 3.6s ease-in-out infinite",
        }}
      />

      {/* The flame */}
      <svg
        viewBox="0 0 120 165"
        className="absolute inset-0 h-full w-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`tf-body-${hue}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`hsl(48 100% 90%)`} />
            <stop offset="0.22" stopColor={`hsl(${hue + 16} 98% 64%)`} />
            <stop offset="0.58" stopColor={`hsl(${hue} 96% 53%)`} />
            <stop offset="1" stopColor={`hsl(${hue - 16} 88% 40%)`} />
          </linearGradient>
          <linearGradient id={`tf-core-${hue}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(50 100% 97%)" />
            <stop offset="0.5" stopColor={`hsl(46 100% 78%)`} />
            <stop offset="1" stopColor={`hsl(${hue + 10} 98% 60%)`} />
          </linearGradient>

          {/* Organic flicker — animated fractal turbulence displaces the flame */}
          <filter id={`tf-flicker-${hue}`} x="-40%" y="-20%" width="180%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.045" numOctaves="2" seed="6" result="n">
              <animate attributeName="baseFrequency" dur="6.5s" values="0.018 0.045;0.024 0.06;0.016 0.04;0.018 0.045" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale={9 + 5 * i} xChannelSelector="R" yChannelSelector="G" />
          </filter>

          <filter id="tf-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        <g filter={`url(#tf-flicker-${hue})`} style={{ transformOrigin: "60px 150px", animation: "tribeflame-sway 4.4s ease-in-out infinite" }}>
          {/* Body */}
          <path
            d="M60 158 C 26 140, 28 96, 46 64 C 56 46, 49 28, 61 8 C 70 26, 71 46, 84 66 C 102 92, 96 142, 60 158 Z"
            fill={`url(#tf-body-${hue})`}
          />
          {/* Inner core */}
          <path
            d="M60 150 C 42 138, 44 108, 55 84 C 61 71, 57 56, 62 42 C 69 58, 70 74, 76 92 C 86 112, 80 140, 60 150 Z"
            fill={`url(#tf-core-${hue})`}
            filter="url(#tf-soft)"
            opacity={0.85 * (0.6 + 0.4 * i)}
          />
          {/* Hot white tip */}
          <ellipse cx="61" cy="118" rx="9" ry="20" fill="hsl(50 100% 96%)" filter="url(#tf-soft)" opacity={0.5 * i} />
        </g>
      </svg>

      {/* Rising embers */}
      {Array.from({ length: emberCount }).map((_, idx) => {
        const left = 18 + (idx * 64) / emberCount + (idx % 2 ? 6 : -4);
        const dur = 2.8 + (idx % 4) * 0.6;
        const delay = (idx * 0.55) % 3;
        const dot = idx % 3 === 0 ? 3 : 2;
        return (
          <span
            key={idx}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: "16%",
              width: dot,
              height: dot,
              background: `hsl(${hue + 14} 100% 68%)`,
              boxShadow: `0 0 6px hsl(${hue + 10} 100% 60%), 0 0 12px hsl(${hue} 100% 55% / 0.6)`,
              opacity: 0,
              animation: `tribeflame-ember ${dur}s ease-in ${delay}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
};

export default TribeFlame;
