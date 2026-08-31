import { useNavigate } from "react-router-dom";
import { ChevronRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDailyPlan } from "@/hooks/use-daily-plan";

/**
 * The coach's plan for today, on Today.
 *
 * Home's hero is the check-in, and once that's banked the card goes inert
 * ("Come back tomorrow") — so the most valuable screen in the app spent most
 * of the day telling people there was nothing to do, while the coach sat one
 * tab away holding unfinished missions for that same user. This strip closes
 * that gap: it's the reason to open the app at 3pm rather than only at 9pm.
 *
 * Deliberately read-only. TodaysPlanCard on Coach owns generating a plan and
 * completing missions; duplicating either here would mean two code paths for
 * the same writes, and would fire the coach-daily-plan edge function on every
 * Home mount. If there's no plan yet, this renders nothing at all.
 */
const readinessTone = (score: number) =>
  score >= 70 ? "text-gold" : score >= 40 ? "text-foreground" : "text-[hsl(var(--ember))]";

const TodayPlanStrip = () => {
  const navigate = useNavigate();
  const { plan, done, total, isLoading } = useDailyPlan();

  // No plan yet (or still loading) → stay out of the way rather than render a
  // placeholder. Generating one is Coach's job.
  if (isLoading || !plan || total === 0) return null;

  const complete = done >= total;

  return (
    <button
      type="button"
      onClick={() => navigate("/coach")}
      aria-label={`Today's plan, ${done} of ${total} done. Open coach.`}
      className="surface-card w-full text-left p-4 flex items-center gap-3.5 active:scale-[0.99] transition-transform"
    >
      <div
        aria-hidden
        className={cn(
          "h-12 w-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border",
          complete
            ? "border-gold/40 bg-gold/10"
            : "border-border bg-secondary/60",
        )}
      >
        <span className={cn("font-display font-black text-[19px] leading-none tabular-nums", readinessTone(plan.readiness_score))}>
          {plan.readiness_score}
        </span>
        <span className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground mt-0.5">
          Ready
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold mb-0.5">
          Today&apos;s plan
        </p>
        <p className="font-display font-black text-[15px] leading-tight truncate">
          {plan.headline ?? "Your session is ready"}
        </p>
        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
          {complete
            ? "All missions done. That's the day."
            : `${done} of ${total} missions done`}
        </p>
      </div>

      {/* Progress is stated in the text above too — never colour or shape alone. */}
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
          <Target aria-hidden size={12} className={complete ? "text-gold" : "text-muted-foreground"} strokeWidth={2.6} />
          <span className="font-display font-black text-[13px] tabular-nums leading-none">
            {done}/{total}
          </span>
        </span>
        <ChevronRight aria-hidden size={18} className="text-muted-foreground" />
      </div>
    </button>
  );
};

export default TodayPlanStrip;
