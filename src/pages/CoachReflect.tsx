import { useNavigate } from "react-router-dom";
import PageBar from "@/components/ui/page-bar";
import EveningReflectionCard from "@/components/coach/EveningReflectionCard";
import { FactRow } from "@/components/coach/rows";
import { useTodayReflection } from "@/hooks/use-coach-reflection";

/**
 * /coach/reflect — the evening reflection. Status as the one eyebrow, a
 * type-only opening, the form, then why it matters as hairline rows so
 * the page is never blank while the reflection query loads.
 */
const CoachReflect = () => {
  const navigate = useNavigate();
  const { reflection, isLoading } = useTodayReflection();

  return (
    <div className="min-h-full">
      <PageBar title="Evening reflection" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <p className="eyebrow-sm">{isLoading ? "…" : reflection ? "Logged tonight" : "Not logged yet"}</p>
          <h2 className="font-display font-black text-[22px] leading-[1.06] tracking-tight mt-1">Sixty seconds before bed.</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
            Rate energy, sleep, mood and effort. Write the win and the friction.
            Best between 22:00 and 23:30; tomorrow's plan and the weekly review read it.
          </p>
        </header>

        {/* The form returns null while loading, so the gap holds a skeleton. */}
        <div className="home-rise home-rise-1 mt-4">
          {isLoading ? <div className="h-32 surface-card skeleton-block" /> : <EveningReflectionCard />}
        </div>

        <div className="home-rise home-rise-2 mt-5 divide-y divide-border/35 border-t border-border/35">
          <FactRow k="Tomorrow" v="Move picks adapt to tonight's energy and sleep score." />
          <FactRow k="Weekly review" v="Your friction feeds it, so patterns surface." />
          <FactRow k="Five a week" v="The Coach starts spotting your specific drivers." />
        </div>
      </div>
    </div>
  );
};

export default CoachReflect;
