import { AlertTriangle, Flame, ChevronRight } from "lucide-react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { TierRiskState } from "@/hooks/use-tier-risk";

interface TierRiskBannerProps {
  risk: TierRiskState;
  className?: string;
}

// A tone-aware sub-copy bank lived here — four coach voices × two risks, each
// a second sentence under the headline. The headline carries both the deadline
// and the stake on its own, so the bank went with the line it fed. That also
// takes `useAthleteProfile()` off this component: it was a query run on every
// Home render that had a banner, to choose a sentence nobody needed.

const TierRiskBanner = ({ risk, className }: TierRiskBannerProps) => {
  const navigate = useNavigate();

  if (risk.level === "safe" || !risk.previousTierLabel) return null;

  const isDanger = risk.level === "danger";
  const isStreak = risk.reason === "streak";

  const headline = isStreak
    ? isDanger && (risk.hoursUntilStreakBreak ?? 0) <= 0
      ? `Streak about to break`
      : `Lose streak in ${risk.hoursUntilStreakBreak ?? 0}h ${risk.minutesUntilStreakBreak ?? 0}m`
    : `Lose ${risk.previousTierLabel ? "your" : ""} status`;

  return (
    <m.button
      type="button"
      onClick={() => navigate("/checkin")}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        // Sized for one line. With two, the 40px icon and p-3.5 were the right
        // frame; with one, they held a 69px box open around a single sentence
        // — the empty space a deletion leaves behind if nothing is re-fitted.
        "w-full text-left rounded-2xl border px-3.5 py-2.5 relative overflow-hidden transition-transform",
        isDanger
          ? "border-destructive/50 bg-destructive/8"
          : "border-gold/40 bg-gold/5",
        className,
      )}
      style={{
        boxShadow: isDanger
          ? "0 0 24px hsl(var(--destructive) / 0.2)"
          : "0 0 16px hsl(var(--gold) / 0.12)",
      }}
    >
      {isDanger && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{
            background: "radial-gradient(ellipse at left, hsl(var(--destructive) / 0.12), transparent 65%)",
          }}
        />
      )}

      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            isDanger ? "bg-destructive/15 text-destructive" : "bg-gold/15 text-gold",
          )}
        >
          {isDanger ? <AlertTriangle aria-hidden size={18} strokeWidth={2.5} /> : <Flame aria-hidden size={18} strokeWidth={2.5} />}
        </div>

        {/* The headline alone. The coach-voiced line under it restated the
            same thing in smaller type — "Lose streak in 4h 43m" already
            carries both the deadline and the stake — and it made this the one
            two-line block on a screen of single lines. One line centres
            against the icon instead of hanging off its top edge. */}
        <p
          className={cn(
            "flex-1 min-w-0 font-display font-black text-sm uppercase tracking-wider truncate",
            isDanger ? "text-destructive" : "text-gold",
          )}
        >
          {headline}
        </p>

        <ChevronRight aria-hidden
          size={18}
          className={cn("shrink-0", isDanger ? "text-destructive/70" : "text-gold/70")}
        />
      </div>
    </m.button>
  );
};

export default TierRiskBanner;
