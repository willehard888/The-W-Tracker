import { cn } from "@/lib/utils";
import { illustrationUrl, illustrationImg, illustrationThumb, type IllustratedExercise } from "@/data/exercises-illustrated";
import { GOLD_LINES } from "./gold-lines";

/**
 * Everkinetic technique illustration, rendered in brand: the source SVGs are
 * black line art on white — an invert + sepia filter chain turns them into
 * GOLD lines on the dark tile, so all ~270 drawings read as one bespoke
 * Whealth Factory illustration set. (Source CC BY-SA 4.0 — attribution lives
 * in the library footer.)
 */

export const IllustrationThumb = ({ ex, size = 56, className, eager = false }: { ex: IllustratedExercise; size?: number; className?: string; eager?: boolean }) => (
  <div
    aria-hidden
    className={cn(
      "shrink-0 overflow-hidden rounded-xl border border-gold/25 bg-black flex items-center justify-center",
      "shadow-[inset_0_1px_0_hsl(var(--gold)/0.12)]",
      className,
    )}
    style={{ width: size, height: size }}
  >
    <img
      src={illustrationThumb(ex.idNum)}
      alt=""
      decoding="async"
      className="h-full w-full object-contain p-1"
      style={{ filter: GOLD_LINES }}
      onError={(e) => {
        // Bundled file should always exist; network is a two-stage fallback.
        const img = e.currentTarget;
        if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = illustrationImg(ex.idNum, "tension", 112); }
        else if (img.dataset.fb === "1") { img.dataset.fb = "2"; img.src = illustrationUrl(ex.idNum, "tension"); }
      }}
    />
  </div>
);

/** Detail hero: the two technique states, Start → Finish. */
export const IllustrationHero = ({ ex, className }: { ex: IllustratedExercise; className?: string }) => (
  <div className={cn("grid grid-cols-2 gap-2", className)}>
    {(["relaxation", "tension"] as const).map((state, i) => (
      <div key={state} className="relative overflow-hidden rounded-2xl border border-gold/25 bg-black">
        {/* Instant blur-up base from the bundled thumb — no empty frame while
            the sharp 480px network image arrives. */}
        <img
          src={illustrationThumb(ex.idNum)}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain p-3 blur-[6px] opacity-60"
          style={{ filter: GOLD_LINES }}
        />
        <img
          src={illustrationImg(ex.idNum, state, 480)}
          alt={`${ex.title} — ${i === 0 ? "start" : "finish"} position`}
          loading="eager"
          decoding="async"
          className="relative w-full h-40 object-contain p-3"
          style={{ filter: GOLD_LINES }}
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = illustrationUrl(ex.idNum, state); }
          }}
        />
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 eyebrow text-gold/70">
          {i === 0 ? "Start" : "Finish"}
        </span>
        <div aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </div>
    ))}
  </div>
);
