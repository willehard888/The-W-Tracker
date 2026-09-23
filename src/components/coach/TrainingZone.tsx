import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticImpact, hapticSelection } from "@/lib/haptics";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { useTodayFocusSession } from "@/hooks/use-focus-session";
import { dayFocus, daySummary, isRestDay, isTrainingDay } from "@/lib/training/session";
import { deferredRecovery } from "@/lib/recovery/deferred";
import ImageBand from "@/components/home/ImageBand";
import { goldThumb } from "@/components/coach/gold-lines";

// Lazy: the sheet pulls in the 268-movement illustration catalog (164 kB raw,
// 31 kB gz) through its thumbnails. Imported statically from a Home component
// it rode in the boot chunk of every cold start, for a sheet that mounts on a tap.
const FocusSessionSheet = lazy(() => import("@/components/coach/FocusSessionSheet"));

/**
 * Today's prescribed session, on the home screen.
 *
 * WHY THIS EXISTS
 *
 * The training program was two levels deep: Home → a deliberately quiet coach
 * strip → /coach → scroll past three cards → the program card, ranked fourth →
 * /coach/program. The exercises for today appeared on exactly one screen in the
 * whole app, and nothing on Home ever said what they were. A member could open
 * the app every morning and never learn they had a session that day.
 *
 * ACCENT DISCIPLINE
 *
 * Home's gold budget belongs to the hero (the daily check-in) and the W-Index —
 * a decision stated in Index.tsx and honoured by the Fuel row, which carries no
 * gold of its own. This row follows Fuel exactly: quiet surface, one outline
 * action. Home's one eyebrow is the date above the beat, so the label here is
 * plain 11 px muted text, not a second eyebrow. It is deliberately NOT a second
 * spectacle competing with the check-in; it is the day's other concrete fact,
 * stated plainly.
 */

// No card. Home is type on the page now, the grammar Diary, Messages and the
// feed already use — the eight stacked rounded rectangles were the reason
// nothing on this screen led.
const ROW = "flex items-center";
const BODY = "flex-1 min-w-0 min-h-14 text-left active:opacity-70 transition-opacity";
const LABEL = "text-label font-bold text-muted-foreground/75 mb-0.5";

/**
 * The drawing of the first movement in today's session, resolved AFTER paint.
 *
 * Slug → drawing needs `exercise-match`, which reaches the 170 kB illustrated
 * catalogue — and `boot-graph.test.ts` forbids that from Home's static graph,
 * for the good reason that every cold start would pay for it. A dynamic import
 * is not in that graph: the chunk arrives once the screen is already up, inside
 * the entrance animation, so the band fades in rather than shifting anything a
 * user could see.
 */
const useSessionArt = (slug?: string | null, name?: string | null): string | null => {
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => {
    if (!slug && !name) { setArt(null); return; }
    let alive = true;
    void import("@/lib/exercise-match")
      .then(({ resolveIllustration }) => {
        if (alive) setArt(resolveIllustration(slug ?? null, name ?? null)?.idNum ?? null);
      })
      .catch(() => { /* no drawing is a fine outcome; the row still reads */ });
    return () => { alive = false; };
  }, [slug, name]);
  return art;
};

/**
 * "Train today by focus" — the door under the row and the sheet it opens.
 * Same silhouette as the row; mounted only while open so Home pays nothing.
 */
const FocusDoor = ({ label = "Pick a different focus", aside }: { label?: string; aside?: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => { hapticSelection(); setOpen(true); }}
          className="press flex-1 min-h-11 flex items-center gap-1 px-4 text-meta font-bold text-muted-foreground"
        >
          {label} <ChevronRight aria-hidden size={13} />
        </button>
        {aside}
      </div>
      {open && <Suspense fallback={null}><FocusSessionSheet open onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
};

/**
 * Recovery on demand. The row offers it where it is the obvious next thing
 * (a rest day, a logged session); every other state still needs a way in, or
 * the feature does not exist for somebody who has not trained yet today.
 * Source "manual" keeps these opens apart from the offered ones in the funnel.
 */
const RecoveryDoor = ({ to = "/recovery?src=manual" }: { to?: string }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => { hapticImpact("light"); navigate(to); }}
      className="press w-full min-h-11 flex items-center gap-1 px-4 text-meta font-bold text-muted-foreground"
    >
      Recovery session <ChevronRight aria-hidden size={13} />
    </button>
  );
};

