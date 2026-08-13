import { cn } from "@/lib/utils";

/**
 * TribeEmberSeed — the COLD state of the tribe fire, done premium.
 *
 * Cold is the most common state a young tribe lives in, and it used to be a
 * dead gray candle emoji — the one surface most users saw looked cheapest.
 * This renders a LIVE ember instead: a dark coal bed with breathing amber
 * cores, one tiny wick-flame licking above it, and an occasional rising
 * spark. "The fire isn't dead — it's waiting for you."
 *
 * Pure CSS (transform/opacity only), zero JS per frame, no blur-heavy layers —
 * safe to render in lists. Reuses the TribeFireLite keyframes.
 */
const COALS = [
  { x: "26%", w: 0.30, h: 0.16, delay: 0,   dur: 3.8 },
  { x: "50%", w: 0.36, h: 0.19, delay: 1.3, dur: 3.2 },
  { x: "72%", w: 0.26, h: 0.14, delay: 2.1, dur: 4.4 },
] as const;

const TribeEmberSeed = ({ size = 110, className }: { size?: number; className?: string }) => (
  <div
    className={cn("relative flex items-end justify-center", className)}
    style={{ width: size, height: size * 0.9, contain: "layout" }}
    aria-hidden
  >
    {/* Warm breathing under-glow — dim, but unmistakably alive */}
    <div
      className="absolute inset-x-0 bottom-0 pointer-events-none"
      style={{
        height: size * 0.5,
        background:
          "radial-gradient(ellipse 85% 70% at 50% 100%, hsl(18 90% 50% / 0.26) 0%, hsl(18 90% 45% / 0.08) 45%, transparent 75%)",
        animation: "ember-seed-breathe 4.2s ease-in-out infinite",
      }}
    />

    {/* Coal bed — dark stones with pulsing amber cores */}
    {COALS.map((c, i) => (
      <span
        key={i}
        className="absolute rounded-[45%] pointer-events-none"
        style={{
          width: size * c.w,
          height: size * c.h,
          left: c.x,
          bottom: size * 0.02 + (i === 1 ? size * 0.05 : 0),
          transform: "translateX(-50%)",
          background: "hsl(12 25% 10%)",
          boxShadow: "inset 0 2px 3px hsl(0 0% 0% / 0.6)",
        }}
      >
        <span
          className="absolute inset-0 rounded-[45%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 65%, hsl(20 95% 52% / 0.85) 0%, hsl(12 85% 40% / 0.4) 45%, transparent 75%)",
            animation: `ember-seed-pulse ${c.dur}s ease-in-out ${c.delay}s infinite`,
          }}
        />
      </span>
    ))}

    {/* Tiny living wick-flame above the center coal */}
    <span
      className="absolute pointer-events-none"
      style={{
        width: size * 0.14,
        height: size * 0.34,
        left: "50%",
        bottom: size * 0.2,
        transform: "translateX(-50%)",
        transformOrigin: "50% 100%",
        background:
          "radial-gradient(ellipse at 50% 82%, hsl(48 100% 80%) 0%, hsl(28 95% 56%) 40%, hsl(14 90% 46%) 72%, transparent 96%)",
        borderRadius: "50% 50% 50% 50% / 68% 68% 32% 32%",
        clipPath: "polygon(50% 0%, 92% 38%, 100% 72%, 78% 100%, 22% 100%, 0% 72%, 8% 38%)",
        boxShadow: "0 0 10px hsl(24 95% 55% / 0.8), 0 0 22px hsl(18 90% 50% / 0.45)",
        animation: "tfl-flicker-v2 1.45s ease-in-out infinite",
      }}
    />

    {/* One patient spark, rising now and then */}
    <span
      className="absolute rounded-full pointer-events-none"
      style={{
        width: 2.5,
        height: 2.5,
        left: "54%",
        bottom: size * 0.28,
        background: "hsl(42 100% 72%)",
        boxShadow: "0 0 5px hsl(28 95% 58%), 0 0 10px hsl(28 95% 58% / 0.6)",
        animation: "tfl-ember-rise 3.6s linear 1.2s infinite",
        ["--tfl-ember-drift" as string]: "9px",
      }}
    />
  </div>
);

export default TribeEmberSeed;
