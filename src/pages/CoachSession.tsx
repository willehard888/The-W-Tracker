import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, HeartPulse, Loader2, Minus, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { ActionRow } from "@/components/ActionRow";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { isNativePlatform } from "@/lib/platform";
import {
  enableWorkoutWrite,
  hasWorkoutWriteConsent,
  isWorkoutWriteDeclined,
  markWorkoutWriteDeclined,
  writeWorkoutToHealth,
} from "@/lib/health/workout-write";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useDaySets, useExerciseHistory, useLogSet, useRecentWorkoutLogs } from "@/hooks/use-workout-log";
import { useCommitPop } from "@/hooks/use-commit-pop";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { resolveIllustration } from "@/lib/exercise-match";
import { IllustrationPlayer } from "@/components/coach/ExerciseIllustration";
import { ExerciseCoachingCompact } from "@/components/coach/ExerciseCoachingBlock";
import RestTimer from "@/components/coach/session/RestTimer";
import SessionSkeleton from "@/components/coach/session/SessionSkeleton";
import PageBar from "@/components/ui/page-bar";
import { useOnboardingTrigger, useSpotlightTarget } from "@/components/onboarding/onboarding-context";
import { dayFocus } from "@/lib/training/session";
import { fmtInt, fmtUnit, NBSP } from "@/lib/format";
import {
  buildSessionPlan,
  sessionProgress,
  suggestedLoad,
  sessionVolume,
  sessionPRs,
  stepWeight,
  stepReps,
} from "@/lib/training/runner";

/**
 * /coach/session/:week/:day — the active workout.
 *
 * WHY THIS SCREEN EXISTS
 *
 * A workout used to be done by expanding a row inside a nested accordion. There
 * was no start, no finish, no sense of position, no rest timer, and one weight
 * field per exercise no matter how many sets were prescribed. The athlete was
 * given a plan and left to keep the state in their head.
 *
 * This runs the session: one exercise on stage, one set at a time, rest between
 * them, and a summary at the end.
 *
 * Position is DERIVED from logged sets rather than held in state — see
 * `lib/training/runner.ts`. This is the one screen in the app that gets
 * backgrounded mid-task with a loaded bar in the athlete's hands, and anything
 * kept only in memory is gone by the time they come back.
 *
 * COMPOSITION — one set at a time. The bar says where in the program you are;
 * the beat says which exercise and what is prescribed; the rep player is the
 * reference; the one open set row is the hero and the only gold on the screen.
 * The summary is a beat ("Push day done.") and one standing line, volume in
 * gold — no tiles.
 */

/** "62.5 kg" keeps its half; fmtInt would round a plate pair away. */
const fmtKg = (n: number) => (Number.isInteger(n) ? fmtUnit(n, "kg") : `${n}${NBSP}kg`);
const setLine = (w: string, r: string) =>
  `${w === "" ? "—" : fmtKg(Number(w))} × ${r === "" ? "—" : fmtInt(Number(r))}`;

/** `[−] value [+] unit` — two 44 pt targets around a typed field. */
const Stepper = ({
  value,
  unit,
  inputMode,
  label,
  stepLabel,
  onChange,
  onStep,
}: {
  value: string;
  unit: string;
  inputMode: "decimal" | "numeric";
  label: string;
  /** e.g. "2.5 kg" → "Add 2.5 kg" / "Remove 2.5 kg". */
  stepLabel: string;
  onChange: (v: string) => void;
  onStep: (dir: 1 | -1) => void;
}) => (
  <div className="flex items-center gap-0.5">
    <Button variant="ghost" size="icon" aria-label={`Remove ${stepLabel}`} onClick={() => onStep(-1)}>
      <Minus size={16} aria-hidden />
    </Button>
    <input
      type="number"
      inputMode={inputMode}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="w-[4.25rem] min-h-11 rounded-lg border border-border/50 bg-background/60 px-1 text-center text-[16px] font-bold tabular-nums outline-none focus:border-gold/50"
    />
    <Button variant="ghost" size="icon" aria-label={`Add ${stepLabel}`} onClick={() => onStep(1)}>
      <Plus size={16} aria-hidden />
    </Button>
    <span className="w-8 text-[12px] font-semibold text-muted-foreground">{unit}</span>
  </div>
);

