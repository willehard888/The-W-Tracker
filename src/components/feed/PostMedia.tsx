import { Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import AppImage from "@/components/ui/app-image";
import LazyVideoPlayer from "@/components/LazyVideoPlayer";

const isUnsupportedHeic = (value: string) => /\.hei(c|f)$/i.test(value);

export interface PostMediaProps {
  imageUrl?: string | null;
  videoUrl?: string | null;
  alt?: string;
  /** Author tier — drives the corner ribbon (elite → gold, apex → ember). */
  tier?: string | null;
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
const PostMedia = ({ imageUrl, videoUrl, alt = "", tier, onOpenImage, className }: PostMediaProps) => {
  const ribbon =
    tier === "elite" ? { icon: Crown, label: "Elite", color: "text-gold", border: "border-gold/40" }
    : tier === "apex" ? { icon: Zap, label: "Apex", color: "text-[hsl(18_95%_58%)]", border: "border-[hsl(18_95%_58%)]/50" }
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

  return (
    <button
      type="button"
      onClick={onOpenImage}
      aria-label="Open image"
      className={cn(
        "group mt-3 mx-4 block w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary/40 active:scale-[0.99] transition-transform",
        className,
      )}
    >
      <div className="relative w-full aspect-[4/5]">
        {/* Calm skeleton — covered once the image fades in over it (no pop-in). */}
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary/70 to-secondary/30"
        />
        <AppImage
          src={imageUrl}
          width={760}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover transition-[transform,opacity] duration-500 group-active:scale-[1.01]"
        />
        {/* Legibility gradient at the bottom edge */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
        {ribbon && (
          <div className={cn("pointer-events-none absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border", ribbon.border)}>
            <ribbon.icon size={10} className={ribbon.color} {...(ribbon.label === "Apex" ? { fill: "currentColor" } : {})} />
            <span className={cn("text-[9px] font-black tracking-wider uppercase", ribbon.color)}>{ribbon.label}</span>
          </div>
        )}
      </div>
    </button>
  );
};

export default PostMedia;
