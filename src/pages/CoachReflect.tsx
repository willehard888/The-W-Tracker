import { useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col h-full">
      <div className="shrink-0 page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <Moon size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Evening reflection</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-4">
        {/* Intro card — always visible */}
        <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} className="text-gold" />
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold">
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
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
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
    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
    <p className={`text-sm font-display font-black ${good ? "text-gold" : "text-foreground/85"}`}>{value}</p>
  </div>
);

export default CoachReflect;
