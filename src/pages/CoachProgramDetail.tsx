import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import WeekStrip from "@/components/coach/WeekStrip";
import ProgramWeekAccordion from "@/components/coach/ProgramWeekAccordion";
import TodaySessionCard from "@/components/coach/TodaySessionCard";
import ProgramOnboarding from "@/components/coach/ProgramOnboarding";
import ProgramReveal from "@/components/coach/ProgramReveal";
import { DoorRow } from "@/components/coach/rows";
import { useCoachProgram } from "@/hooks/use-coach-program";
import type { ProgramWeekState } from "@/lib/training/program-week";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { loadExerciseLibrary } from "@/lib/exercise-library";
import { fmtInt } from "@/lib/format";
import { useOnboardingTrigger, useSpotlightTarget } from "@/components/onboarding/onboarding-context";

/** Small counts read as words inside a sentence: "away two weeks". */
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const asWord = (n: number) => WORDS[n] ?? fmtInt(n);
const sessions = (n: number) => `${fmtInt(n)} ${n === 1 ? "session" : "sessions"}`;

/**
 * The beat's second line: where the athlete is in the block, in one sentence.
 * Said once, at the top, with no scolding. The calendar moving on without
 * them and the block being over were separate boxes before; now they are the
 * same line in a different state.
 */
const standingLine = (s: ProgramWeekState, weeks: number): string => {
  if (s.readyForNext) {
    return s.sessionsDone > 0
      ? `Block complete. ${sessions(s.sessionsDone)}.`
      : `These ${asWord(weeks)} weeks have passed.`;
  }
  if (s.weeksBehind > 0) {
    return `You were away ${s.weeksBehind === 1 ? "a week" : `${asWord(s.weeksBehind)} weeks`}. The plan waited.`;
  }
  return s.sessionsDone > 0 ? `${sessions(s.sessionsDone)} in.` : "Nothing logged yet.";
};

/**
 * /coach/program — the plan, and where you are in it.
 *
 * Three states:
 *   1) Loading       → skeleton
 *   2) No program    → for Elite, generation flow; for Free, paywall door
 *   3) Has program   → beat · today's session (the hero) · week strip · the weeks
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
    weekState,
    refetch,
  } = useCoachProgram();

  // Guidance. The reveal teaches what was built; the adapts card waits until
  // a first week is genuinely behind them, because "next week is built from
  // what you logged" means nothing before anything is logged.
  const completedSessions = logs.filter((l) => l.completed).length;
  useOnboardingTrigger("TRAINING_PROGRAM_READY", !!program && justGenerated);
  useOnboardingTrigger("PROGRAM_ADAPTS_INTRO", completedSessions >= 3);
  const adaptsTargetRef = useSpotlightTarget("PROGRAM_ADAPTS_INTRO");

  // Warm the exercise library in parallel with the program fetch, so rows + their
  // photos resolve immediately instead of after a 600KB chunk loads on first row.
  useEffect(() => { loadExerciseLibrary(); }, []);

  const onRegenerated = () => { setShowRegen(false); setJustGenerated(true); refetch(); };

  return (
    <div className="min-h-full">
      <PageBar title="Training program" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
        {isLoading && <DetailSkeleton />}

        {/* The reveal carries its own beat, so the page's stays out of its way. */}
        {!isLoading && !justGenerated && (
          <header className="home-rise">
            <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
              {program
                ? <>Week <span className="text-gold glow-gold-text tabular-nums">{currentWeek}</span> of {program.weeks}.</>
                : "Tell me the goal. I build the week."}
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
              {program
                ? standingLine(weekState, program.weeks)
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
          <div className={justGenerated ? "home-rise space-y-4" : "home-rise home-rise-1 mt-4 space-y-4"}>
            {justGenerated && (
              <ProgramReveal
                program={program}
                currentWeek={currentWeek}
                todayDayIndex={todayDayIndex}
                onStart={() => setJustGenerated(false)}
              />
            )}

            {/* The block is over: the next one is the screen's action, so it
                sits up here as the ember and the quiet door below stays away. */}
            {weekState.readyForNext && !justGenerated && isElite && !showRegen && (
              <Button variant="ember" size="lg" className="w-full" onClick={() => setShowRegen(true)}>
                Build my next block
              </Button>
            )}

            <TodaySessionCard
              program={program}
              currentWeek={currentWeek}
              todayDayIndex={todayDayIndex}
              logs={logs}
              onLogged={() => refetch()}
            />
            {/* The week strip is what "next week is built from what you
                logged" is pointing at, so the spotlight lands on it. */}
            <div ref={adaptsTargetRef}>
              <WeekStrip
                program={program}
                currentWeek={currentWeek}
                todayDayIndex={todayDayIndex}
                logs={logs}
              />
            </div>
            <ProgramWeekAccordion
              program={program}
              currentWeek={currentWeek}
              logs={logs}
            />

            {/* Regenerate — build a fresh 4-week block (supersedes the current). */}
            {isElite && !showRegen && !weekState.readyForNext && (
              <div className="border-t border-border/35">
                <DoorRow icon={RefreshCw} label="Generate a new block" onClick={() => setShowRegen(true)} />
              </div>
            )}
            {isElite && showRegen && (
              // A new block earns the same reveal — it is a different plan, and
              // "what changed and why" is the whole question there too.
              <ProgramOnboarding onGenerated={onRegenerated} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachProgramDetail;
