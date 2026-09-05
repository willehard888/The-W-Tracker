import { useNavigate } from "react-router-dom";
import { BookOpen, Sparkles } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import EveningReflectionCard from "@/components/coach/EveningReflectionCard";
import { useTodayReflection } from "@/hooks/use-coach-reflection";

/**
 * /coach/reflect — full evening reflection page.
 *
 * Wraps the existing EveningReflectionCard but adds context so the page
 * is never blank — even while the reflection query is loading, the
 * "what is this" intro + "why bother" tiles always render.
 */
const CoachReflect = () => {
  const navigate = useNavigate();
  const { reflection, isLoading } = useTodayReflection();

  return (
    <div className="min-h-full">
      <PageBar title="Evening reflection" onBack={() => navigate(-1)} />

      <div className="home-rise px-4 pt-4 pb-6 space-y-4">
        {/* Intro card — always visible */}
        <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} className="text-gold" />
            <p className="eyebrow text-gold">
              60 seconds before bed
            </p>
          </div>
          <p className="text-[13px] leading-snug text-foreground/90">
            Rate energy, sleep, mood, and effort. Write your win and your friction.
            The Coach uses these to tune tomorrow's plan and your weekly review.
          </p>
        </div>

        {/* Status: today done or pending */}
        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="Today"
            value={isLoading ? "…" : reflection ? "Logged" : "Not yet"}
            good={!!reflection}
          />
          <Tile
            label="Best when"
            value="22:00–23:30"
            good={false}
          />
        </div>

        {/* The actual reflection form. Component returns null while loading
            so we render our own skeleton in the gap. */}
        {isLoading ? (
          <div className="h-32 surface-card skeleton-block" />
        ) : (
          <EveningReflectionCard />
        )}

        {/* Why bother — keeps the page useful even with no reflection yet */}
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen size={11} className="text-muted-foreground" />
            <p className="eyebrow text-muted-foreground">
              Why this matters
            </p>
          </div>
          <ul className="space-y-1.5 text-[12px] text-muted-foreground leading-snug">
            <li>• Tomorrow's <strong className="text-foreground/85">Move</strong> picks adapt to last night's energy + sleep score.</li>
            <li>• Friction text feeds the Weekly Review so patterns surface.</li>
            <li>• 5+ logged reflections/week → Coach starts spotting your specific drivers.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const Tile = ({ label, value, good }: { label: string; value: string; good: boolean }) => (
  <div className={`rounded-xl border px-3 py-2 ${good ? "border-gold/35 bg-gold/[0.05]" : "border-border/40 bg-card/40"}`}>
    <p className="eyebrow-sm text-muted-foreground mb-0.5">{label}</p>
    <p className={`text-sm font-display font-black ${good ? "text-gold" : "text-foreground/85"}`}>{value}</p>
  </div>
);

export default CoachReflect;
