import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useDaySets, useExerciseHistory, useLogSet } from "@/hooks/use-workout-log";
import { findIllustrated } from "@/data/exercises-illustrated";
import { candidatesForName } from "@/lib/exercise-match";
import { IllustrationPlayer } from "@/components/coach/ExerciseIllustration";
import { ExerciseCoachingCompact } from "@/components/coach/ExerciseCoachingBlock";
import RestTimer from "@/components/coach/session/RestTimer";
import PageBar from "@/components/ui/page-bar";
import { dayFocus } from "@/lib/training/session";
import { fmtUnit } from "@/lib/format";
import {
  buildSessionPlan,
  sessionProgress,
  setsDoneFor,
  suggestedLoad,
  sessionVolume,
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
  onLog: (weight: string, reps: string) => void;
  saving: boolean;
}) => {
  const [w, setW] = useState(weight);
  const [r, setR] = useState(reps);
  // Re-seed when the suggestion changes (a new set, or history arriving late).
  useEffect(() => { setW(weight); setR(reps); }, [weight, reps]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors",
        done
          ? "border-border/30 bg-background/20"
          : isCurrent
            ? "border-gold/45 bg-gold/[0.05]"
            : "border-border/40 bg-background/30",
      )}
    >
      <span
        className={cn(
          "shrink-0 h-7 w-7 rounded-full text-[12px] font-black flex items-center justify-center",
          done ? "bg-xp-green/15 text-xp-green" : "bg-gold/15 text-gold",
        )}
      >
        {done ? <Check size={13} aria-hidden /> : index}
      </span>

      <input
        type="number" inputMode="decimal" value={w} placeholder="kg"
        aria-label={`Set ${index} weight in kilograms`}
        onChange={(e) => setW(e.target.value)}
        className="w-full min-w-0 flex-1 min-h-11 rounded-lg border border-border/50 bg-background/60 px-2 text-[14px] text-center outline-none focus:border-gold/50"
      />
      <span className="text-muted-foreground text-xs font-black shrink-0">×</span>
      <input
        type="number" inputMode="numeric" value={r} placeholder="reps"
        aria-label={`Set ${index} reps`}
        onChange={(e) => setR(e.target.value)}
        className="w-full min-w-0 flex-1 min-h-11 rounded-lg border border-border/50 bg-background/60 px-2 text-[14px] text-center outline-none focus:border-gold/50"
      />

      <Button
        variant={done ? "outline" : "ember"}
        size="sm"
        className="min-h-11 shrink-0"
        disabled={saving}
        onClick={() => onLog(w, r)}
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : done ? "Edit" : "Log"}
      </Button>
    </div>
  );
};

