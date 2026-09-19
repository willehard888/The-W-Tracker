import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { illustrationUrl, illustrationImg } from "@/data/illustration-urls";
import type { IllustratedExercise } from "@/data/exercises-illustrated";
import { BUNDLED_FRAME_IDS } from "@/data/illustration-frame-ids";
import { GOLD_LINES, goldThumb } from "./gold-lines";

const STATES = ["relaxation", "tension"] as const;
// The blur-up base. One `filter` value: a Tailwind blur class and an inline
// gold filter both write `filter`, and the inline one won — the base was never
// blurred, just a 112px thumb scaled up.
// The blur-up base is the baked gold thumbnail: only the blur is left to do.
const THUMB_WASH = "blur(6px)";
type FrameState = (typeof STATES)[number];
/** What a drawing needs: its frame id and a name for the alt text. Recovery
 *  movements are drawn in the same set without being strength exercises. */
type Drawn = Pick<IllustratedExercise, "idNum" | "title">;

/**
 * The technique frame. Every movement the coach can prescribe ships its two
 * vectors in the app (offline, instant, crisp at any pixel density); the rest
 * of the library draws the same vector from the CDN. The 480px raster proxy
 * that used to sit in between was the lag: two network rasterisations per
 * movement, on gym wifi, every time the exercise changed.
 */
export const illustrationFrame = (idNum: string, state: FrameState): string =>
  BUNDLED_FRAME_IDS.has(idNum) ? `/illustrations/frames/${idNum}-${state}.svg` : illustrationUrl(idNum, state);

/** Warm a movement's frames so a swap or the next exercise lands drawn. */
export const preloadIllustration = (ex: Drawn): void => {
  if (typeof Image !== "function") return;
  for (const state of STATES) { const img = new Image(); img.src = illustrationFrame(ex.idNum, state); }
};

/**
 * One movement's two frames. The player keys this by the movement, so a swap
 * unmounts the old pair at once — the old bitmaps used to stay on screen
 * under the new ones while they loaded — and the new pair fades in only once
 * both frames have decoded. Until then the blurred thumb holds the tile.
 */
const Frames = ({ ex, running }: { ex: Drawn; running: boolean }) => {
  const [ready, setReady] = useState(false);
  const loaded = useRef(new Set<FrameState>());
  const mark = (state: FrameState) => {
    loaded.current.add(state);
    if (loaded.current.size >= STATES.length) setReady(true);
  };
  return (
    <div className={cn("absolute inset-0 transition-opacity duration-300 ease-out", ready ? "opacity-100" : "opacity-0")}>
      {STATES.map((state) => (
        <img
          key={state}
          // A cached frame can complete before React attaches onLoad.
          ref={(img) => { if (img && img.complete && img.naturalWidth > 0) mark(state); }}
          src={illustrationFrame(ex.idNum, state)}
          alt={state === "relaxation" ? `${ex.title} — start position` : `${ex.title} — finish position`}
          loading="eager"
          decoding="async"
          onLoad={() => mark(state)}
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = illustrationUrl(ex.idNum, state); }
            else mark(state);
          }}
          className={cn(
            "absolute inset-0 w-full h-full object-contain p-4",
            running && (state === "relaxation" ? "rep-phase-a" : "rep-phase-b"),
          )}
          style={{ filter: GOLD_LINES, ...(running ? undefined : { opacity: state === "tension" ? 0 : 1 }) }}
        />
      ))}
    </div>
  );
};

/**
 * Everkinetic technique illustration, rendered in brand: the source SVGs are
 * black line art on white — an invert + sepia filter chain turns them into
 * GOLD lines on the dark tile, so all ~270 drawings read as one bespoke
 * Whealth Factory illustration set. (Source CC BY-SA 4.0 — attribution lives
 * in the library footer.)
 */

export const IllustrationThumb = ({ ex, size = 56, className, eager = false }: { ex: Drawn; size?: number; className?: string; eager?: boolean }) => (
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
      src={goldThumb(ex.idNum)}
      alt=""
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      className="h-full w-full object-contain p-1"
      onError={(e) => {
        // Bundled file should always exist; network is a two-stage fallback,
        // and the network image is the raw drawing, so it gets the filter.
        const img = e.currentTarget;
        if (!img.dataset.fb) { img.dataset.fb = "1"; img.style.filter = GOLD_LINES; img.src = illustrationImg(ex.idNum, "tension", 112); }
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
export const IllustrationPlayer = ({
  ex,
  className,
  playingLabel = "Full rep",
}: {
  ex: Drawn;
  className?: string;
  /** A stretch moves into a position rather than through a rep. */
  playingLabel?: string;
}) => {
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
      <div className="relative h-56 overflow-hidden rounded-2xl border border-gold/25 bg-black">
        {/* Blur-up base from the bundled thumb: the tile is never empty in
            the frame or two before the vectors have decoded. */}
        <img
          key={`thumb-${ex.idNum}`}
          src={goldThumb(ex.idNum)}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain p-4 opacity-50"
          style={{ filter: THUMB_WASH }}
        />

        <Frames key={`frames-${ex.idNum}`} ex={ex} running={running} />

        <div aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause the movement" : "Play the movement"}
          className="absolute bottom-2 right-2 h-11 w-11 rounded-full bg-background/70 border border-border/60 flex items-center justify-center text-gold"
        >
          {playing ? <Pause aria-hidden size={15} /> : <Play aria-hidden size={15} />}
        </button>

        <span className="absolute bottom-4 left-4 text-label font-bold text-gold/70">
          {playing ? playingLabel : "Start position"}
        </span>
      </div>
    </div>
  );
};

/** Detail hero: the two technique states, Start → Finish. */
export const IllustrationHero = ({ ex, className }: { ex: Drawn; className?: string }) => (
  <div className={cn("grid grid-cols-2 gap-2", className)}>
    {(["relaxation", "tension"] as const).map((state, i) => (
      <div key={state} className="relative overflow-hidden rounded-2xl border border-gold/25 bg-black">
        {/* Instant blur-up base from the bundled thumb — no empty frame while
            the vector decodes. */}
        <img
          key={`thumb-${ex.idNum}`}
          src={goldThumb(ex.idNum)}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain p-3 opacity-60"
          style={{ filter: THUMB_WASH }}
        />
        <img
          key={`${ex.idNum}-${state}`}
          src={illustrationFrame(ex.idNum, state)}
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
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-label font-bold text-gold/70">
          {i === 0 ? "Start" : "Finish"}
        </span>
        <div aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </div>
    ))}
  </div>
);
