import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { backOr } from "@/lib/nav";
import { CalendarDays, Crown, Dumbbell, PencilLine, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ProgramWeekView from "@/components/coach/ProgramWeekView";
import ProgramOnboarding from "@/components/coach/ProgramOnboarding";
import ProgramReveal from "@/components/coach/ProgramReveal";
import FocusSessionSheet from "@/components/coach/FocusSessionSheet";
import { DoorRow } from "@/components/coach/rows";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useCreateProgram } from "@/hooks/use-focus-session";
import { friendlyError } from "@/lib/error-copy";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { isRepeatingWeek } from "@/lib/training/plan-edit";
import type { ProgramWeekState } from "@/lib/training/program-week";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
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
 *   2) No program    → three doors: train today (the default), the coach's
 *                      week, a week of your own; for Free, the paywall door
 *   3) Has program   → beat · today's session (the hero) · week strip · the
 *                      weeks, every one of them editable by hand
 *
 * Never blank — every state shows a substantial UI.
 */
const CoachProgramDetail = () => {
  const navigate = useNavigate();
  // hasAccess, not isElite: the trial is sold as full access, Home's Training
  // row shows its Build button to any trialist, and this screen used to answer
  // that tap with a paywall. The server gate now agrees (has_active_access).
  const { hasAccess } = useTrialAccess();
  const [showRegen, setShowRegen] = useState(false);
  const [trainToday, setTrainToday] = useState(false);
  const [askEmpty, setAskEmpty] = useState(false);
  const createProgram = useCreateProgram();
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

  // A week that repeats is "your week"; only a planned block counts its weeks.
  const repeating = !!program && isRepeatingWeek(program.plan_json, currentWeek);

  const onRegenerated = () => { setShowRegen(false); setJustGenerated(true); refetch(); };

  // A week of your own and a repeat need no reveal: the athlete knows what is
  // in them. The page simply becomes the new program.
  const create = (arg: Parameters<typeof createProgram.mutate>[0]) => {
    hapticImpact("medium");
    createProgram.mutate(arg, {
      onSuccess: () => { hapticNotification("success"); setShowRegen(false); },
      onError: (e) => {
        if (/row-level security/i.test(e instanceof Error ? e.message : "")) navigate("/paywall");
        else toast.error(friendlyError(e, "Couldn't start the program. Try again."));
      },
    });
  };

  return (
    <div className="min-h-full">
      <PageBar title="Training program" onBack={() => backOr(navigate, "/coach")} />

      <div className="px-4 pt-4 pb-6">
        {isLoading && <DetailSkeleton />}

        {/* The reveal carries its own beat, so the page's stays out of its way. */}
        {!isLoading && !justGenerated && (
          <header className="home-rise">
            <h2 className="font-display font-black text-beat leading-[1.04] tracking-tight">
              {program
                ? repeating
                  ? "Your week."
                  : <>Week <span className="text-gold glow-gold-text tabular-nums">{currentWeek}</span> of {program.weeks}.</>
                : "What are you training today?"}
            </h2>
            <p className="mt-1.5 text-dense text-muted-foreground leading-snug">
              {program
                ? standingLine(weekState, program.weeks)
                : "Pick the muscles, the minutes and how hard. Or have the whole week built, or build your own."}
            </p>
          </header>
        )}

        {/* No trial, no membership, no program — the paywall door */}
        {!isLoading && !program && !hasAccess && (
          <div className="home-rise home-rise-1 mt-4 border-t border-border/35">
            <DoorRow icon={Crown} label="Sessions and weeks built for you" sub="Premium" onClick={() => navigate("/paywall")} />
          </div>
        )}

        {/* Trial or member, no program. Today is the default; the week and
            a week of your own are the two quieter doors under it. */}
        {!isLoading && !program && hasAccess && !showRegen && (
          <div className="home-rise home-rise-1 mt-5">
            <Button variant="ember" size="lg" className="w-full" onClick={() => { hapticImpact("light"); setTrainToday(true); }}>
              <Dumbbell aria-hidden size={16} /> Train today
            </Button>
            <div className="mt-4 border-t border-border/35 divide-y divide-border/35">
              <DoorRow icon={CalendarDays} label="Build my week" sub="A session for each of your training days. Instant." onClick={() => setShowRegen(true)} />
              <DoorRow icon={PencilLine} label="Build my own" sub="An empty week and the exercise library." onClick={() => create({ kind: "manual" })} />
            </div>
          </div>
        )}
        {!isLoading && !program && hasAccess && showRegen && (
          <div className="home-rise mt-2">
            <ProgramOnboarding onGenerated={onRegenerated} />
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

            {/* While the reveal speaks, nothing else does — the today card's
                own ember would otherwise sit right under the reveal's. */}
            {!justGenerated && (<>
            {/* The four weeks are over: running them again is the screen's
                action, so it sits up here as the ember. */}
            {weekState.readyForNext && hasAccess && !showRegen && (
              <Button variant="ember" size="lg" className="w-full" disabled={createProgram.isPending} onClick={() => create({ kind: "repeat", from: program })}>
                {repeating ? "Keep this week going" : "Run these four weeks again"}
              </Button>
            )}

            {/* One week, one selector, one day: the strip picks, the card
                shows. The "plan adapts" spotlight lands on the strip. */}
            <ProgramWeekView
              // Also on the week and the day: they are seeded once inside, and
              // when the first log of a late week moved currentWeek on, the view
              // stayed on a week it could no longer start or edit.
              key={`${program.id}:${currentWeek}:${todayDayIndex}`}
              program={program}
              currentWeek={currentWeek}
              todayDayIndex={todayDayIndex}
              logs={logs}
              onLogged={() => refetch()}
              stripRef={adaptsTargetRef}
            />

            {/* Start over: both doors replace the running program. */}
            {hasAccess && !showRegen && (
              <div className="border-t border-border/35 divide-y divide-border/35">
                <DoorRow icon={RefreshCw} label="Build a new week" sub="The coach builds it from your profile." onClick={() => setShowRegen(true)} />
                <DoorRow icon={PencilLine} label="Start from an empty week" sub="Build your own from the exercise library." onClick={() => setAskEmpty(true)} />
              </div>
            )}
            {hasAccess && showRegen && (
              // A new week earns the same reveal: it is a different plan.
              <ProgramOnboarding onGenerated={onRegenerated} />
            )}
            </>)}
          </div>
        )}
      </div>

      {trainToday && <FocusSessionSheet open onClose={() => setTrainToday(false)} />}
      <ConfirmDialog
        open={askEmpty}
        onOpenChange={setAskEmpty}
        title="Start from an empty week?"
        description="It replaces this program. Your logged sets stay in your history."
        actionLabel="Start empty"
        onConfirm={() => { setAskEmpty(false); create({ kind: "manual" }); }}
      />
    </div>
  );
};

export default CoachProgramDetail;
