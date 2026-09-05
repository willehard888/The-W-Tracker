import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Crown, RefreshCw } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import WeekStrip from "@/components/coach/WeekStrip";
import ProgramWeekAccordion from "@/components/coach/ProgramWeekAccordion";
import TodaySessionCard from "@/components/coach/TodaySessionCard";
import ProgramOnboarding from "@/components/coach/ProgramOnboarding";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { ProfileSkeleton as PageSkeleton } from "@/components/skeletons/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { loadExerciseLibrary } from "@/lib/exercise-library";

/**
 * /coach/program — full training program detail.
 *
 * Three states:
 *   1) Loading       → skeleton
 *   2) No program    → for Elite, generation flow; for Free, paywall CTA
 *   3) Has program   → today + week strip + full accordion
 *
 * Never blank — every state shows a substantial UI.
 */
const CoachProgramDetail = () => {
  const navigate = useNavigate();
  const { isElite } = useAuth();
  const [showRegen, setShowRegen] = useState(false);
  const {
    isLoading,
    program,
    currentWeek,
    todayDayIndex,
    logs,
    refetch,
  } = useCoachProgram();

  // Warm the exercise library in parallel with the program fetch, so rows + their
  // photos resolve immediately instead of after a 600KB chunk loads on first row.
  useEffect(() => { loadExerciseLibrary(); }, []);

  return (
    <div className="min-h-full">
      <PageBar title="Training program" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6 space-y-4">
        {isLoading && <PageSkeleton />}

        {/* Free user, no program — upsell */}
        {!isLoading && !program && !isElite && (
          <button
            type="button"
            onClick={() => navigate("/paywall")}
            className="w-full text-left rounded-3xl border border-gold/35 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2 mb-2">
              <Crown size={12} className="text-gold" />
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold">
                Premium feature
              </p>
            </div>
            <p className="text-[15px] font-bold leading-tight mb-1">
              Build your 4-week training program
            </p>
            <p className="text-[12px] text-muted-foreground leading-snug">
              Periodised by an AI coach against your goal, equipment, and time.
              Adapts each week from your logs.
            </p>
          </button>
        )}

        {/* Elite user, no program — generation flow */}
        {!isLoading && !program && isElite && (
          <>
            <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className="text-gold" />
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold">
                  No program yet
                </p>
              </div>
              <p className="text-[13px] leading-snug text-foreground/90 mb-3">
                Generate your 4-week training program. Two-minute setup
                via your athlete profile — the plan adapts each week.
              </p>
            </div>
            <ProgramOnboarding onGenerated={() => refetch()} />
          </>
        )}

        {/* Has program — full layout */}
        {!isLoading && program && (
          <>
            <TodaySessionCard
              program={program}
              currentWeek={currentWeek}
              todayDayIndex={todayDayIndex}
              logs={logs}
              onLogged={() => refetch()}
            />
            <WeekStrip
              program={program}
              currentWeek={currentWeek}
              todayDayIndex={todayDayIndex}
              logs={logs}
            />
            <ProgramWeekAccordion
              program={program}
              currentWeek={currentWeek}
              logs={logs}
            />

            {/* Regenerate — build a fresh 4-week block (supersedes the current). */}
            {isElite && !showRegen && (
              <button
                type="button"
                onClick={() => setShowRegen(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gold/30 bg-card/40 px-4 py-3 text-[12px] font-black uppercase tracking-widest text-gold/90 active:scale-[0.99] transition-transform"
              >
                <RefreshCw size={13} /> Generate a new block
              </button>
            )}
            {isElite && showRegen && (
              <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.05] to-card p-1">
                <ProgramOnboarding onGenerated={() => { setShowRegen(false); refetch(); }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CoachProgramDetail;
