import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { setsDoneFor, type SessionExercise, type LoggedSet } from "@/lib/training/runner";

/**
 * The whole session, at a glance, and a way into any part of it.
 *
 * The runner shows one movement at a time, which is right while you are under
 * a bar. What it could not show was the shape of the rest of the day, and
 * because the only control was "Next", moving on was a one-way door: the
 * movement you left was marked skipped, and the sole way back was to finish
 * the session and press "Keep training", which cleared every skip at once.
 *
 * Collapsed by default. Somebody working the day in order should never have to
 * look at this, and the header line it replaces already said "Exercise 3 of 6".
 */
export const SessionOverview = ({
  plan,
  logged,
  skipped,
  onStage,
  open,
  onToggle,
  onPick,
}: {
  plan: SessionExercise[];
  logged: Record<string, LoggedSet[]>;
  skipped: ReadonlySet<string>;
  /** Slug of the movement currently on stage. */
  onStage: string | null;
  open: boolean;
  onToggle: () => void;
  onPick: (slug: string) => void;
}) => {
  const doneCount = plan.filter((e) => setsDoneFor(e, logged[e.slug]) >= e.sets).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => { hapticImpact("light"); onToggle(); }}
        aria-expanded={open}
        className="press-row min-h-11 w-full flex items-center gap-1.5 text-left"
      >
        <span className="text-label font-bold text-muted-foreground">
          {doneCount} of {plan.length} done
        </span>
        <ChevronDown
          aria-hidden
          size={12}
          className={cn("text-muted-foreground/75 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="mb-1 divide-y divide-border/35 border-y border-border/30">
          {plan.map((ex) => {
            const done = setsDoneFor(ex, logged[ex.slug]);
            const complete = done >= ex.sets;
            const isSkipped = skipped.has(ex.slug);
            const isOnStage = ex.slug === onStage;
            return (
              <li key={ex.slug}>
                <button
                  type="button"
                  onClick={() => { hapticImpact("light"); onPick(ex.slug); }}
                  aria-current={isOnStage ? "true" : undefined}
                  className="press-row w-full min-h-12 flex items-center gap-2.5 py-2 text-left"
                >
                  <span
                    className={cn(
                      "flex-1 min-w-0 text-meta font-bold leading-snug line-clamp-2",
                      isOnStage ? "text-gold" : complete ? "text-foreground/85" : "text-foreground/85",
                    )}
                  >
                    {ex.name}
                  </span>
                  {isSkipped && !complete && (
                    <span className="text-label font-bold text-muted-foreground shrink-0">Skipped</span>
                  )}
                  <span
                    className={cn(
                      "text-meta font-bold tabular-nums shrink-0 inline-flex items-center gap-1",
                      complete ? "text-xp-green" : "text-foreground/85",
                    )}
                  >
                    {complete && <Check aria-hidden size={12} />}
                    {done}/{ex.sets}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SessionOverview;