/**
 * One prescribed set. Only the set being done right now is open: weight and
 * reps with plate-pair steppers and the Log button. A done set folds to one
 * line (Edit reopens it); a set still ahead is a number and a dash.
 */
const SetRow = ({
  index,
  done,
  isCurrent,
  weight,
  reps,
  onLog,
  saving,
}: {
  index: number;
  done: boolean;
  isCurrent: boolean;
  weight: string;
  reps: string;
  onLog: (weight: string, reps: string) => Promise<void>;
  saving: boolean;
}) => {
  const [w, setW] = useState(weight);
  const [r, setR] = useState(reps);
  const [editing, setEditing] = useState(false);
  // Re-seed when the suggestion changes (a new set, or history arriving late).
  useEffect(() => { setW(weight); setR(reps); }, [weight, reps]);
  // Springs once, on the set that just landed — never on rows loaded as done.
  const pop = useCommitPop(done);
  const expanded = (isCurrent && !done) || editing;

  const badge = (
    <span
      className={cn(
        "shrink-0 h-8 w-8 rounded-full text-[12px] font-black flex items-center justify-center",
        done
          ? "bg-xp-green/15 text-xp-green"
          : isCurrent
            ? "bg-gold/15 text-gold"
            : "border border-border/50 text-muted-foreground",
        pop && "commit-pop",
      )}
    >
      {done ? <Check size={14} aria-hidden /> : index}
    </span>
  );

  if (!expanded) {
    return (
      <div className="flex items-center gap-3 min-h-12 px-1">
        {badge}
        {done ? (
          <>
            <span className="flex-1 min-w-0 text-[15px] font-bold tabular-nums">{setLine(weight, reps)}</span>
            <Button variant="ghost" size="sm" className="min-h-11 text-muted-foreground" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        ) : (
          <span className="text-[15px] font-bold text-muted-foreground/50">—</span>
        )}
      </div>
    );
  }

  const step = (apply: () => void) => { hapticImpact("light"); apply(); };

  return (
    <div
      className={cn(
        "rounded-2xl border px-2.5 py-2",
        done ? "border-border/50 bg-background/30" : "border-gold/45 bg-gold/[0.05]",
      )}
    >
      <div className="flex items-center gap-2">
        {badge}
        <Stepper
          value={w}
          unit="kg"
          inputMode="decimal"
          label={`Set ${index} weight in kilograms`}
          stepLabel="2.5 kg"
          onChange={setW}
          onStep={(d) => step(() => setW(String(stepWeight(w, d))))}
        />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="w-8 shrink-0" aria-hidden />
        <Stepper
          value={r}
          unit="reps"
          inputMode="numeric"
          label={`Set ${index} reps`}
          stepLabel="1 rep"
          onChange={setR}
          onStep={(d) => step(() => setR(String(stepReps(r, d))))}
        />
        <Button
          variant="ember"
          size="sm"
          className="ml-auto min-h-11 min-w-16 shrink-0"
          disabled={saving}
          onClick={async () => { await onLog(w, r); setEditing(false); }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : done ? "Save" : "Log"}
        </Button>
      </div>
    </div>
  );
};

