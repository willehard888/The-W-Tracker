import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";

interface LazyVideoPlayerProps {
  src: string;
  className?: string;
}

const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const LazyVideoPlayer = ({ src, className }: LazyVideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Generate thumbnail from video when visible
  useEffect(() => {
    if (!isVisible || thumbnail || thumbnailError) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.src = src;

    const handleSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL("image/jpeg", 0.7));
        }
      } catch {
        setThumbnailError(true);
      }
      video.remove();
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("loadedmetadata", () => {
      if (isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
    }, { once: true });
    video.addEventListener("loadeddata", () => {
      video.currentTime = 0.5;
    }, { once: true });
    video.addEventListener("error", () => {
      setThumbnailError(true);
      video.remove();
    }, { once: true });

    return () => {
      video.removeEventListener("seeked", handleSeeked);
      video.remove();
    };
  }, [isVisible, src, thumbnail, thumbnailError]);

  if (isPlaying) {
    return (
      <div ref={containerRef} className={cn("relative bg-black rounded-xl overflow-hidden animate-fade-in", className)}>
        <video
          src={src}
          className="w-full max-h-96 object-contain bg-black"
          controls
          autoPlay
          playsInline
          preload="auto"
        />
      </div>
    );
  }

  return (
    <button
      ref={containerRef as any}
      type="button"
      aria-label="Play video"
      className={cn("relative block w-full cursor-pointer group active:scale-[0.99] transition-transform", className)}
      onClick={() => { hapticSelection(); setIsPlaying(true); }}
    >
      {/* Thumbnail or placeholder */}
      {thumbnail ? (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className="w-full max-h-96 object-cover rounded-xl"
        />
      ) : (
        <div className="w-full aspect-video max-h-96 rounded-xl bg-gradient-to-br from-secondary/70 to-secondary/30 flex items-center justify-center">
          {isVisible && !thumbnailError && (
            <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* Play button overlay — larger, springy, Apple-grade */}
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gradient-to-t from-black/35 via-transparent to-black/10">
        <div className="h-16 w-16 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-[0_8px_28px_-6px_hsl(0_0%_0%/0.6)] transition-transform duration-200 group-active:scale-90 group-hover:scale-105">
          <Play size={26} className="text-black ml-0.5" fill="currentColor" />
        </div>
      </div>

      {/* Duration badge (bottom-right, like Apple/Instagram) */}
      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/65 backdrop-blur-sm text-[10px] font-bold text-white tabular-nums tracking-wide">
        {duration != null ? fmtDuration(duration) : "Video"}
      </div>
    </button>
  );
};

export default LazyVideoPlayer;
