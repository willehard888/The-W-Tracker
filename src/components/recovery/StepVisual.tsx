// What the runner shows for the step in hand, beyond the timer ring:
//
//   drawn movement   the same two-frame player as the exercise library
//   breathing        a pacer that fills on in, holds, and empties on out
//   guided           the cue for this moment, over a slow breathing orb
//
// Every one of them reads elapsed time from the runner's deadline clock, so a
// phone that locked mid-hold comes back on the right breath and the right cue.
// The circle moves by CSS transitions set once per phase, not an infinite
// keyframe: the touch-device kill-switch in index.css stops those, and a pacer
// that stands still is a pacer that lies.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import { breathFullness, breathPhase, cueIndex, cycleSec, pacerScale } from "@/lib/recovery/pace";
import { illustrationFrame } from "@/components/coach/ExerciseIllustration";
import { GOLD_LINES, goldThumb } from "@/components/coach/gold-lines";
import type { BreathPhase } from "@/data/recovery";

// ── The chime ───────────────────────────────────────────────────────────────
// One soft sine note when a guided cue changes, for eyes that are closed.
// WebAudio needs a gesture to start on iOS, so Start opens the context; the
// ring/silent switch mutes it, which is what you want in bed.
type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

export const armChime = (): void => {
  try {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext);
    if (!Ctor) return;
    ctx ??= new Ctor();
    void ctx.resume();
  } catch {
    ctx = null;
  }
};

const chime = (): void => {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 528;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.06, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 1.7);
};

// ── The pacer ───────────────────────────────────────────────────────────────
const WORD: Record<BreathPhase[0], string> = { In: "Breathe in", Hold: "Hold", Out: "Breathe out" };
const EASE = "cubic-bezier(0.37, 0, 0.63, 1)";
const easeInOut = (t: number) => -(Math.cos(Math.PI * Math.min(1, Math.max(0, t))) - 1) / 2;

/** Where in the current phase the clock is, and what the pacer aims at. */
const phaseAt = (pace: BreathPhase[], elapsedMs: number) => {
  const point = breathPhase(pace, elapsedMs);
  const cycleMs = cycleSec(pace) * 1000;
  const intoCycle = Math.max(0, elapsedMs) % cycleMs;
  const phaseStart = pace.slice(0, point.index).reduce((sum, [, s]) => sum + s * 1000, 0);
  const phaseMs = point.sec * 1000;
  const phaseElapsed = intoCycle - phaseStart;
  const prev = (point.index - 1 + pace.length) % pace.length;
  return { point, cycleMs, phaseMs, phaseElapsed, prev, remaining: Math.max(0, phaseMs - phaseElapsed) };
};

/**
 * Running: aim at the end of this phase and let one CSS transition carry it
 * there. Paused: sit exactly where the breath was. The first frame always
 * paints where the breath actually is, so there is something to move from —
 * aiming straight at the target on mount drew a full circle under "Breathe in".
 */
const useArmed = () => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return armed;
};

/**
 * The drawing, breathing on the same clock as the ring.
 *
 * The library's player cross-fades its two frames every 2.4 s regardless —
 * right for a rep, wrong for a breath, where a figure that never settles
 * reads as cheap. Here the exhaled frame is the resting state and the
 * inhaled frame fades in over the in-breath, holds, and fades out over the
 * out-breath, so what the athlete sees is the pace they are following.
 */
