import { Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import AppImage from "@/components/ui/app-image";
import LazyVideoPlayer from "@/components/LazyVideoPlayer";
import DayStatsSticker, { type DayStats } from "@/components/feed/DayStatsSticker";

const isUnsupportedHeic = (value: string) => /\.hei(c|f)$/i.test(value);

export interface PostMediaProps {
  imageUrl?: string | null;
  videoUrl?: string | null;
  alt?: string;
  /** Author tier — drives the corner ribbon (elite → gold, apex → ember). */
  tier?: string | null;
  /** Day stats for check-in proof photos — renders the premium stat sticker
   *  (bottom-left counterpart to the tier ribbon). Composer posts pass none. */
  dayStats?: DayStats | null;
  /** Tap handler for images (opens the lightbox). Videos play inline. */
  onOpenImage?: () => void;
  className?: string;
}

/**
 * One premium media frame for every post surface (feed, tribe, profile).
 * - Consistent rounded-2xl frame + hairline border (no more raw <img>/<video>).
 * - Reserves a 4:5 box so the feed never janks or pops in; a calm skeleton
 *   sits behind the image and is covered as the image fades in (object-cover).
 * - Portrait-friendly crop (4:5) instead of the old harsh max-h-96; the full
 *   image is shown in the lightbox on tap.
 * - Tier ribbon overlay. HEIC originals get a graceful notice.
 */
const PostMedia = ({ imageUrl, videoUrl, alt = "", tier, dayStats, onOpenImage, className }: PostMediaProps) => {
  const ribbon =
    tier === "elite" ? { icon: Crown, label: "Elite", color: "text-gold", border: "border-gold/40" }
    : tier === "apex" ? { icon: Zap, label: "Apex", color: "text-[hsl(var(--ember))]", border: "border-[hsl(var(--ember))]/50" }
    : null;

  // Video — delegate to the lazy player inside the shared frame.
  if (videoUrl) {
    return (
      <div className={cn("mt-3 mx-4 rounded-2xl overflow-hidden border border-border/60", className)}>
        <LazyVideoPlayer src={videoUrl} />
      </div>
    );
  }

  if (!imageUrl) return null;

  if (isUnsupportedHeic(imageUrl)) {
    return (
      <div className={cn("mt-3 mx-4 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground", className)}>
        This image format isn't supported on all devices. Please upload JPG, PNG or WEBP.
      </div>
    );
  }

  // Show the FULL image at its natural aspect — no crop/zoom, and no tap-to-open
  // fullscreen zoom. Just the photo in a clean framed container.
  return (
    <div
      className={cn(
        "relative mt-3 mx-4 overflow-hidden rounded-2xl border border-border/60 bg-secondary/40",
        className,
      )}
    >
      {/* Full image at natural aspect, but capped so extreme-tall portraits
          don't take over the whole feed — only those get a gentle center-crop. */}
      <AppImage
        src={imageUrl}
        width={760}
        alt={alt}
        className="w-full h-auto max-h-[68vh] object-cover"
      />
      {ribbon && (
        <div className={cn("pointer-events-none absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border", ribbon.border)}>
          <ribbon.icon size={10} className={ribbon.color} {...(ribbon.label === "Apex" ? { fill: "currentColor" } : {})} />
          <span className={cn("text-[9px] font-black tracking-wider uppercase", ribbon.color)}>{ribbon.label}</span>
        </div>
      )}
      {dayStats && <DayStatsSticker stats={dayStats} />}
    </div>
  );
};

export default PostMedia;
