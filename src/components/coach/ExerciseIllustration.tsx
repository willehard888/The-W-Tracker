import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
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

/**
 * The movement, moving.
 *
 * Every illustrated exercise ships TWO states — `relaxation` and `tension` —
 * and until now they were rendered as two stills side by side, labelled Start
 * and Finish, with nothing in between. A library that promises "illustrated
 * technique guides" showed the two ends of a rep and left the athlete to
 * imagine the rep.
 *
 * Cross-fading them is the whole trick: both frames are already fetched for
 * the static hero, so this costs no new bytes, no new asset pipeline and no
 * video infrastructure. It animates opacity only, which the compositor
 * handles without layout or repaint.
 *
 * Deliberately NOT used in the list. A grid of perpetually looping tiles is
 * exactly the idle motion this codebase spends guards on suppressing; here
 * the motion IS the information, and it appears on one element that the
 * screen is about. It still pauses when scrolled out of view, and the athlete
 * can stop it — a demonstration you cannot pause is worse than a still.
 */
export const IllustrationPlayer = ({ ex, className }: { ex: IllustratedExercise; className?: string }) => {
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // Off-screen frames keep animating otherwise — the same discipline the feed
  // applies to video, for the same reason.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Reduced motion gets the honest fallback: both positions, side by side,
  // which is what this screen showed before. Nothing is hidden from them.
  if (reduced) return <IllustrationHero ex={ex} className={className} />;

  const running = playing && inView;

  return (
    <div ref={hostRef} className={cn("relative", className)}>
      <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-black">
        {/* Blur-up base from the bundled thumb, so the tile is never empty
            while the two 480px states arrive over the network. */}
        <img
          src={illustrationThumb(ex.idNum)}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain p-4 blur-[6px] opacity-50"
          style={{ filter: GOLD_LINES }}
        />

        {(["relaxation", "tension"] as const).map((state) => (
          <img
            key={state}
            src={illustrationImg(ex.idNum, state, 480)}
            alt={state === "relaxation" ? `${ex.title} — start position` : `${ex.title} — finish position`}
            loading="eager"
            decoding="async"
            className={cn(
              "w-full h-56 object-contain p-4",
              // The first frame holds the box height; the second sits on top
              // of it so the two cross-fade in place.
              state === "tension" && "absolute inset-0",
              running && (state === "relaxation" ? "rep-phase-a" : "rep-phase-b"),
            )}
            style={{ filter: GOLD_LINES, ...(running ? undefined : { opacity: state === "tension" ? 0 : 1 }) }}
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = illustrationUrl(ex.idNum, state); }
            }}
          />
        ))}

        <div aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause the movement" : "Play the movement"}
          className="absolute bottom-2 right-2 h-11 w-11 rounded-full bg-background/70 border border-border/60 flex items-center justify-center text-gold"
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <span className="absolute bottom-4 left-4 eyebrow text-gold/70">
          {playing ? "Full rep" : "Start position"}
        </span>
      </div>
    </div>
  );
};

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