const CoachSession = () => {
  const navigate = useNavigate();
  const params = useParams<{ week: string; day: string }>();
  const week = Number(params.week);
  const day = Number(params.day);

  const { program, isLoading: programLoading } = useCoachProgram();
  const { session, isLoading: sessionLoading, start, finish, isFinishing } = useWorkoutSession(program?.id, week, day);
  const { data: daySets } = useDaySets(program?.id, week, day);
  const { data: recent } = useRecentWorkoutLogs();
  const logSet = useLogSet();

  const [restFor, setRestFor] = useState<number | null>(null);
  // Bumped on every logged set: the timer is keyed on it, so the same rest
  // length twice in a row still restarts the clock (a plain state write with
  // an equal value is a no-op and left the previous deadline running).
  const [restToken, setRestToken] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [finishAsk, setFinishAsk] = useState(false);
  // Asked once, on the summary, only where Health exists: a yes turns it on
  // for every session from here, a no is remembered.
  const [healthAsk, setHealthAsk] = useState(
    () => isNativePlatform() && !hasWorkoutWriteConsent() && !isWorkoutWriteDeclined(),
  );
  const [healthBusy, setHealthBusy] = useState(false);

  const planDay = program?.plan_json?.weeks?.find((w) => w.week === week)?.days?.[day];
  const plan = useMemo(() => buildSessionPlan(planDay?.blocks), [planDay]);
  const logged = daySets ?? {};
  const progress = sessionProgress(plan, logged);

  const current = progress.currentExerciseIndex >= 0 ? plan[progress.currentExerciseIndex] : null;
  const summaryShown = progress.isComplete || showSummary || !!session?.completed;

  // Every set logged: the session is finished whether or not a button gets
  // pressed — someone who closes the app on the summary still trained today,
  // and the check-in bridge and the program's tick key on the finished row.
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const autoFinished = useRef(false);
  useEffect(() => {
    if (!progress.isComplete || !session || session.completed || autoFinished.current) return;
    autoFinished.current = true;
    finishRef.current().catch(() => { autoFinished.current = false; });
  }, [progress.isComplete, session]);
  const illustrated = useMemo(() => (current ? resolveIllustration(current.slug, current.name) : null), [current]);

  const { data: history } = useExerciseHistory(current?.slug ?? null);

  // The phone lies on the bench with a set count on it: no auto-lock while a
  // session is on stage.
  useWakeLock(!programLoading && plan.length > 0 && !summaryShown);

  // Guidance. The provider owns eligibility, the per-launch cap and the seen
  // state — these only say when the moment is right. FIRST_WORKOUT_INTRO chains
  // to the logging spotlight, so the pair costs one teaching moment rather than
  // two interruptions in the middle of a warm-up.
  useOnboardingTrigger("FIRST_WORKOUT_INTRO", plan.length > 0 && !summaryShown);
  // On the summary, not on `session.completed`: the finish button navigates
  // away in the same handler, so the completed row never re-rendered here.
  useOnboardingTrigger("WORKOUT_COMPLETE_INTRO", summaryShown);
  const loggingTargetRef = useSpotlightTarget("WORKOUT_LOGGING_INTRO");

  // Mark the session started once, when the runner opens on a real session.
  // Only once the session row has been read: on a cold open both guards below
  // passed while the query was still in flight, and start() overwrote a
  // finished session with in_progress.
  useEffect(() => {
    if (!program?.id || !plan.length || sessionLoading || session?.completed) return;
    if (session?.started_at) return;
    void start().catch(() => { /* a failed start must never block training */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id, plan.length, sessionLoading, session?.started_at, session?.completed]);

  if (programLoading) return <SessionSkeleton />;

  if (!program || !planDay || plan.length === 0) {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="text-[15px] font-bold mb-1">Nothing to run here</p>
        <p className="text-[13px] text-muted-foreground mb-5">
          This day has no exercises in your plan.
        </p>
        <Button variant="outline" onClick={() => navigate("/coach/program")}>
          Back to your program
        </Button>
      </div>
    );
  }

  const focus = dayFocus(planDay);
  // The bar names the program slot; the beat names the day and the exercise.
  const barTitle = `Week ${week} · ${planDay.day}`;

  // ── Summary ───────────────────────────────────────────────────────────────
  if (summaryShown) {
    const volume = sessionVolume(logged);
    const mins = session?.duration_sec ? Math.max(1, Math.round(session.duration_sec / 60)) : null;
    const prs = sessionPRs(recent, logged, new Date().toLocaleDateString("en-CA"));
    const acceptHealth = async () => {
      setHealthBusy(true);
      const ok = await enableWorkoutWrite();
      if (ok && session?.started_at) {
        // This session too — finish() only writes when it runs, and an already
        // finished one would otherwise be the one workout that never landed.
        const startMs = new Date(session.started_at).getTime();
        const endIso = session.completed && session.duration_sec
          ? new Date(startMs + session.duration_sec * 1000).toISOString()
          : new Date().toISOString();
        void writeWorkoutToHealth({ id: `${program.id}-${week}-${day}`, startIso: session.started_at, endIso });
      }
      if (!ok) toast("Apple Health didn't allow it", { description: "Turn on Workouts for Whealth Factory in Health › Sharing." });
      setHealthBusy(false);
      setHealthAsk(false);
    };
    return (
      <div className="min-h-full">
        <PageBar onBack={() => navigate("/coach/program")} title={barTitle} />
        <div className="px-4 pt-6 pb-6">
          {/* Opening beat: the day, done. One standing line under it — the
              volume is the screen's one felt number. */}
          <div className="home-rise">
            <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
              {focus || "Workout"} done.
            </h2>
            <p className="mt-3 text-[15px] font-bold tabular-nums text-foreground/85">
              {fmtInt(progress.doneSets)} {progress.doneSets === 1 ? "set" : "sets"}
              {volume > 0 && (
                <>
                  {" · "}
                  <span className="text-gold glow-gold-text">{fmtUnit(volume, "kg")}</span>
                </>
              )}
              {mins ? ` · ${fmtUnit(mins, "min")}` : ""}
            </p>
          </div>

          {prs.length > 0 && (
            <div className="home-rise home-rise-1 mt-4">
              <div className="commit-pop flex flex-wrap gap-2">
                {prs.map((p) => (
                  <span
                    key={p.slug}
                    className="inline-flex items-center gap-1.5 min-h-8 rounded-full border border-[hsl(var(--teal))]/30 bg-[hsl(var(--teal))]/[0.08] px-3 text-[12px] font-bold text-[hsl(var(--teal))]"
                  >
                    <TrendingUp size={13} aria-hidden />
                    <span className="sr-only">Personal record: </span>
                    {p.name} · est. 1RM {fmtUnit(Math.round(p.e1rm), "kg")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="home-rise home-rise-2 mt-4 text-[13px] text-muted-foreground leading-snug">
            Weights saved. Today counts toward your check-in.
          </p>

          {healthAsk && (
            <div className="home-rise home-rise-3 mt-5">
              <div className="surface-card surface-card-quiet">
                <ActionRow
                  leading={
                    <span className="h-10 w-10 rounded-xl bg-card/60 border border-border/40 flex items-center justify-center">
                      <HeartPulse size={16} className="text-muted-foreground" aria-hidden />
                    </span>
                  }
                  title="Save to Apple Health"
                  subtitle="Every finished session"
                  acceptLabel="Turn on"
                  declineLabel="Not now"
                  busy={healthBusy}
                  onAccept={() => void acceptHealth()}
                  onDecline={() => { markWorkoutWriteDeclined(); setHealthAsk(false); }}
                />
              </div>
            </div>
          )}

          <div className="home-rise home-rise-4 mt-6">
            <Button
              variant="ember"
              size="lg"
              className="w-full"
              disabled={isFinishing}
              onClick={async () => {
                try {
                  if (!session?.completed) await finish();
                  hapticNotification("success");
                } catch {
                  toast.error("Couldn't save the session — your sets are still logged.");
                }
                navigate("/checkin");
              }}
            >
              {isFinishing ? <Loader2 size={16} className="animate-spin" /> : "Finish and check in"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full mt-2"
              onClick={async () => {
                try { if (!session?.completed) await finish(); } catch { /* sets are safe */ }
                navigate("/coach/program");
              }}
            >
              Back to program
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────
  const nextSet = progress.currentSetIndex;
  const suggestion = suggestedLoad(history, nextSet, logged[current!.slug], current!.reps);

  const logCurrent = async (setIndex: number, weightStr: string, repsStr: string) => {
    if (!current) return;
    const w = weightStr.trim() === "" ? null : Number(weightStr);
    const r = repsStr.trim() === "" ? null : parseInt(repsStr, 10);
    if (w == null && r == null) { toast.error("Add a weight or reps first."); return; }
    hapticImpact("light");
    try {
      await logSet.mutateAsync({
        programId: program.id, week, day,
        slug: current.slug, name: current.name,
        weight: w, reps: r, rpe: current.rpe ?? null,
        setIndex,
      });
      // Rest after every set but the session's last — walking to the next
      // exercise is not a rest, and the clock kept vanishing there.
      const lastOfSession = setIndex >= current.sets && progress.currentExerciseIndex >= plan.length - 1;
      if (lastOfSession) setRestFor(null);
      else { setRestFor(current.restSec); setRestToken((t) => t + 1); }
    } catch {
      toast.error("Couldn't save that set.");
    }
  };

  return (
    <div className="min-h-full">
      {/* Bar and progress hairline stick as one unit, so the way out and how
          much of the session is behind you never scroll away. */}
      <div className="sticky top-0 z-20">
        <PageBar sticky={false} onBack={() => navigate("/coach/program")} title={barTitle} />
        <div className="h-1 bg-border/40">
          <div
            className="h-full bg-foreground/55 transition-[width] duration-300"
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {current && (
          <>
            {/* Opening beat: where you are, what is on stage, what it asks. */}
            <div className="home-rise">
              <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                Exercise {fmtInt(progress.currentExerciseIndex + 1)} of {fmtInt(progress.totalExercises)}
                {focus ? ` · ${focus}` : ""}
              </p>
              <h2 className="mt-1 font-display font-black text-[27px] leading-[1.04] tracking-tight">
                {current.name}
              </h2>
              <p className="mt-1.5 text-[13px] font-bold tabular-nums text-foreground/85">
                {current.sets} × {current.reps || "—"}
                {current.rpe ? ` · RPE ${current.rpe}` : ""}
              </p>
              {/* The first time someone meets this notation it means nothing.
                  One line, inline, where the number actually is. */}
              <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
                {current.sets} sets of {current.reps || "your target"} reps
                {current.rpe ? `, leaving about ${Math.max(0, 10 - current.rpe)} reps in reserve` : ""}.
              </p>
            </div>

            {illustrated && (
              <div className="home-rise home-rise-1 mt-4">
                <IllustrationPlayer ex={illustrated} />
              </div>
            )}

            {illustrated && (
              <div className="home-rise home-rise-2 mt-3">
                <ExerciseCoachingCompact slug={illustrated.slug} />
              </div>
            )}

            {/* Arrives after a commit, not on open — no entrance of its own. */}
            {restFor != null && (
              <div className="mt-4">
                <RestTimer
                  key={restToken}
                  seconds={restFor}
                  onDismiss={() => setRestFor(null)}
                />
              </div>
            )}

            <div className="home-rise home-rise-3 mt-5" ref={loggingTargetRef}>
              <p className="eyebrow mb-2">Sets</p>
              <div className="space-y-1">
                {Array.from({ length: current.sets }, (_, i) => i + 1).map((n) => {
                  const existing = (logged[current.slug] ?? []).find((s) => s.set_index === n);
                  const isDone = !!existing;
                  const seed = isDone
                    ? { weight: existing.weight ?? null, reps: existing.reps ?? null }
                    : n === nextSet
                      ? suggestion
                      : { weight: null, reps: null };
                  return (
                    <SetRow
                      key={n}
                      index={n}
                      done={isDone}
                      isCurrent={n === nextSet}
                      weight={seed.weight != null ? String(seed.weight) : ""}
                      reps={seed.reps != null ? String(seed.reps) : ""}
                      saving={logSet.isPending}
                      onLog={(w, r) => logCurrent(n, w, r)}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Finishing early is a normal thing to do, not a failure. Open sets
            get one question; a fully logged day goes straight to the summary. */}
        <div className="mt-4">
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground"
            onClick={() => (progress.doneSets >= progress.totalSets ? setShowSummary(true) : setFinishAsk(true))}
          >
            Finish session
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={finishAsk}
        onOpenChange={setFinishAsk}
        title="Finish with sets still open?"
        description="Your logged sets are saved."
        actionLabel="Finish"
        onConfirm={() => { setFinishAsk(false); setShowSummary(true); }}
      />
    </div>
  );
};

export default CoachSession;
