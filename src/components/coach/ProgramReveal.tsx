import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { fmtInt } from "@/lib/format";
import type { CoachProgram } from "@/hooks/use-coach-program";
import { isTrainingDay, dayFocus } from "@/lib/training/session";

/**
 * The moment the program is created.
 *
 * Generating a program takes twenty-five seconds of "Coach is designing your
 * block" and used to drop the athlete into a nested accordion of four weeks ×
 * seven days with nothing saying what had been built or where to begin.
 *
 * This is the coach's own first sentence as the screen's beat, one standing
 * line with the three facts that make the plan legible, this week's focuses,
 * and ONE action. It is not a modal and it does not block: it sits at the top
 * of the program screen and is dismissed by starting.
 */

/**
 * The summary is 3–4 sentences in the athlete's voice. Its first sentence is
 * the display line when it fits one; the rest follows quietly underneath.
 */
const splitLead = (summary: string | null): [string, string] => {
  const m = summary?.match(/^\s*([^.!?]+[.!?])\s*([\s\S]*)$/);
  if (m && m[1].length <= 100) return [m[1], m[2].trim()];
  return ["Your program is ready.", summary?.trim() ?? ""];
};

const N = ({ children }: { children: ReactNode }) => (
  <span className="font-black text-foreground tabular-nums">{children}</span>
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
  const trainingDays = (week?.days ?? []).filter((d) => isTrainingDay(d));
  const n = trainingDays.length;

  // The advertised session length, averaged over the days that actually have
  // work in them — a plan with four rest days would otherwise report half.
  const avgMin = n
    ? Math.round(trainingDays.reduce((sum, d) => sum + (d.duration_min ?? 0), 0) / n)
    : 0;

  const focusList = [...new Set(trainingDays.map((d) => dayFocus(d)).filter(Boolean))];
  const [lead, rest] = splitLead(program.ai_summary);

  return (
    <section>
      <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{lead}</h2>
      {rest && <p className="mt-2 text-[13px] text-foreground/85 leading-snug">{rest}</p>}

      <p className="mt-2 text-[13px] text-muted-foreground">
        <N>{fmtInt(n)}</N> {n === 1 ? "session" : "sessions"}
        {avgMin > 0 && <> · ~<N>{fmtInt(avgMin)}</N> min</>}
        {" · "}week <N>{fmtInt(currentWeek)}</N> of {fmtInt(program.weeks ?? 4)}
      </p>
      {focusList.length > 0 && (
        <p className="mt-1 text-[13px] text-muted-foreground">{focusList.join(" · ")}</p>
      )}

      <Button
        variant="ember"
        size="lg"
        className="w-full mt-4"
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
