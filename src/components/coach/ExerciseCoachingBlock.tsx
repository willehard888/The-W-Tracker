import { AlertTriangle, ArrowDown, ArrowUp, Target, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { coachingFor, type ExerciseCoaching } from "@/data/exercise-coaching";

/**
 * Renders the coaching layer for one exercise, in two densities.
 *
 * The library detail (`full`) is where someone is LEARNING the movement, so it
 * gets everything. The workout row (`compact`) is read between sets with a
 * loaded bar nearby — nobody reads an essay there, so it gets the rhythm, the
 * one cue that matters most, and the single most common mistake.
 *
 * Both read the same `EXERCISE_COACHING` entry. Nothing is written twice, and
 * an exercise without coaching renders nothing at all rather than an empty
 * heading — 229 of the 269 illustrated movements are still in that state.
 */

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="eyebrow text-gold/85 mb-2">{children}</p>
);

/** Tempo and breathing: the two things a still picture cannot show. */
const Rhythm = ({ c, compact }: { c: ExerciseCoaching; compact?: boolean }) => (
  <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
    <div className="rounded-xl border border-gold/20 bg-gold/[0.05] px-3 py-2.5">
      <p className="eyebrow text-gold/70 mb-1">Tempo</p>
      <p className="text-[12.5px] text-foreground/90 leading-snug">{c.tempo}</p>
    </div>
    {!compact && (
      <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
        <p className="eyebrow text-muted-foreground/70 mb-1 inline-flex items-center gap-1">
          <Wind size={11} /> Breathing
        </p>
        <p className="text-[12.5px] text-foreground/85 leading-snug">{c.breathing}</p>
      </div>
    )}
  </div>
);

/**
 * A mistake and its fix, always together. "Your knees cave in" on its own just
 * makes a beginner anxious about a problem they have no answer to.
 */
const Mistake = ({ m }: { m: ExerciseCoaching["mistakes"][number] }) => (
  <li className="rounded-xl border border-border/40 bg-background/30 px-3 py-2.5">
    <p className="flex gap-2 text-[12.5px] font-bold text-ember-light leading-snug">
      <AlertTriangle size={13} className="shrink-0 mt-px" />
      {m.error}
    </p>
    <p className="mt-1.5 pl-[21px] text-[12.5px] text-foreground/85 leading-snug">{m.fix}</p>
  </li>
);

/** The full block, for the library detail. */
export const ExerciseCoachingBlock = ({
  slug,
  className,
}: {
  slug?: string | null;
  className?: string;
}) => {
  const c = coachingFor(slug);
  if (!c) return null;

  return (
    <div className={cn("space-y-5", className)}>
      <section>
        <Label>Rhythm</Label>
        <Rhythm c={c} />
      </section>

      <section>
        <Label>Set up</Label>
        <ul className="space-y-1.5">
          {c.setup.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-foreground/85 leading-snug">
              <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-gold/60 mt-[7px]" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Label>Key cues</Label>
        <ol className="space-y-1.5">
          {c.cues.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-foreground/85 leading-snug">
              <span className="shrink-0 h-5 w-5 rounded-full bg-gold/15 text-gold text-[11px] font-black flex items-center justify-center mt-px">
                {i + 1}
              </span>
              <span className={cn(i === 0 && "text-foreground font-semibold")}>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <Label>Common mistakes</Label>
        <ul className="space-y-2">
          {c.mistakes.map((m, i) => (
            <Mistake key={i} m={m} />
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-gold/20 bg-gradient-to-b from-gold/[0.06] to-transparent px-3 py-2.5">
        <p className="eyebrow text-gold/80 mb-1 inline-flex items-center gap-1">
          <Target size={11} /> Where you should feel it
        </p>
        <p className="text-[12.5px] text-foreground/90 leading-snug">{c.feelIt}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
          <p className="eyebrow text-muted-foreground/70 mb-1 inline-flex items-center gap-1">
            <ArrowDown size={11} /> Too hard? Try
          </p>
          <p className="text-[12.5px] text-foreground/85 leading-snug">{c.easier}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
          <p className="eyebrow text-muted-foreground/70 mb-1 inline-flex items-center gap-1">
            <ArrowUp size={11} /> Ready for more?
          </p>
          <p className="text-[12.5px] text-foreground/85 leading-snug">{c.harder}</p>
        </div>
      </section>
    </div>
  );
};

/** Tempo, the top cue and the single worst mistake — for mid-workout. */
export const ExerciseCoachingCompact = ({ slug }: { slug?: string | null }) => {
  const c = coachingFor(slug);
  if (!c) return null;

  return (
    <div className="space-y-2">
      <Rhythm c={c} compact />
      {c.cues[0] && (
        <p className="flex gap-2 text-[12.5px] text-foreground/90 leading-snug">
          <span className="shrink-0 h-4 w-4 rounded-full bg-gold/15 text-gold text-[10px] font-black flex items-center justify-center mt-px">
            !
          </span>
          <span className="font-semibold">{c.cues[0]}</span>
        </p>
      )}
      {c.mistakes[0] && (
        <ul className="list-none">
          <Mistake m={c.mistakes[0]} />
        </ul>
      )}
    </div>
  );
};