const TrainingZone = () => {
  const navigate = useNavigate();
  const { program, logs, currentWeek, todayDayIndex, isLoading } = useCoachProgram();
  const { session } = useTodayFocusSession();
  // Read once per mount: it is a local value, it only changes on a screen this
  // row is not on, and re-reading it on every render would be work for nothing.
  const deferred = useMemo(() => deferredRecovery(), []);
  // Above every early return: hooks may not sit behind a branch, and this
  // component returns early for a focus session, for loading and for no
  // program. Derived from the program itself so it is safe before those.
  const todayBlock = program?.plan_json?.weeks
    ?.find((w) => w.week === currentWeek)?.days?.[todayDayIndex]?.blocks?.[0] as
    | { slug?: string; name?: string }
    | undefined;
  const art = useSessionArt(todayBlock?.slug, todayBlock?.name);

  // Today's focus session, when one exists, is the day's training and leads;
  // the programmed day waits underneath the same door.
  if (session) {
    const d = session.program.plan_json?.weeks?.[0]?.days?.[todayDayIndex];
    const done = !!session.log?.completed;
    const inProgress = !done && session.log?.status === "in_progress";
    const go = () => { hapticImpact("light"); navigate(`/coach/session/1/${todayDayIndex}?p=${session.program.id}`); };
    return (
      <div className={ROW.replace("flex items-center", "flex flex-col")}>
        <div className="flex items-center">
          <button type="button" onClick={go} aria-label="Open today's session" className={BODY}>
            <p className={LABEL}>Training · Today</p>
            <p className="text-note font-bold leading-tight truncate">
              {done && <Check aria-hidden size={13} className="inline mr-1 text-xp-green" />}
              {dayFocus(d) || "Your session"}
            </p>
            <p className="text-meta text-muted-foreground leading-snug mt-0.5">
              {done ? "Logged today" : inProgress ? `In progress · ${daySummary(d)}` : daySummary(d)}
            </p>
          </button>
          {!done && (
            <div className="pr-2 shrink-0">
              <Button variant="outline" size="sm" className="min-h-11" onClick={go}>
                {inProgress ? "Continue" : "Start"}
              </Button>
            </div>
          )}
        </div>
        {/* On a day with its own session the program had no door on Home at
            all: the row above opens the session, and the only way to the week
            was through the Coach page. */}
        <FocusDoor
          aside={program ? (
            <button
              type="button"
              onClick={() => { hapticImpact("light"); navigate("/coach/program"); }}
              className="press shrink-0 min-h-11 flex items-center gap-1 px-4 text-meta font-bold text-muted-foreground"
            >
              Your program <ChevronRight aria-hidden size={13} />
            </button>
          ) : undefined}
        />
        <RecoveryDoor to={done ? `/recovery?src=post_workout&p=${session.program.id}&w=1&d=${todayDayIndex}` : undefined} />
      </div>
    );
  }

  // The row's own silhouette while the program loads — label, title line,
  // sub-line at the heights the real states render — so nothing shifts.
  if (isLoading) {
    return (
      <div className={ROW}>
        <div className={BODY}>
          <p className={LABEL}>Training</p>
          <div className="skeleton-block h-4 w-2/5 rounded bg-card/40" />
          <div className="skeleton-block h-3 w-1/2 rounded bg-card/40 mt-1.5" />
        </div>
      </div>
    );
  }

  const go = (path: string) => {
    hapticImpact("light");
    navigate(path);
  };

  // No program yet. Say what it is rather than showing an empty row — this is
  // the first time most people hear the feature exists.
  if (!program) {
    return (
      <div className={ROW.replace("flex items-center", "flex flex-col")}>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => go("/coach/program")}
            aria-label="Build your training program"
            className={BODY}
          >
            <p className={LABEL}>Training</p>
            <p className="text-note font-bold leading-tight">No program yet</p>
            <p className="text-meta text-muted-foreground leading-snug mt-0.5">
              Train today by focus, have your week built, or build your own.
            </p>
          </button>
          <div className="pr-2 shrink-0">
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => go("/coach/program")}>
              Build
            </Button>
          </div>
        </div>
        <FocusDoor label="Train today by focus" />
        <RecoveryDoor />
      </div>
    );
  }

  const week = program.plan_json?.weeks?.find((w) => w.week === currentWeek);
  const day = week?.days?.[todayDayIndex];
  const done = logs.some(
    (l) => l.week === currentWeek && l.day_index === todayDayIndex && l.completed,
  );
  // Same word the focus-session row above uses: with sets already logged the
  // card said "Start", as if the first set had not counted.
  const inProgress = !done && logs.some(
    (l) => l.week === currentWeek && l.day_index === todayDayIndex && l.status === "in_progress",
  );

  const emptyOwnWeek = (week?.days ?? []).length > 0 && (week?.days ?? []).every((d) => isRestDay(d)) && program.generated_with === "manual_v1";

  const open = () => go("/coach/program");
  // Start goes straight into the runner — the whole point is removing the
  // steps between "I have a session" and "I am doing it".
  const startSession = () => go(`/coach/session/${currentWeek}/${todayDayIndex}`);
  // A rest day has no session to read, so recovery works from the last couple
  // of days of logged sets; a day already trained reads that day directly. A
  // session parked with "Maybe later" wins over both — it is the one the
  // athlete has already seen and chosen to come back to.
  const startRecovery = () =>
    go(
      deferred
        ? `/recovery?src=${deferred.source}&${deferred.query}`
        : done
          ? `/recovery?src=post_workout&p=${program.id}&w=${currentWeek}&d=${todayDayIndex}`
          : "/recovery?src=rest_day",
    );

  return (
    <div className={ROW.replace("flex items-center", "flex flex-col")}>
    {/* The day's first movement, drawn, edge to edge. It appears only on a day
        there is something to do — a rest day's picture would be a picture of
        nothing, and a finished day has already had its. */}
    {art && isTrainingDay(day) && !done && (
      <ImageBand src={goldThumb(art)} alt="" fit="contain" aspect="aspect-[2/1]" className="mb-2" />
    )}
    <div className="flex items-center">
      <button
        type="button"
        onClick={open}
        aria-label="Open today's training session"
        className={BODY}
      >
        <p className={LABEL}>Training · Week {currentWeek}</p>

        {!day ? (
          // The plan exists but today's slot is missing — a truncated
          // generation. Say something true instead of rendering a blank row.
          <p className="text-note font-bold leading-tight">Your week is ready</p>
        ) : emptyOwnWeek ? (
          // "Build my own" starts as seven empty days. Nobody prescribed them:
          // calling today a rest day congratulated the athlete on a choice
          // they never made, every day, until the week was filled in.
          <>
            <p className="text-note font-bold leading-tight">Your week is empty</p>
            <p className="text-meta text-muted-foreground leading-snug mt-0.5">Open it and add your first session.</p>
          </>
        ) : isRestDay(day) ? (
          <>
            <p className="text-note font-bold leading-tight">Rest day</p>
            <p className="text-meta text-muted-foreground leading-snug mt-0.5">
              Recovery is part of the program, not a gap in it.
            </p>
          </>
        ) : done && deferred ? (
          // Trained, and the recovery session was parked rather than declined.
          // It names what it is for, because a row that just says "Recovery"
          // could be anything and this one was built from today's sets.
          <>
            <p className="text-note font-bold leading-tight truncate">
              <Check aria-hidden size={13} className="inline mr-1 text-xp-green" />
              {dayFocus(day) || "Today's session"} · logged
            </p>
            <p className="text-meta text-muted-foreground leading-snug mt-0.5 truncate capitalize">
              Recovery waiting · {deferred.areas.join(", ") || "general"}
              <span className="tabular-nums"> · {deferred.minutes} min</span>
            </p>
          </>
        ) : (
          <>
            <p className="text-note font-bold leading-tight truncate">
              {done && <Check aria-hidden size={13} className="inline mr-1 text-xp-green" />}
              {dayFocus(day) || "Today's session"}
            </p>
            <p className="text-meta text-muted-foreground leading-snug mt-0.5">
              {done ? "Logged today" : inProgress ? `In progress · ${daySummary(day)}` : daySummary(day) || "Tap to see today's exercises"}
            </p>
          </>
        )}
      </button>

      {/* One action, and only when there is something to actually do. A rest
          day with a Start button would be asking for the wrong thing. */}
      {isTrainingDay(day) && !done && (
        <div className="pr-2 shrink-0">
          <Button variant="outline" size="sm" className="min-h-11" onClick={startSession}>
            {inProgress ? "Continue" : "Start"}
          </Button>
        </div>
      )}

      {/* This row has said "recovery is part of the program" on every rest day
          for months while offering no way to do any. The two states where
          training is not the answer now get the action that is: a rest day,
          and a session already logged. Still one action on the row — this
          branch and the Start above cannot both be true. */}
      {(isRestDay(day) || (isTrainingDay(day) && done)) && (
        <div className="pr-2 shrink-0">
          <Button variant="outline" size="sm" className="min-h-11" onClick={startRecovery}>
            Recover
          </Button>
        </div>
      )}
    </div>
    <FocusDoor />
    {!(isRestDay(day) || (isTrainingDay(day) && done)) && <RecoveryDoor />}
    </div>
  );
};

export default TrainingZone;