export function BreathFigure({
  art,
  title,
  pace,
  elapsedMs,
  running,
  className,
}: {
  art: string;
  title: string;
  pace: BreathPhase[];
  elapsedMs: number;
  running: boolean;
  className?: string;
}) {
  const { point, phaseMs, phaseElapsed, prev, remaining } = phaseAt(pace, elapsedMs);
  const armed = useArmed();
  const from = breathFullness(pace, prev);
  const to = breathFullness(pace, point.index);
  const here = from + (to - from) * easeInOut(phaseElapsed / phaseMs);
  const full = running && armed ? to : here;
  const transition = running && armed ? `opacity ${remaining}ms ${EASE}` : "none";
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-gold/25 bg-black", className)} aria-hidden>
      <img
        src={goldThumb(art)}
        alt=""
        decoding="async"
        className="absolute inset-0 w-full h-full object-contain p-4 opacity-50"
        style={{ filter: "blur(6px)" }}
      />
      <img
        src={illustrationFrame(art, "relaxation")}
        alt={`${title} — breathed out`}
        loading="eager"
        decoding="async"
        className="absolute inset-0 w-full h-full object-contain p-4 motion-reduce:!transition-none"
        style={{ filter: GOLD_LINES, opacity: 1 - full, transition }}
      />
      <img
        src={illustrationFrame(art, "tension")}
        alt={`${title} — breathed in`}
        loading="eager"
        decoding="async"
        className="absolute inset-0 w-full h-full object-contain p-4 motion-reduce:!transition-none"
        style={{ filter: GOLD_LINES, opacity: full, transition }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
    </div>
  );
}

export function BreathPacer({
  pace,
  elapsedMs,
  running,
  quiet = false,
}: {
  pace: BreathPhase[];
  elapsedMs: number;
  running: boolean;
  /** Under a guided cue: smaller, dimmer, no words, no haptics. */
  quiet?: boolean;
}) {
  const { point, cycleMs, phaseMs, phaseElapsed, prev, remaining } = phaseAt(pace, elapsedMs);
  const from = pacerScale(pace, prev);
  const to = pacerScale(pace, point.index);
  const armed = useArmed();
  const here = from + (to - from) * easeInOut(phaseElapsed / phaseMs);
  const scale = running && armed ? to : here;
  const transition = running && armed ? `transform ${remaining}ms ${EASE}` : "none";

  const beat = Math.floor(Math.max(0, elapsedMs) / cycleMs) * pace.length + point.index;
  const lastBeat = useRef(beat);
  useEffect(() => {
    if (beat === lastBeat.current) return;
    lastBeat.current = beat;
    if (running && !quiet) hapticSelection();
  }, [beat, running, quiet]);

  const size = quiet ? "h-28 w-28" : "h-40 w-40";
  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative grid place-items-center", size)} aria-hidden>
        <div className="absolute inset-0 rounded-full border border-gold/20" />
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-gold/[0.14] border border-gold/50 motion-reduce:!transition-none",
            quiet && "opacity-60",
          )}
          style={{ transform: `scale(${scale})`, transition }}
        />
        {!quiet && (
          <span className="relative font-display font-black text-beat tabular-nums">
            {Math.max(1, Math.ceil((phaseMs - phaseElapsed) / 1000))}
          </span>
        )}
      </div>
      {!quiet && (
        <p className="mt-4 text-read font-bold" aria-live="polite">
          {WORD[point.label]}
        </p>
      )}
    </div>
  );
}

// ── Guided ──────────────────────────────────────────────────────────────────
/** An unhurried in-and-out behind a guided cue; nothing to follow. */
export const ORB_PACE: BreathPhase[] = [["In", 5.5], ["Out", 5.5]];

export function GuidedCue({
  cues,
  elapsedMs,
  running,
  figure,
}: {
  cues: [number, string][];
  elapsedMs: number;
  running: boolean;
  /** The session's drawing; it breathes at the orb's pace in place of the orb. */
  figure?: { art: string; title: string };
}) {
  const index = cueIndex(cues, elapsedMs);
  const shown = useRef(index);
  useEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    if (!running) return;
    hapticSelection();
    chime();
  }, [index, running]);

  return (
    <div className="flex flex-col items-center text-center">
      {figure ? (
        <BreathFigure art={figure.art} title={figure.title} pace={ORB_PACE} elapsedMs={elapsedMs} running={running} className="h-40 w-full" />
      ) : (
        <BreathPacer pace={ORB_PACE} elapsedMs={elapsedMs} running={running} quiet />
      )}
      <p key={index} className="mt-6 min-h-[4.5rem] text-lead font-bold leading-snug text-balance animate-fade-in" aria-live="polite">
        {cues[index][1]}
      </p>
    </div>
  );
}
