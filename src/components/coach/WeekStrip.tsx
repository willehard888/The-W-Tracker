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

const WeekStrip = ({ program, currentWeek, todayDayIndex, logs, onSelect }: Props) => {
  const week = program.plan_json.weeks.find((w) => w.week === currentWeek);
  if (!week) return null;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-3 mb-3">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/80">
          Week {currentWeek} · {week.theme}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.days.map((d, i) => {
          const done = logs.some((l) => l.week === currentWeek && l.day_index === i && l.completed);
          const isToday = i === todayDayIndex;
          const isRest = d.focus.toLowerCase() === "rest";
          return (
            <button
              key={i}
              type="button"
              onClick={() => { hapticImpact("light"); onSelect?.(i); }}
              className={cn(
                "rounded-xl p-2 text-center border transition-all",
                isToday
                  ? "border-gold/60 bg-gradient-to-b from-gold/15 to-transparent"
                  : "border-border/30 bg-background/30",
              )}
            >
              <p className={cn(
                "text-[10px] font-black uppercase tracking-widest mb-0.5",
                isToday ? "text-gold" : "text-muted-foreground/70",
              )}>
                {SHORT[i]}
              </p>
              <div className="flex items-center justify-center h-3">
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  done ? "bg-gold shadow-[0_0_6px_hsl(var(--gold))]" : isRest ? "bg-muted-foreground/30" : "bg-foreground/40",
                )} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WeekStrip;
