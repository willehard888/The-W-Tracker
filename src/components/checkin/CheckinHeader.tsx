import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import StreakFlameInline from "@/components/StreakFlameInline";

interface CheckinHeaderProps {
  streak: number;
  xpToday: number;
  coreDone: number;
  coreTotal: number;
  /** Workout is the only core item that can be "unanswered" (Trained / Rest day). */
  workoutAnswered: boolean;
  /** One calm line, only when the streak is genuinely about to end (see voice rules). */
  deadlineLine?: string | null;
  onBack: () => void;
}

/**
 * The check-in header — streak + today's XP + Core 4 progress. Gold and muted
 * only: an untouched form is a neutral start, never a red failure state
 * ("1/12 · 8% — EXECUTE TODAY OR FALL" is what this replaces).
 */
const CheckinHeader = ({
  streak, xpToday, coreDone, coreTotal, workoutAnswered, deadlineLine, onBack,
}: CheckinHeaderProps) => {
  const stateText = !workoutAnswered
    ? "Log your Core 4 — done or not"
    : coreDone === coreTotal
    ? "Core 4 logged ✓"
    : `${coreDone} of ${coreTotal} done`;

  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pt-3 pb-3 mb-4 bg-[hsl(var(--background)/0.97)] border-b border-border/40 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label="Back"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-secondary/60 transition-colors active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-black tracking-tight leading-none">Daily check-in</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-none">{format(new Date(), "EEEE d MMM")}</p>
        </div>
        {streak > 0 && (
          <div className="shrink-0 inline-flex items-center rounded-full border border-[hsl(var(--ember))]/30 bg-[hsl(var(--ember)/0.10)] px-2.5 py-1">
            <StreakFlameInline streak={streak} suffix="d" className="text-[13px]" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {/* Core 4 pips */}
        <div className="flex items-center gap-1.5" aria-label={`${coreDone} of ${coreTotal} core habits done`}>
          {Array.from({ length: coreTotal }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-5 rounded-full transition-colors duration-300",
                i < coreDone ? "bg-[hsl(var(--gold))]" : "bg-border/60",
              )}
            />
          ))}
        </div>
        <span className="text-[12px] font-semibold text-muted-foreground leading-none truncate">{stateText}</span>
        <motion.span
          key={xpToday}
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="ml-auto shrink-0 font-display font-black text-[15px] text-gold tabular-nums leading-none"
        >
          +{xpToday} XP today
        </motion.span>
      </div>

      {deadlineLine && (
        <p className="mt-2 text-[11px] font-semibold text-amber leading-none">{deadlineLine}</p>
      )}
    </div>
  );
};

export default CheckinHeader;
