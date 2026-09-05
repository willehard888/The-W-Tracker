import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import GoalTrackerCard from "@/components/coach/GoalTrackerCard";

/**
 * /coach/goal — full long-term goal page.
 *
 * Wraps GoalTrackerCard but adds an intro + "how this works" so the
 * page is meaningful even with zero goals set.
 */
const CoachGoal = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-full">
      <PageBar title="North Star goal" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Intro */}
        <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} className="text-gold" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold">
              Your one big goal
            </p>
          </div>
          <p className="text-[13px] leading-snug text-foreground/90">
            Pick ONE measurable goal you want to compound toward.
            Specific number, deadline. The Coach checks weekly that your
            training, sleep, and nutrition are pulling in that direction.
          </p>
        </div>

        {/* The actual tracker — handles its own empty / form / active states */}
        <GoalTrackerCard />

        {/* How this works */}
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen size={11} className="text-muted-foreground" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              How it works
            </p>
          </div>
          <ul className="space-y-1.5 text-[12px] text-muted-foreground leading-snug">
            <li>• <strong className="text-foreground/85">Baseline</strong> — where you are today (kg lifted, km run, …)</li>
            <li>• <strong className="text-foreground/85">Target</strong> — where you want to be</li>
            <li>• <strong className="text-foreground/85">Deadline</strong> — a date that creates urgency</li>
            <li>• Update the current value weekly. On/off-pace badge updates automatically.</li>
          </ul>
        </div>

        {/* Examples */}
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Example goals
          </p>
          <ul className="space-y-1 text-[12px] text-muted-foreground leading-snug">
            <li>• Bench 100 kg by 1st August</li>
            <li>• Run 10 km under 50 min by October</li>
            <li>• 12% bodyfat by year-end</li>
            <li>• Sleep 8 h average for 30 consecutive days</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CoachGoal;
