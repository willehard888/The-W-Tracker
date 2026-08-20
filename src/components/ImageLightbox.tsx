import { useEffect, useState } from "react";
import { Portal } from "@/components/ui/Portal";
import StreakFlameInline from "@/components/StreakFlameInline";
import { X, Heart, MessageCircle, Award } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import ZoomableImage from "@/components/ui/ZoomableImage";
import { useSignedMediaUrl } from "@/lib/signed-url";
import type { StatusTier } from "@/lib/status-tiers";

interface ImageLightboxProps {
  open: boolean;
  imageUrl: string | null;
  username?: string;
  avatarUrl?: string | null;
  tier?: StatusTier;
  level?: number;
  streak?: number;
  likes?: number;
  comments?: number;
  kudos?: number;
  caption?: string | null;
  onClose: () => void;
}

/**
 * Apple-Photos-grade full-screen image preview.
 * - Pinch / double-tap to zoom, pan when zoomed (via ZoomableImage)
 * - Swipe down to dismiss; backdrop + chrome fade with the drag
 * - Esc / X to close; body scroll locked while open
 * - Surfaces author tier + engagement metrics in a glass overlay
 */
const ImageLightbox = ({
  open,
  imageUrl,
  username,
  avatarUrl,
  tier = "recruit",
  level,
  streak,
  likes,
  comments,
  kudos,
  caption,
  onClose,
}: ImageLightboxProps) => {
  const [dismiss, setDismiss] = useState(0); // 0→1 while swiping down

  // Reset the swipe-dismiss progress each time the viewer (re)opens.
  useEffect(() => { if (open) setDismiss(0); }, [open]);

  // Private-bucket media renders via a signed URL (S7 storage flip).
  const resolvedUrl = useSignedMediaUrl(imageUrl);

  if (!open || !imageUrl) return null;

  const showMetric = (n?: number) => typeof n === "number" && n > 0;
  const chromeOpacity = Math.max(0, 1 - dismiss * 1.4);

  return (
    <Portal>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col animate-fade-in"
      style={{ backgroundColor: `hsl(var(--background) / ${0.98 * (1 - dismiss * 0.6)})` }}
    >
      {/* Top bar — author + close */}
      <div
        className="relative z-10 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 shrink-0"
        style={{ opacity: chromeOpacity }}
      >
        <StatusAvatar src={avatarUrl ?? undefined} name={username} tier={tier} size="sm" animated={false} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">@{username || "unknown"}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {typeof level === "number" && level > 0 && <span>Lv.{level}</span>}
            {showMetric(streak) && (
              <>
                <span>•</span>
                <StreakFlameInline streak={streak} suffix="d" className="text-[10px]" />
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close image"
          className="h-9 w-9 rounded-full bg-secondary border border-border/40 flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors active:scale-95"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image stage — pinch/double-tap zoom, swipe-down to dismiss */}
      <div className="relative flex-1 min-h-0">
        <ZoomableImage
          url={resolvedUrl ?? imageUrl}
          alt={caption || "Post image"}
          onClose={onClose}
          onDismissProgress={setDismiss}
          imgClassName="max-h-[calc(100dvh-180px)] max-w-full w-auto h-auto object-contain rounded-xl shadow-[0_24px_64px_-12px_hsl(0_0%_0%/0.7)]"
        />
      </div>

      {/* Bottom glass card — caption + metrics */}
      <div
        className="relative z-10 shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        style={{ opacity: chromeOpacity }}
      >
        <div className="rounded-2xl border border-gold/15 bg-card/95 p-3 shadow-[0_4px_24px_hsl(0_0%_0%/0.4)]">
          {caption && (
            <p className="text-xs text-foreground/90 leading-relaxed line-clamp-3 mb-2">
              {caption}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            {showMetric(likes) && (
              <span className="flex items-center gap-1 text-gold">
                <Heart size={12} fill="currentColor" /> {likes}
              </span>
            )}
            {showMetric(comments) && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <MessageCircle size={12} /> {comments}
              </span>
            )}
            {showMetric(kudos) && (
              <span className="flex items-center gap-1 text-purple">
                <Award size={12} fill="currentColor" /> {kudos}
              </span>
            )}
            {!showMetric(likes) && !showMetric(comments) && !showMetric(kudos) && (
              <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wider">
                Be the first to react
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
};

export default ImageLightbox;
