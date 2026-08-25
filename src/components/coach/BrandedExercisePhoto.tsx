import { cn } from "@/lib/utils";
import { exerciseImgBranded } from "@/lib/exercise-library";

interface BrandedExercisePhotoProps {
  /** Raw library image URL. */
  src?: string | null;
  alt?: string;
  /** Proxy width. */
  width?: number;
  className?: string;
  imgClassName?: string;
}

/**
 * Technique photos, on brand. The library's source images come from hundreds
 * of different gyms (red walls, harsh flash — founder: "halpa vaikutelma").
 * Every photo is served greyscale and colorized here with a gold
 * color-blend + dark vignette, so all of them share one Whealth Factory
 * duotone regardless of where they were shot.
 */
const BrandedExercisePhoto = ({ src, alt = "", width = 720, className, imgClassName }: BrandedExercisePhotoProps) => {
  const branded = exerciseImgBranded(src, width);
  if (!branded) return null;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-gold/25 bg-[hsl(258_16%_6%)]", className)}>
      <img
        src={branded}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("w-full h-auto object-contain grayscale", imgClassName)}
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.dataset.fb && src) { img.dataset.fb = "1"; img.src = src; }
        }}
      />
      {/* Gold colorize over the greyscale + a quiet vignette */}
      <div aria-hidden className="absolute inset-0 pointer-events-none mix-blend-color bg-[hsl(42_60%_48%)] opacity-60" />
      <div aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,hsl(258_16%_5%/0.55)_100%)]" />
      <div aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
    </div>
  );
};

export default BrandedExercisePhoto;
