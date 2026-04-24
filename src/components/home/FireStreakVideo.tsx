import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import fireStreakAsset from "@/assets/fire-streak.mp4.asset.json";

interface FireStreakVideoProps {
  className?: string;
  /** Container height in px. Defaults to 220. */
  height?: number;
}

/**
 * AI-generated cinematic fire streak (MP4) looping seamlessly.
 * Uses `screen` blend mode so the pure-black background drops out and only
 * the flame, embers, plasma glow, and heat trail show on top of the page.
 */
const FireStreakVideo = ({ className, height = 220 }: FireStreakVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Try to start playback (mobile browsers sometimes need an explicit kick)
    const tryPlay = () => v.play().catch(() => {});
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("loadeddata", tryPlay, { once: true });
  }, []);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden pointer-events-none select-none bg-black",
        className,
      )}
      style={{ height }}
      aria-hidden
    >
      <video
        ref={videoRef}
        src={fireStreakAsset.url}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          mixBlendMode: "screen",
          filter: "saturate(1.15) contrast(1.08)",
        }}
      />
      {/* Soft side vignettes — frame the streak cinematically */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, hsl(0 0% 0% / 0.55) 0%, transparent 18%, transparent 82%, hsl(0 0% 0% / 0.55) 100%)",
        }}
      />
      {/* Top/bottom fade — blends into page background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, hsl(0 0% 0% / 0.4) 0%, transparent 25%, transparent 75%, hsl(0 0% 0% / 0.5) 100%)",
        }}
      />
    </div>
  );
};

export default FireStreakVideo;
