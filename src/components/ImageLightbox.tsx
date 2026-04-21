import { useEffect, useState } from "react";
import { X, Heart, MessageCircle, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusAvatar from "@/components/StatusAvatar";
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
 * Premium full-screen image preview for the Elite Feed.
 * - Tap backdrop to dismiss
 * - Locks body scroll while open
 * - Esc to close (desktop)
 * - Surfaces author tier + key engagement metrics in a glass overlay
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  const showMetric = (n?: number) => typeof n === "number" && n > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-2xl animate-fade-in"
      onClick={onClose}
    >
      {/* Top bar — author + close */}
      <div
        className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <StatusAvatar src={avatarUrl ?? undefined} name={username} tier={tier} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">@{username || "unknown"}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {typeof level === "number" && level > 0 && <span>Lv.{level}</span>}
            {showMetric(streak) && (
              <>
                <span>•</span>
                <span className="text-streak-orange">🔥 {streak}d</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close image"
          className="h-9 w-9 rounded-full bg-secondary/60 backdrop-blur-md border border-border/40 flex items-center justify-center text-foreground hover:bg-secondary transition-colors active:scale-95"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image stage */}
      <div className="flex-1 flex items-center justify-center px-3 min-h-0" onClick={(e) => e.stopPropagation()}>
        <div className="relative max-h-full max-w-full">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
            </div>
          )}
          <img
            src={imageUrl}
            alt={caption || "Post image"}
            onLoad={() => setLoaded(true)}
            className={cn(
              "max-h-[calc(100dvh-180px)] max-w-full w-auto h-auto object-contain rounded-xl shadow-[0_24px_64px_-12px_hsl(0_0%_0%/0.7)]",
              "transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>

      {/* Bottom glass card — caption + metrics */}
      <div
        className="shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-gold/15 bg-card/60 backdrop-blur-xl p-3 shadow-[0_4px_24px_hsl(0_0%_0%/0.4)]">
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
  );
};

export default ImageLightbox;
