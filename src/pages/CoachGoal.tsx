import { useNavigate } from "react-router-dom";
import PageBar from "@/components/ui/page-bar";
import GoalTrackerCard from "@/components/coach/GoalTrackerCard";
import { FactRow } from "@/components/coach/rows";

/**
 * /coach/goal — the one long-term goal. A type-only opening, the tracker
 * (it handles its own empty / form / active states), then how it works
 * as hairline rows so the page reads even with zero goals set.
 */
const CoachGoal = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-full">
      <PageBar title="North Star goal" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-[22px] leading-[1.06] tracking-tight">One goal. A number and a date.</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
            The Coach checks weekly that your training, sleep and nutrition are pulling toward it.
          </p>
        </header>

        <div className="home-rise home-rise-1 mt-4">
          <GoalTrackerCard />
        </div>

        <div className="home-rise home-rise-2 mt-5 divide-y divide-border/35 border-t border-border/35">
          <FactRow k="Baseline" v="Where you are today: kg lifted, km run, hours slept." />
          <FactRow k="Target" v="Where you want to be." />
          <FactRow k="Deadline" v="A date that creates urgency. Update the current value weekly and the pace badge follows." />
        </div>
        <p className="mt-4 text-[12px] text-muted-foreground leading-snug">
          Examples: bench 100 kg by 1 August, run 10 km under 50 min by October, 12% body fat by year-end, 8 h of sleep for 30 days straight.
        </p>
      </div>
    </div>
  );
};

export default CoachGoal;
