import { useNavigate } from "react-router-dom";
import { Dumbbell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { dayFocus, daySummary, isRestDay, type ProgramDayShape } from "@/lib/training/session";

/**
 * Card 3 — Training program (Program). Available to every member (the app is
 * fully paywalled, so there's no secondary gate).
 *
 * Loading: skeleton (it used to flash the "no program" CTA mid-fetch)
 * No program yet: "Generate program" CTA → /coach/program (triggers
 *   ProgramOnboarding internally on visit)
 * Has program: one-line "Day 3 · Push (45 min)" + tap to /coach/program
 */
const ProgramCard = () => {
  const navigate = useNavigate();
  const { program, currentWeek, todayDayIndex, isLoading } = useCoachProgram();

  const today = (() => {
    if (!program) return null;
    // Match on the week NUMBER, not the array position — every other surface
    // does, and a plan whose weeks are out of order would otherwise show the
    // wrong day here alone.
    const week = program.plan_json?.weeks?.find((w) => w.week === currentWeek)
      ?? program.plan_json?.weeks?.[currentWeek - 1];
    return (week?.days?.[todayDayIndex] as ProgramDayShape | undefined) ?? null;
  })();

  // Fetching. Without this the card rendered its "no program" branch while the
  // query was still in flight, so anyone who HAS a program saw "Build my
  // program" flash before their real week appeared.
  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Dumbbell size={12} className="text-gold" />
          <p className="eyebrow">Training program</p>
        </div>
        <div className="skeleton-block h-5 w-2/3 mb-2" />
        <div className="skeleton-block h-3 w-1/3" />
      </div>
    );
  }

  // No program yet
  if (!program) {
    return (
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Dumbbell size={12} className="text-gold" />
          <p className="eyebrow">
            Training program
          </p>
        </div>
        <p className="text-[14px] font-bold leading-snug mb-1">
          Generate your 4-week training program
        </p>
        <p className="text-[12px] text-muted-foreground leading-snug mb-4">
          Two-minute setup. The plan adapts each week from your logs.
        </p>
        <Button
          variant="ember"
          size="default"
          onClick={() => navigate("/coach/program")}
          className="w-full"
        >
          Build my program
        </Button>
      </div>
    );
  }

  // Elite: has program — show today's session line
  return (
    <button
      type="button"
      onClick={() => navigate("/coach/program")}
      className="w-full text-left surface-card p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 mb-2">
        <Dumbbell size={12} className="text-gold" />
        <p className="eyebrow">
          Training program · Week {currentWeek}
        </p>
      </div>

      {today ? (
        <>
          <p className="text-[15px] font-bold leading-tight text-foreground mb-1">
            {isRestDay(today) ? "Rest day" : `Day ${todayDayIndex + 1} · ${dayFocus(today)}`}
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug">
            {isRestDay(today)
              ? "Active recovery, mobility, walk. Earn tomorrow."
              : daySummary(today)}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Tap to view your week.
        </p>
      )}

      <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gold">
        Open program <ArrowRight size={12} />
      </div>
    </button>
  );
};

export default ProgramCard;
