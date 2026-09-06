import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, RefreshCw } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import WeekStrip from "@/components/coach/WeekStrip";
import ProgramWeekAccordion from "@/components/coach/ProgramWeekAccordion";
import TodaySessionCard from "@/components/coach/TodaySessionCard";
import ProgramOnboarding from "@/components/coach/ProgramOnboarding";
import ProgramReveal from "@/components/coach/ProgramReveal";
import { DoorRow } from "@/components/coach/rows";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { loadExerciseLibrary } from "@/lib/exercise-library";

/**
 * /coach/program — full training program detail.
 *
 * Three states:
 *   1) Loading       → skeleton
 *   2) No program    → for Elite, generation flow; for Free, paywall door
 *   3) Has program   → today + week strip + full accordion
 *
 * Never blank — every state shows a substantial UI.
 */
const CoachProgramDetail = () => {
  const navigate = useNavigate();
  const { isElite } = useAuth();
  const [showRegen, setShowRegen] = useState(false);
  // Set the moment generation returns; cleared when the athlete starts. Local
  // state on purpose — the durable "has seen the reveal" version arrives with
  // the TRAINING_PROGRAM_READY onboarding event.
  const [justGenerated, setJustGenerated] = useState(false);
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

  const theme = program?.plan_json?.weeks?.find((w) => w.week === currentWeek)?.theme;

  return (
    <div className="min-h-full">
      <PageBar title="Training program" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
        {isLoading && <DetailSkeleton />}

        {!isLoading && (
          <header className="home-rise">
            <h2 className="font-display font-black text-[22px] leading-[1.06] tracking-tight">
              {program ? `Week ${currentWeek} of ${program.weeks}.` : "Tell me the goal. I build the week."}
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
              {program
                ? theme ?? "Periodised against your goal, equipment and time."
                : isElite
                  ? "Four progressive weeks from your athlete profile. Two-minute setup; the plan adapts each week."
                  : "Periodised by an AI coach against your goal, equipment and time. Adapts each week from your logs."}
            </p>
          </header>
        )}

        {/* Free user, no program — the paywall door */}
        {!isLoading && !program && !isElite && (
          <div className="home-rise home-rise-1 mt-4 border-t border-border/35">
            <DoorRow icon={Crown} label="Build your 4-week training program" sub="Premium" onClick={() => navigate("/paywall")} />
          </div>
        )}

        {/* Elite user, no program — generation flow */}
        {!isLoading && !program && isElite && (
          <div className="home-rise home-rise-1 mt-2">
            <ProgramOnboarding
              onGenerated={() => {
                // The reveal is the payoff for a 25-second wait. Without it the
                // athlete lands straight in a collapsed four-week accordion
                // with nothing telling them what was built or where to start.
                setJustGenerated(true);
                refetch();
              }}
            />
          </div>
        )}

        {/* Has program — full layout */}
        {!isLoading && program && (
          <div className="home-rise home-rise-1 mt-4 space-y-4">
            {justGenerated && (
              <ProgramReveal
                program={program}
                currentWeek={currentWeek}
                onStart={() => setJustGenerated(false)}
              />
            )}
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
              <div className="border-t border-border/35">
                <DoorRow icon={RefreshCw} label="Generate a new block" onClick={() => setShowRegen(true)} />
              </div>
            )}
            {isElite && showRegen && (
              // A new block earns the same reveal — it is a different plan, and
              // "what changed and why" is the whole question there too.
              <ProgramOnboarding
                onGenerated={() => { setShowRegen(false); setJustGenerated(true); refetch(); }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachProgramDetail;
