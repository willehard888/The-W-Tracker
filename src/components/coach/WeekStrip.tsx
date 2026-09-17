import { Check } from "lucide-react";
import { isRestDay } from "@/lib/training/session";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import type { ProgramLog, ProgramWeek } from "@/hooks/use-coach-program";

interface Props {
  week: ProgramWeek;
  /** The day the card below is showing. */
  selected: number;
  /** Today's index when this is the week the athlete is in, else -1. */
  today: number;
  logs: ProgramLog[];
  onSelect: (dayIndex: number) => void;
}

const SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * The week as seven tiles, and the page's one day selector: the card below
 * shows whichever day is picked here, so the week is never listed twice.
 * A tile says what the day is without colour alone: a tick for done, a dot
 * for a session, a dash for rest. Today keeps a bright letter when another
 * day is selected.
 */
const WeekStrip = ({ week, selected, today, logs, onSelect }: Props) => (
  <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`Week ${week.week} days`}>
    {week.days.map((d, i) => {
      const done = logs.some((l) => l.week === week.week && l.day_index === i && l.completed);
      const isToday = i === today;
      const isRest = isRestDay(d);
      const active = i === selected;
      return (
        <button
          key={i}
          type="button"
          aria-pressed={active}
          aria-label={`${NAMES[i]}${isToday ? ", today" : ""}, ${done ? "done" : isRest ? "rest" : d.focus}`}
          onClick={() => { if (!active) { hapticSelection(); onSelect(i); } }}
          className={cn(
            "press min-h-12 rounded-xl py-2 text-center border transition-colors",
            active ? "border-foreground/40 bg-secondary/60" : "border-border/30 bg-background/30",
          )}
        >
          <span className={cn(
            "block text-label font-bold leading-none",
            active || isToday ? "text-foreground" : "text-muted-foreground/75",
          )}>
            {SHORT[i]}
          </span>
          <span className="flex items-center justify-center h-3.5 mt-1.5" aria-hidden>
            {done ? <Check size={12} strokeWidth={3} className="text-gold" />
              : isRest ? <span className="h-px w-2 bg-muted-foreground/40" />
              : <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />}
          </span>
          {/* Today, said once and small, so the selection can move off it. */}
          <span className={cn("block h-0.5 w-3 mx-auto mt-1 rounded-full", isToday ? "bg-ember" : "bg-transparent")} aria-hidden />
        </button>
      );
    })}
  </div>
);

export default WeekStrip;
