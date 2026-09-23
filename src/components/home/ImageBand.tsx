// A full-width image, edge to edge, with the type sitting under it.
//
// WHY THIS EXISTS
//
// Home was eight bordered cards stacked to 1 300px — every block the same
// rounded rectangle, so nothing led. The house already knew the answer: Diary,
// Messages, the feed and Leaderboard are all "type on the page, hairline rows,
// no cards". Home was the last screen still boxed.
//
// This is the other half of that grammar. Where a block has a real picture, the
// picture IS the block: it bleeds past the page gutter, the type hangs beneath
// it, and there is no frame around either.
//
// HONEST IMAGERY ONLY
//
// The band takes a src. It never invents one. Home shows a photograph only
// where one is true — a recipe you could actually cook, the drawing of the
// movement you are actually prescribed. A stock photo of somebody else's gym
// beside your numbers would be a claim about your day, and the founder's own
// brief rules that out.
import { cn } from "@/lib/utils";

export interface ImageBandProps {
  src: string;
  /** Empty string for decoration; a real sentence when the picture carries meaning. */
  alt: string;
  /**
   * `cover` fills the band — photographs, which have a subject anywhere.
   * `contain` fits it — the exercise drawings, which are one figure centred on
   * black and lose their legs to a crop.
   */
  fit?: "cover" | "contain";
  /** Tailwind aspect class. Photographs read wider; a single figure reads taller. */
  aspect?: string;
  /** The first band on the screen may load eagerly; everything below waits. */
  eager?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function ImageBand({
  src,
  alt,
  fit = "cover",
  aspect = "aspect-[16/9]",
  eager = false,
  className,
  children,
}: ImageBandProps) {
  return (
    // -mx-4 cancels the page gutter: the picture reaches both edges while the
    // type under it stays on the column.
    <div className={cn("-mx-4 relative", className)}>
      <div className={cn("relative w-full overflow-hidden bg-black", aspect)}>
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain p-6")}
        />
        {/* The picture ends in the page's own ground instead of a hard edge, so
            the band reads as part of the screen rather than a pasted tile. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"
        />
      </div>
      {children && <div className="px-4">{children}</div>}
    </div>
  );
}
