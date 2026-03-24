import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface LazyVideoPlayerProps {
  src: string;
  className?: string;
}

const LazyVideoPlayer = ({ src, className }: LazyVideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
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
      <div ref={containerRef} className={cn("relative", className)}>
        <video
          src={src}
          className="w-full max-h-96 rounded-xl"
          controls
          autoPlay
          preload="auto"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative cursor-pointer group",
        className
      )}
      onClick={() => setIsPlaying(true)}
    >
      {/* Thumbnail or placeholder */}
      {thumbnail ? (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className="w-full max-h-96 object-cover rounded-xl"
        />
      ) : (
        <div className="w-full aspect-video max-h-96 rounded-xl bg-secondary/60 flex items-center justify-center">
          {isVisible && !thumbnailError && (
            <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="h-14 w-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
          <Play size={24} className="text-white ml-1" fill="white" />
        </div>
      </div>

      {/* Video badge */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white uppercase tracking-wider">
        Video
      </div>
    </div>
  );
};

export default LazyVideoPlayer;
