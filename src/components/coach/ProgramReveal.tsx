import { Sparkles, Target, CalendarDays, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import type { CoachProgram } from "@/hooks/use-coach-program";
import { isTrainingDay, dayFocus } from "@/lib/training/session";

/**
 * The moment the program is created.
 *
 * WHY THIS EXISTS
 *
 * Generating a program took twenty-five seconds of a full-screen "Coach is
 * designing your block" animation and then dropped the athlete into a nested
 * accordion of four weeks × seven days. Nothing said what had been built, why
 * it looked that way, or where to begin. The most expensive moment in the
 * feature ended with a wall of collapsed rows.
 *
 * This states the four facts that make the plan legible — goal, rhythm, session
 * length, where you are in it — and then gives ONE action. Everything else on
 * the screen can wait until after the first session.
 *
 * It is not a modal and it does not block: it sits at the top of the program
 * screen and is dismissed by starting. A missed reveal costs nothing.
 */

const GOAL_LABEL: Record<string, string> = {
  all: "All-around",
  strength: "Raw strength",
  hypertrophy: "Build muscle",
  fat_loss: "Fat loss",
  endurance: "Endurance",
  longevity: "Longevity",
  focus: "Sharpen focus",
};

const Fact = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) => (
  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
    <p className="eyebrow text-muted-foreground/70 mb-1 inline-flex items-center gap-1">
      <Icon size={11} aria-hidden /> {label}
    </p>
    <p className="text-[13px] font-bold leading-snug text-foreground">{value}</p>
  </div>
);

const ProgramReveal = ({
  program,
  currentWeek,
  onStart,
}: {
  program: CoachProgram;
  currentWeek: number;
  onStart: () => void;
}) => {
  const week = program.plan_json?.weeks?.find((w) => w.week === currentWeek);
  const days = week?.days ?? [];
  const trainingDays = days.filter((d) => isTrainingDay(d));

  // The advertised session length, averaged over the days that actually have
  // work in them — a plan with four rest days would otherwise report half.
  const avgMin = trainingDays.length
    ? Math.round(
        trainingDays.reduce((sum, d) => sum + (d.duration_min ?? 0), 0) / trainingDays.length,
      )
    : 0;

  const focusList = [...new Set(trainingDays.map((d) => dayFocus(d)).filter(Boolean))];

  return (
    <section className="rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/[0.08] via-card/95 to-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={12} className="text-gold" aria-hidden />
        <p className="eyebrow text-gold">Your program is ready</p>
      </div>

      {program.ai_summary && (
        <p className="text-[13.5px] text-foreground/90 leading-relaxed mb-4">
          {program.ai_summary}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Fact
          icon={Target}
          label="Goal"
          value={GOAL_LABEL[program.goal] ?? program.goal ?? "All-around"}
        />
        <Fact
          icon={CalendarDays}
          label="Schedule"
          value={`${trainingDays.length} ${trainingDays.length === 1 ? "session" : "sessions"} / week`}
        />
        <Fact
          icon={Clock}
          label="Session"
          value={avgMin ? `~${avgMin} min` : "Varies"}
        />
        <Fact
          icon={TrendingUp}
          label="Week"
          value={`${currentWeek} of ${program.weeks ?? 4}`}
        />
      </div>

      {focusList.length > 0 && (
        <div className="mb-4">
          <p className="eyebrow text-muted-foreground/70 mb-1.5">This week</p>
          <div className="flex flex-wrap gap-1.5">
            {focusList.map((f) => (
              <span
                key={f}
                className="text-[11px] font-bold text-foreground/85 bg-secondary/50 border border-border/40 rounded-full px-2.5 py-1"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[12px] text-muted-foreground leading-snug mb-4">
        Log the weight you use each session. The next block is built from those
        numbers, so the plan gets more yours the more you record.
      </p>

      <Button
        variant="ember"
        size="lg"
        className="w-full"
        onClick={() => {
          hapticImpact("medium");
          onStart();
        }}
      >
        Start your first session
      </Button>
    </section>
  );
};

export default ProgramReveal;
