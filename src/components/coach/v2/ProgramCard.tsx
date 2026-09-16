import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Dumbbell, ChevronRight, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoachProgram, todaySessionOf } from "@/hooks/use-coach-program";
import { useTodayFocusSession } from "@/hooks/use-focus-session";
import { dayFocus, daySummary } from "@/lib/training/session";
import FocusSessionSheet from "@/components/coach/FocusSessionSheet";

/**
 * The program door. No program yet: the two-minute build. Has one: today's
 * session as a quiet row into /coach/program.
 */
const ProgramCard = () => {
  const navigate = useNavigate();
  const { program, currentWeek, todayDayIndex, isLoading } = useCoachProgram();
  const today = todaySessionOf(program, currentWeek, todayDayIndex);
  const { session } = useTodayFocusSession();
  const [pickOpen, setPickOpen] = useState(false);
  // The door into "train today by focus" — one quiet row under whichever
  // card renders, and the sheet mounts only while open.
  const focusDoor = (
    <>
      <button
        type="button"
        onClick={() => setPickOpen(true)}
        className="press mt-2 w-full min-h-11 flex items-center gap-3 surface-card surface-card-quiet px-4 py-3 text-left"
      >
        <Crosshair size={16} className="text-muted-foreground shrink-0" aria-hidden />
        <span className="flex-1 min-w-0 text-note font-bold leading-tight">Pick today's focus</span>
        <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
      </button>
      {pickOpen && <FocusSessionSheet open onClose={() => setPickOpen(false)} />}
    </>
  );
  // Today's focus session, when one exists, is the day's training — it leads.
  if (session) {
    const d = session.program.plan_json?.weeks?.[0]?.days?.[todayDayIndex];
    const done = !!session.log?.completed;
    const sub = done ? "Logged today" : session.log?.status === "in_progress" ? `In progress · ${daySummary(d)}` : daySummary(d);
    return (
      <>
        <button
          type="button"
          onClick={() => navigate(`/coach/session/1/${todayDayIndex}?p=${session.program.id}`)}
          className="press w-full text-left surface-card surface-card-quiet px-4 py-3.5 flex items-center gap-3"
        >
          <Dumbbell size={16} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="flex-1 min-w-0">
            <span className="block text-note font-bold leading-tight truncate">Today · {dayFocus(d)}</span>
            <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">{sub}</span>
          </span>
          <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
        </button>
        {focusDoor}
        {/* The 4-week program keeps its door on a focus-session day — the
            session leads, the block is still one tap away. */}
        {program && (
          <button
            type="button"
            onClick={() => navigate("/coach/program")}
            className="press mt-2 w-full min-h-11 flex items-center gap-3 surface-card surface-card-quiet px-4 py-3 text-left"
          >
            <CalendarDays size={16} className="text-muted-foreground shrink-0" aria-hidden />
            <span className="flex-1 min-w-0">
              <span className="block text-note font-bold leading-tight truncate">Your 4-week program</span>
              <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">Week {currentWeek}</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
          </button>
        )}
      </>
    );
  }

  // Fetching. Without this the card renders its "no program" branch while the
  // query is still in flight, so anyone who HAS a program sees "Build my
  // program" flash before their real week appears.
  if (isLoading) {
    return (
      <div className="surface-card surface-card-quiet px-4 py-3.5 flex items-center gap-3">
        <Dumbbell size={16} className="text-muted-foreground shrink-0" aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="skeleton-block block h-4 w-2/5 mb-1.5" />
          <span className="skeleton-block block h-3 w-1/4" />
        </span>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-note font-bold leading-snug">Generate your 4-week training program</p>
        <p className="text-meta text-muted-foreground leading-snug mt-0.5">
          Two-minute setup. The plan adapts each week from your logs.
        </p>
        <Button variant="secondary" onClick={() => navigate("/coach/program")} className="w-full mt-3">
          Build my program
        </Button>
        {focusDoor}
      </div>
    );
  }

  const title = !today ? `Week ${currentWeek}` : today.isRest ? "Rest day" : `Day ${todayDayIndex + 1} · ${today.focus}`;
  const sub = !today
    ? "Tap to view your week."
    : today.isRest
      ? "Active recovery, mobility, walk. Earn tomorrow."
      : [today.duration ? `${today.duration} min` : null, today.blocks ? `${today.blocks} blocks` : null].filter(Boolean).join(" · ") || "Open the program";

  return (
    <>
    <button
      type="button"
      onClick={() => navigate("/coach/program")}
      className="press w-full text-left surface-card surface-card-quiet px-4 py-3.5 flex items-center gap-3"
    >
      <Dumbbell size={16} className="text-muted-foreground shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-note font-bold leading-tight truncate">{title}</span>
        <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">{sub}</span>
      </span>
      <ChevronRight size={16} className="text-muted-foreground/75 shrink-0" aria-hidden />
    </button>
    {focusDoor}
    </>
  );
};

export default ProgramCard;
