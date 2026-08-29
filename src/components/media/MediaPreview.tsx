import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtSize = (b?: number) =>
  b == null ? "" : b >= 1024 * 1024 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export interface MediaPreviewProps {
  imageSrc?: string | null;
  videoSrc?: string | null;
  /** Original file size (bytes) for the "ready · 1.2 MB" hint. */
  sizeBytes?: number;
  onClear: () => void;
  /** When set, shows a progress overlay with this label (e.g. "Uploading…"). */
  progressLabel?: string | null;
  className?: string;
}

/**
 * Shared, Apple-grade media preview for every composer (feed, tribe, check-in).
 * - Rounded frame + hairline border that matches PostMedia.
 * - Springy scale-in entrance (no abrupt pop).
 * - 40px remove button (real tap target) vs the old 24px ✕.
 * - "ready · 1.2 MB" hint so the user knows it's attached.
 * - Optional upload-progress overlay with an animated bar + phase label.
 */
const MediaPreview = ({ imageSrc, videoSrc, sizeBytes, onClear, progressLabel, className }: MediaPreviewProps) => {
  if (!imageSrc && !videoSrc) return null;
  const uploading = !!progressLabel;

  return (
    <div
      className={cn("relative mt-3 rounded-2xl overflow-hidden border border-border/60 bg-black/20", className)}
      style={{ animation: "scale-in 0.24s var(--ease-spring, cubic-bezier(0.16,1.2,0.32,1))" }}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="Selected media preview" className="w-full max-h-60 object-cover" />
      ) : (
        <video src={videoSrc!} controls playsInline className="w-full max-h-60 object-contain bg-black" />
      )}

      {/* Remove — large 40px tap target */}
      {!uploading && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove media"
          className="absolute top-2.5 right-2.5 h-10 w-10 rounded-full bg-black/55 backdrop-blur-sm border border-white/15 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <X size={18} />
        </button>
      )}

      {/* "ready" hint */}
      {!uploading && (
        <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-[11px] font-semibold text-white/90 tracking-wide">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(152_55%_55%)]" />
          Ready{sizeBytes ? ` · ${fmtSize(sizeBytes)}` : ""}
        </div>
      )}

      {/* Upload progress overlay */}
      {uploading && (
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2.5">
          <Loader2 size={22} className="text-white animate-spin" />
          <p className="text-[12px] font-bold text-white tracking-wide">{progressLabel}</p>
          <div className="h-1 w-32 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-white/85 animate-[shimmer-slide_1.1s_ease-in-out_infinite]" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPreview;
