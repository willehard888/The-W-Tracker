import { ImgHTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";
import { transformImage } from "@/lib/img";

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
 * - optional aspect-ratio box reserves space (no layout shift / jump)
 *
 * Pass the ORIGINAL url to a lightbox separately — this only sizes the thumb.
 */
export const AppImage = ({
  src,
  width = 600,
  aspectRatio,
  quality = 72,
  className,
  alt = "",
  style,
  ...rest
}: AppImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const finalSrc = transformImage(src, { width, quality, resize: "cover" });
  return (
    <img
      src={finalSrc || undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn("transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)}
      style={{ aspectRatio, ...style }}
      {...rest}
    />
  );
};

export default AppImage;
