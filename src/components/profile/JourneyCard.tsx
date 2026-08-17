import { useNavigate } from "react-router-dom";
import { Compass, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * JourneyCard — entry point on Profile to the Growth Mirror (/journey).
 * A single, inviting tap into the longitudinal view: trends + reflection diary.
 * Kept intentionally light (no data fetch here) so the Profile page stays fast;
 * the Journey page loads its own data.
 */
const JourneyCard = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/journey")}
      className={cn(
        "w-full text-left rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card",
        "p-5 active:scale-[0.99] transition-transform shadow-[0_18px_48px_-24px_hsl(var(--gold)/0.4)]",
        className,
      )}
      aria-label="Open your journey"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(var(--gold)/0.4)]">
          <Compass size={17} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/80">
            Your journey
          </p>
          <p className="text-sm font-bold text-foreground leading-tight">
            See how far you've come
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Trends, momentum & your reflection diary
          </p>
        </div>
        <ChevronRight size={16} className="text-gold/60 shrink-0" aria-hidden />
      </div>
    </button>
  );
};

export default JourneyCard;
