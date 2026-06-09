import { useNavigate } from "react-router-dom";
import { Dumbbell, ArrowRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachProgram } from "@/hooks/use-coach-program";

/**
 * Card 3 — Training program (Program).
 *
 * Free: "Build your 4-week training program" CTA → /paywall
 * Elite (no program yet): "Generate program" CTA → /coach/program (which
 *   triggers ProgramOnboarding internally on visit)
 * Elite (has program): one-line "Day 3 · Push (45 min)" + tap to /coach/program
 */
const ProgramCard = () => {
  const navigate = useNavigate();
  const { isElite } = useAuth();
  const { program, currentWeek, todayDayIndex } = useCoachProgram();

  const todaySession = (() => {
    if (!program) return null;
    const week = (program.plan_json as any)?.weeks?.[currentWeek - 1];
    const day = week?.days?.[todayDayIndex];
    if (!day) return null;
    return {
      focus: day.focus ?? day.session_name ?? "Today's session",
      duration: day.duration_min ?? null,
      blocks: Array.isArray(day.blocks) ? day.blocks.length : null,
      isRest: day.rest === true,
    };
  })();

  // Free tier: upsell CTA
  if (!isElite) {
    return (
      <button
        type="button"
        onClick={() => navigate("/paywall")}
        className="w-full text-left rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)] active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell size={12} className="text-gold" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">
            Training program
          </p>
          <Crown size={11} className="ml-auto text-gold/70" />
        </div>
        <p className="text-[14px] font-bold leading-snug mb-1">
          Build your 4-week training program
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Periodised by an AI coach against your goal, equipment, and time —
          Premium perk.
        </p>
        <div className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-gold">
          Unlock <ArrowRight size={10} />
        </div>
      </button>
    );
  }

  // Elite: no program yet
  if (!program) {
    return (
      <div className="rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]">
        <div className="flex items-center gap-2 mb-3">
          <Dumbbell size={12} className="text-gold" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">
            Training program
          </p>
        </div>
        <p className="text-[14px] font-bold leading-snug mb-1">
          Generate your 4-week training program
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug mb-4">
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
      className="w-full text-left rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)] active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 mb-2">
        <Dumbbell size={12} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">
          Training program · Week {currentWeek}
        </p>
      </div>

      {todaySession ? (
        <>
          <p className="text-[15px] font-bold leading-tight text-foreground mb-1">
            {todaySession.isRest ? "Rest day" : `Day ${todayDayIndex + 1} · ${todaySession.focus}`}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {todaySession.isRest
              ? "Active recovery, mobility, walk. Earn tomorrow."
              : `${todaySession.duration ? `${todaySession.duration} min` : ""}${
                  todaySession.duration && todaySession.blocks ? " · " : ""
                }${todaySession.blocks ? `${todaySession.blocks} blocks` : ""}`}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Tap to view your week.
        </p>
      )}

      <div className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-gold">
        Open program <ArrowRight size={10} />
      </div>
    </button>
  );
};

export default ProgramCard;
