import { ImgHTMLAttributes, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { transformImage } from "@/lib/img";
import { isPrivateStorageUrl, useSignedMediaUrl } from "@/lib/signed-url";

interface AppImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  /** Rendered width in CSS px — drives the Supabase transform (retina applied). */
  width?: number;
  /** Reserve space to avoid layout shift, e.g. "1 / 1", "4 / 3", "16 / 9". */
  aspectRatio?: string;
  quality?: number;
}

/**
 * One image primitive for CONTENT images (feed/tribe/proof thumbnails).
 * - lazy-loads + async-decodes (off-screen images don't block scroll)
 * - right-sizes via Supabase transform (no multi-MB original for a thumb)
 * - fades in on load (no hard cut / flicker)
 * - FALLS BACK to the original object URL if the transform fails (a failed
 *   transform — e.g. HEIC or a non-transformable bucket — must not leave a
 *   permanently-invisible "black box"). If that also fails, we still un-hide
 *   the element so the broken-image state is visible, not a silent void.
 */
export const AppImage = ({
  src,
  width = 600,
  aspectRatio,
  quality = 82,
  className,
  alt = "",
  style,
  ...rest
}: AppImageProps) => {
  // Private-bucket media (proof-photos / feed-images since the S7 flip)
  // can't render from the public endpoint — resolve a signed URL, with the
  // resize baked into the same signature. Public/external URLs skip this.
  const isPrivate = isPrivateStorageUrl(src);
  const signed = useSignedMediaUrl(isPrivate ? src : null, { width, quality });
  const transformed = isPrivate ? signed : transformImage(src, { width, quality, resize: "cover" });
  const original = (isPrivate ? signed : src) || undefined;

  const [loaded, setLoaded] = useState(false);
  // "transform" → optimized URL; "original" → fell back; "failed" → both failed.
  const [stage, setStage] = useState<"transform" | "original" | "failed">("transform");

  // Reset when the source changes (virtualized list recycling).
  useEffect(() => {
    setLoaded(false);
    setStage("transform");
  }, [src]);

  const currentSrc = stage === "transform" ? (transformed || original) : original;

  const handleError = () => {
    if (stage === "transform" && original && original !== transformed) {
      setStage("original"); // retry with the un-transformed original
    } else {
      setStage("failed");
      setLoaded(true); // un-hide so it's not a silent black box
    }
  };

  return (
    <img
      src={currentSrc || undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={handleError}
      className={cn("transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)}
      style={{ aspectRatio, ...style }}
      {...rest}
    />
  );
};

export default AppImage;
