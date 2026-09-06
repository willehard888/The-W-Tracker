import { isRestDay } from "@/lib/training/session";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { CoachProgram, ProgramLog } from "@/hooks/use-coach-program";

interface Props {
  program: CoachProgram;
  currentWeek: number;
  todayDayIndex: number;
  logs: ProgramLog[];
  onSelect?: (dayIndex: number) => void;
}

const SHORT = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The current week as seven tiles. No box and no header: the beat above
 * already names the week, and the only colour is the gold dot on a day that
 * was actually done.
 */
const WeekStrip = ({ program, currentWeek, todayDayIndex, logs, onSelect }: Props) => {
  const week = program.plan_json.weeks.find((w) => w.week === currentWeek);
  if (!week) return null;

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {week.days.map((d, i) => {
        const done = logs.some((l) => l.week === currentWeek && l.day_index === i && l.completed);
        const isToday = i === todayDayIndex;
        const isRest = isRestDay(d);
        // Only a real handler makes these buttons. `CoachProgramDetail`
        // renders the strip WITHOUT `onSelect`, so without a handler each
        // tile is what it actually is: a read-only day, announced as one.
        const label = `${SHORT[i]}${isToday ? " · today" : ""}${done ? " · done" : isRest ? " · rest" : ""}`;
        const className = cn(
          "min-h-11 rounded-xl py-2 text-center border transition-colors",
          isToday ? "border-foreground/30 bg-secondary/40" : "border-border/30 bg-background/30",
        );
        const inner = (
          <>
            <p className={cn(
              "text-[11px] font-bold leading-none",
              isToday ? "text-foreground" : "text-muted-foreground/70",
            )}>
              {SHORT[i]}
            </p>
            <div className="flex items-center justify-center h-3 mt-1">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                done ? "bg-gold shadow-[0_0_6px_hsl(var(--gold))]" : isRest ? "bg-muted-foreground/30" : "bg-foreground/40",
              )} />
            </div>
          </>
        );

        return onSelect ? (
          <button
            key={i}
            type="button"
            aria-label={label}
            onClick={() => { hapticImpact("light"); onSelect(i); }}
            className={cn("press", className)}
          >
            {inner}
          </button>
        ) : (
          <div key={i} role="img" aria-label={label} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
};

export default WeekStrip;
