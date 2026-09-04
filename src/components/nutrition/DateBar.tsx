import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, isToday, isYesterday, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** YYYY-MM-DD in the device's local calendar — the diary's day key. */
export const localDateKey = (d: Date = new Date()) => format(d, "yyyy-MM-dd");

const labelFor = (d: Date) => (isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEE, MMM d"));

/**
 * ‹ Today › with a native date picker behind the label. The hidden input is
 * laid over the label so a tap opens iOS's own picker — no calendar widget to
 * maintain, and the picker respects Dynamic Type for free. Future days are
 * blocked (`max`); the diary is a record, not a plan.
 */
const DateBar = ({ date, onChange, className }: { date: string; onChange: (next: string) => void; className?: string }) => {
  const d = parseISO(date);
  const today = localDateKey();
  const atToday = date >= today;
  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <Button variant="ghost" size="icon" aria-label="Previous day" className="min-h-11 min-w-11" onClick={() => onChange(localDateKey(addDays(d, -1)))}>
        <ChevronLeft size={18} />
      </Button>
      <div className="relative min-h-11 min-w-[9rem] flex items-center justify-center">
        <span className="font-display text-[15px] font-black tracking-tight" aria-hidden>
          {labelFor(d)}
        </span>
        <input
          type="date"
          value={date}
          max={today}
          aria-label="Pick a day"
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full opacity-0"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next day"
        disabled={atToday}
        className="min-h-11 min-w-11 disabled:opacity-30"
        onClick={() => onChange(localDateKey(addDays(d, 1)))}
      >
        <ChevronRight size={18} />
      </Button>
    </div>
  );
};

export default DateBar;
