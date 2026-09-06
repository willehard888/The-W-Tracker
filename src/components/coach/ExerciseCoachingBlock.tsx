import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FactRow } from "@/components/coach/rows";
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
 * heading — most of the 269 illustrated movements are still in that state.
 *
 * Type on the page, not boxes: facts are FactRows, mistakes are hairline
 * rows, and gold is spent on the numbered cues alone.
 */

const Label = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-bold text-muted-foreground mb-2">{children}</p>
);

/** Tempo and breathing: the two things a still picture cannot show. */
const Rhythm = ({ c, compact }: { c: ExerciseCoaching; compact?: boolean }) => (
  <div className="divide-y divide-border/35 border-t border-border/35">
    <FactRow k="Tempo" v={c.tempo} />
    {!compact && <FactRow k="Breathing" v={c.breathing} />}
  </div>
);

/**
 * A mistake and its fix, always together. "Your knees cave in" on its own just
 * makes a beginner anxious about a problem they have no answer to.
 */
const Mistake = ({ m }: { m: ExerciseCoaching["mistakes"][number] }) => (
  <li className="py-2.5">
    <p className="flex gap-2 text-[13px] font-semibold leading-snug">
      <AlertTriangle size={13} className="shrink-0 mt-px text-ember-light" aria-hidden />
      {m.error}
    </p>
    <p className="mt-1 pl-[21px] text-[13px] text-muted-foreground leading-snug">{m.fix}</p>
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
      <Rhythm c={c} />

      <section>
        <Label>Set up</Label>
        <ul className="space-y-1.5">
          {c.setup.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-foreground/85 leading-snug">
              <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mt-[7px]" aria-hidden />
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
        <ul className="divide-y divide-border/35">
          {c.mistakes.map((m, i) => (
            <Mistake key={i} m={m} />
          ))}
        </ul>
      </section>

      <div className="divide-y divide-border/35 border-t border-border/35">
        <FactRow k="Feel it" v={c.feelIt} />
        <FactRow k="Easier" v={c.easier} />
        <FactRow k="Harder" v={c.harder} />
      </div>
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
          <span className="shrink-0 h-4 w-4 rounded-full bg-gold/15 text-gold text-[10px] font-black flex items-center justify-center mt-px" aria-hidden>
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
