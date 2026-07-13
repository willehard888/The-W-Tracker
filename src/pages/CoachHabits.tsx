import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import HabitsTab from "@/components/coach/HabitsTab";
import { useUserHabits } from "@/hooks/use-user-habits";

/**
 * /coach/habits — full habit management page.
 *
 * Wraps HabitsTab but adds a welcome state and a clear path to the
 * Protocol Library for users with 0 active habits. HabitsTab itself
 * has an empty-state card, but we add a stronger explainer here so
 * the page never feels barren.
 */
const CoachHabits = () => {
  const navigate = useNavigate();
  const { habits, isLoading } = useUserHabits();

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <Sparkles size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Habits</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-4">
        {/* Welcome intro — visible for first-time users */}
        {!isLoading && habits.length === 0 && (
          <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-gold" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
                Welcome to your habit stack
              </p>
            </div>
            <p className="text-[13px] leading-snug text-foreground/90 mb-3">
              Pick up to <strong>8 evidence-graded protocols</strong> you want
              to compound. Aim for one per pillar: sleep, movement, nutrition,
              mind, recovery, connection.
            </p>
            <Button
              variant="ember"
              size="default"
              onClick={() => navigate("/coach/library")}
              className="w-full"
            >
              <BookOpen size={14} /> Browse protocol library
            </Button>
          </div>
        )}

        {/* Quick-add button always visible when user has at least one habit
            but isn't yet at the cap */}
        {!isLoading && habits.length > 0 && habits.length < 8 && (
          <button
            type="button"
            onClick={() => navigate("/coach/library")}
            className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-gold/30 px-4 py-3 hover:bg-gold/[0.04] transition-colors active:scale-[0.99] text-left"
          >
            <div className="h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Plus size={14} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold">Add another habit</p>
              <p className="text-[10px] text-muted-foreground">
                {8 - habits.length} slot{8 - habits.length === 1 ? "" : "s"} left.
              </p>
            </div>
          </button>
        )}

        {/* The actual habits + level legend + pillar coverage */}
        <HabitsTab />
      </div>
    </div>
  );
};

export default CoachHabits;
