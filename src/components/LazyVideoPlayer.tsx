import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

interface LazyVideoPlayerProps {
  src: string;
  className?: string;
}

/**
 * Feed video — Instagram/TikTok behaviour: autoplays MUTED + looping when it
 * scrolls into view, pauses when it leaves (saves battery/data and keeps only
 * on-screen videos running). Tap anywhere to toggle sound. Muted autoplay is the
 * only kind iOS allows without a gesture; unmuting on tap is a user gesture, so
 * it's permitted. playsInline keeps it inline instead of going fullscreen on iOS.
 */
const LazyVideoPlayer = ({ src, className }: LazyVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [showHint, setShowHint] = useState(true);

  // Play when ≥60% on screen, pause otherwise. The browser only fetches the
  // media once play() is called, so off-screen videos stay cheap.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          el.play().catch(() => { /* autoplay can be refused; ignore */ });
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    hapticSelection();
    const next = !muted;
    setMuted(next);
    el.muted = next;
    setShowHint(false);
    // The tap is a valid gesture — make sure it keeps playing after the toggle.
    el.play().catch(() => {});
  };

  return (
    <div
      className={cn("relative bg-black rounded-2xl overflow-hidden", className)}
      onClick={toggleMute}
      role="button"
      aria-label={muted ? "Tap to unmute" : "Tap to mute"}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-[68vh] object-contain bg-black"
        muted={muted}
        loop
        playsInline
        preload="metadata"
      />

      {/* Sound indicator (purely visual — the whole surface is the tap target) */}
      <div className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white pointer-events-none">
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </div>

      {muted && showHint && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/55 backdrop-blur-sm text-[11px] font-bold text-white pointer-events-none">
          Tap for sound
        </div>
      )}
    </div>
  );
};

export default LazyVideoPlayer;
