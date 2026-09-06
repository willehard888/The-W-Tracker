import { useNavigate } from "react-router-dom";
import { Dumbbell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoachProgram, todaySessionOf } from "@/hooks/use-coach-program";

/**
 * The program door. No program yet: the two-minute build. Has one: today's
 * session as a quiet row into /coach/program.
 */
const ProgramCard = () => {
  const navigate = useNavigate();
  const { program, currentWeek, todayDayIndex, isLoading } = useCoachProgram();
  const today = todaySessionOf(program, currentWeek, todayDayIndex);

  // Fetching. Without this the card renders its "no program" branch while the
  // query is still in flight, so anyone who HAS a program sees "Build my
  // program" flash before their real week appears.
  if (isLoading) {
    return (
      <div className="surface-card surface-card-quiet px-4 py-3.5 flex items-center gap-3">
        <Dumbbell size={16} className="text-muted-foreground shrink-0" aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="skeleton-block block h-4 w-2/5 mb-1.5" />
          <span className="skeleton-block block h-3 w-1/4" />
        </span>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-[14px] font-bold leading-snug">Generate your 4-week training program</p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
          Two-minute setup. The plan adapts each week from your logs.
        </p>
        <Button variant="secondary" onClick={() => navigate("/coach/program")} className="w-full mt-3">
          Build my program
        </Button>
      </div>
    );
  }

  const title = !today ? `Week ${currentWeek}` : today.isRest ? "Rest day" : `Day ${todayDayIndex + 1} · ${today.focus}`;
  const sub = !today
    ? "Tap to view your week."
    : today.isRest
      ? "Active recovery, mobility, walk. Earn tomorrow."
      : [today.duration ? `${today.duration} min` : null, today.blocks ? `${today.blocks} blocks` : null].filter(Boolean).join(" · ") || "Open the program";

  return (
    <button
      type="button"
      onClick={() => navigate("/coach/program")}
      className="press w-full text-left surface-card surface-card-quiet px-4 py-3.5 flex items-center gap-3"
    >
      <Dumbbell size={16} className="text-muted-foreground shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold leading-tight truncate">{title}</span>
        <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5 truncate">{sub}</span>
      </span>
      <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" aria-hidden />
    </button>
  );
};

export default ProgramCard;
