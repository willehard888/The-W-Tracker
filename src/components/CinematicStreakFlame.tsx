import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CinematicStreakFlameProps {
  /** Box width in px */
  size?: number;
  /** Extra wrapper class */
  className?: string;
  /** Add subtle glowing aura behind the flame */
  withGlow?: boolean;
}

/**
 * Cinematic MP4-backed flame.
 *
 * Plays a perfectly-looping 3s flame video rendered with Remotion
 * (`/cinematic-flame.mp4`). Uses native <video autoplay loop muted playsinline>,
 * so it's GPU-decoded and basically free per frame. Use this for HERO streak
 * displays — not inside long lists, where the lightweight CSS-based
 * StreakFlameInline is preferable.
 */
const CinematicStreakFlame = ({ size = 140, className, withGlow = true }: CinematicStreakFlameProps) => {
  const inner = useMemo(() => Math.round(size * 1.05), [size]);
  return (
    <div
      className={cn("relative inline-block pointer-events-none", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {withGlow && (
        <span
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            bottom: -size * 0.05,
            width: size * 1.4,
            height: size * 0.5,
            background:
              "radial-gradient(ellipse at center, hsl(28 95% 55% / 0.55) 0%, hsl(18 90% 45% / 0.18) 40%, transparent 75%)",
            filter: "blur(20px)",
            mixBlendMode: "screen",
          }}
        />
      )}
      <video
        src="/cinematic-flame.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute left-1/2 bottom-0"
        style={{
          width: inner,
          height: inner,
          transform: "translateX(-50%)",
          mixBlendMode: "screen",
          objectFit: "cover",
        }}
      />
    </div>
  );
};

export default CinematicStreakFlame;
