import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import { pickDaily } from "@/lib/daily-rotation";
import { DAILY_INSIGHTS } from "@/data/daily-insights";
import { hapticImpact } from "@/lib/haptics";

/**
 * One Inner Work insight per day on Home — deterministic rotation (salted so
 * it doesn't move in lockstep with the header quote), deep-linking into the
 * matching Vault lesson. Shown to everyone: non-premium taps land on Vault's
 * paywall redirect, so the card doubles as a conversion teaser.
 */
const DailyInsightCard = () => {
  const navigate = useNavigate();
  const insight = pickDaily(DAILY_INSIGHTS, "insight");

  return (
    <button
      type="button"
      onClick={() => {
        hapticImpact("light");
        navigate(`/vault?lesson=${insight.lessonSlug}`);
      }}
      className="w-full text-left rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="eyebrow text-gold/85 mb-1">
            Daily insight
          </p>
          <p className="text-[13px] font-semibold text-foreground/90 leading-snug">
            {insight.text}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground mt-1.5">
            The Vault — tap to open the lesson
          </p>
        </div>
        <ChevronRight size={16} className="text-gold/60 shrink-0 mt-1" />
      </div>
    </button>
  );
};

export default DailyInsightCard;