const CoachSession = () => {
  const navigate = useNavigate();
  const params = useParams<{ week: string; day: string }>();
  const week = Number(params.week);
  const day = Number(params.day);

  const { program, isLoading: programLoading } = useCoachProgram();
  const { session, start, finish, isFinishing } = useWorkoutSession(program?.id, week, day);
  const { data: daySets } = useDaySets(program?.id, week, day);
  const logSet = useLogSet();

  const [restFor, setRestFor] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const planDay = program?.plan_json?.weeks?.find((w) => w.week === week)?.days?.[day];
  const plan = useMemo(() => buildSessionPlan(planDay?.blocks), [planDay]);
  const logged = daySets ?? {};
  const progress = sessionProgress(plan, logged);

  const current = progress.currentExerciseIndex >= 0 ? plan[progress.currentExerciseIndex] : null;
  const illustrated = useMemo(() => {
    if (!current) return null;
    for (const cand of candidatesForName(current.name)) {
      const hit = findIllustrated(cand);
      if (hit) return hit;
    }
    return null;
  }, [current]);

  const { data: history } = useExerciseHistory(current?.slug ?? null);

  // Mark the session started once, when the runner opens on a real session.
  useEffect(() => {
    if (!program?.id || !plan.length || session?.completed) return;
    if (session?.started_at) return;
    void start().catch(() => { /* a failed start must never block training */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id, plan.length, session?.started_at, session?.completed]);

  if (programLoading) {
    return (
      <div className="px-4 pt-6 space-y-3">
        <div className="skeleton-block h-6 w-1/2" />
        <div className="skeleton-block h-48 w-full" />
      </div>
    );
  }

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

  const doneAll = progress.isComplete || showSummary || !!session?.completed;

  // ── Summary ───────────────────────────────────────────────────────────────
  if (doneAll) {
    const volume = sessionVolume(logged);
    const mins = session?.duration_sec ? Math.max(1, Math.round(session.duration_sec / 60)) : null;
    return (
      <div className="home-rise px-5 pt-8">
        <p className="eyebrow text-gold mb-2">Session complete</p>
        <h1 className="font-display text-2xl font-black tracking-tight leading-tight mb-5">
          {dayFocus(planDay) || "Workout"} done
        </h1>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: "Exercises", value: `${progress.exercisesDone} / ${progress.totalExercises}` },
            { label: "Sets", value: `${progress.doneSets}` },
            { label: "Volume", value: volume ? fmtUnit(volume, "kg") : "—" },
            { label: "Time", value: mins ? `${mins} min` : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
              <p className="eyebrow text-muted-foreground/70 mb-1">{s.label}</p>
              <p className="text-[16px] font-black tabular-nums text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-transparent px-4 py-3 mb-5">
          <p className="text-[13px] text-foreground/90 leading-snug">
            Your weights are saved. The next block is built from these numbers —
            and today's session now counts toward your check-in.
          </p>
        </div>

        <Button
          variant="ember"
          size="lg"
          className="w-full mb-2"
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
          className="w-full"
          onClick={async () => {
            try { if (!session?.completed) await finish(); } catch { /* sets are safe */ }
            navigate("/coach/program");
          }}
        >
          Back to program
        </Button>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────
  const done = current ? setsDoneFor(current, logged[current.slug]) : 0;
  const nextSet = progress.currentSetIndex;
  const suggestion = suggestedLoad(history, nextSet, logged[current!.slug]);

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
      // Rest only after a set that leaves more to do — never after the last one.
      if (setIndex < current.sets) setRestFor(current.restSec);
    } catch {
      toast.error("Couldn't save that set.");
    }
  };

  return (
    <div className="min-h-full">
      {/* The one sub-page bar. A node title carries the week and focus in the
          same slot, and the exercise count rides the action slot — leaving is
          always one 44 pt tap and it never scrolls away. */}
      <PageBar
        onBack={() => navigate("/coach/program")}
        title={
          <>
            <p className="eyebrow text-muted-foreground/70">Week {week} · {planDay.day}</p>
            <p className="font-display text-[15px] font-black truncate leading-tight">
              {dayFocus(planDay) || "Session"}
            </p>
          </>
        }
        action={
          <span className="pr-3 text-[12px] font-black tabular-nums text-gold">
            {progress.exercisesDone}/{progress.totalExercises}
          </span>
        }
      />
      {/* Progress sits under the bar, sticking with it: at any moment the
          athlete can see how much of the session is behind them. */}
      <div className="sticky top-[var(--safe-top)] z-20 h-1 bg-border/40">
        <div
          className="h-full bg-gold transition-[width] duration-300"
          style={{ width: `${Math.round(progress.fraction * 100)}%` }}
        />
      </div>

      <div className="home-rise px-4 pt-4 space-y-4">
        {current && (
          <>
            {illustrated && <IllustrationPlayer ex={illustrated} />}

            <div>
              <h2 className="font-display text-xl font-black tracking-tight leading-tight">
                {current.name}
              </h2>
              <p className="text-[13px] text-gold font-bold mt-0.5">
                {current.sets} × {current.reps || "—"}
                {current.rpe ? ` · RPE ${current.rpe}` : ""}
              </p>
              {/* The first time someone meets this notation it means nothing.
                  One line, inline, where the number actually is. */}
              <p className="text-[12px] text-muted-foreground leading-snug mt-1">
                {current.sets} sets of {current.reps || "your target"} reps
                {current.rpe ? `, leaving about ${Math.max(0, 10 - current.rpe)} reps in reserve` : ""}.
              </p>
            </div>

            {illustrated && <ExerciseCoachingCompact slug={illustrated.slug} />}

            {restFor != null && (
              <RestTimer
                seconds={restFor}
                onDismiss={() => setRestFor(null)}
                onDone={() => setRestFor(null)}
              />
            )}

            <div className="space-y-2">
              <p className="eyebrow text-gold/85">Sets</p>
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

            {done >= current.sets && (
              <Button
                variant="ember"
                size="lg"
                className="w-full"
                onClick={() => { hapticImpact("medium"); setRestFor(null); }}
              >
                Next exercise <ChevronRight size={16} />
              </Button>
            )}
          </>
        )}

        {/* Finishing early is a normal thing to do, not a failure. */}
        <Button
          variant="ghost"
          size="lg"
          className="w-full text-muted-foreground"
          onClick={() => setShowSummary(true)}
        >
          Finish session
        </Button>
      </div>
    </div>
  );
};

export default CoachSession;
