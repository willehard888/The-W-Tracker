import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { useCoachProgram } from "@/hooks/use-coach-program";
import { dayFocus, daySummary, isRestDay, isTrainingDay } from "@/lib/training/session";

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

const ROW = "surface-card surface-card-quiet flex items-center";
const BODY = "flex-1 min-w-0 min-h-14 px-4 py-3 text-left active:opacity-70 transition-opacity";
const LABEL = "text-[11px] font-bold text-muted-foreground/75 mb-0.5";

const TrainingZone = () => {
  const navigate = useNavigate();
  const { program, logs, currentWeek, todayDayIndex, isLoading } = useCoachProgram();

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
      <div className={ROW}>
        <button
          type="button"
          onClick={() => go("/coach/program")}
          aria-label="Build your training program"
          className={BODY}
        >
          <p className={LABEL}>Training</p>
          <p className="text-[14px] font-bold leading-tight">No program yet</p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
            A few questions, then four weeks built around your week.
          </p>
        </button>
        <div className="pr-2 shrink-0">
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => go("/coach/program")}>
            Build
          </Button>
        </div>
      </div>
    );
  }

  const week = program.plan_json?.weeks?.find((w) => w.week === currentWeek);
  const day = week?.days?.[todayDayIndex];
  const done = logs.some(
    (l) => l.week === currentWeek && l.day_index === todayDayIndex && l.completed,
  );

  const open = () => go("/coach/program");
  // Start goes straight into the runner — the whole point is removing the
  // steps between "I have a session" and "I am doing it".
  const startSession = () => go(`/coach/session/${currentWeek}/${todayDayIndex}`);

  return (
    <div className={ROW}>
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
          <p className="text-[14px] font-bold leading-tight">Your week is ready</p>
        ) : isRestDay(day) ? (
          <>
            <p className="text-[14px] font-bold leading-tight">Rest day</p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
              Recovery is part of the program, not a gap in it.
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-bold leading-tight truncate">
              {done && <Check aria-hidden size={13} className="inline mr-1 text-xp-green" />}
              {dayFocus(day) || "Today's session"}
            </p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
              {done ? "Logged today" : daySummary(day) || "Tap to see today's exercises"}
            </p>
          </>
        )}
      </button>

      {/* One action, and only when there is something to actually do. A rest
          day with a Start button would be asking for the wrong thing. */}
      {isTrainingDay(day) && !done && (
        <div className="pr-2 shrink-0">
          <Button variant="outline" size="sm" className="min-h-11" onClick={startSession}>
            Start
          </Button>
        </div>
      )}
    </div>
  );
};

export default TrainingZone;
