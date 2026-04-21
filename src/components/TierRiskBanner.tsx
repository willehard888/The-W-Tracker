import { AlertTriangle, Flame, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { TierRiskState } from "@/hooks/use-tier-risk";

interface TierRiskBannerProps {
  risk: TierRiskState;
  className?: string;
}

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

  const sub = isStreak
    ? `Drop to ${risk.previousTierLabel} if you skip today`
    : `Only ${risk.pointsAboveCutoff?.toFixed(1) ?? "?"} pts above ${risk.previousTierLabel}`;

  return (
    <motion.button
      type="button"
      onClick={() => navigate("/checkin")}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "w-full text-left rounded-2xl border p-3.5 relative overflow-hidden active:scale-[0.99] transition-transform",
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
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            isDanger ? "bg-destructive/15 text-destructive" : "bg-gold/15 text-gold",
          )}
        >
          {isDanger ? <AlertTriangle size={18} strokeWidth={2.5} /> : <Flame size={18} strokeWidth={2.5} />}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-display font-black text-sm uppercase tracking-wider truncate",
              isDanger ? "text-destructive" : "text-gold",
            )}
          >
            {headline}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>
        </div>

        <ChevronRight
          size={18}
          className={cn("shrink-0", isDanger ? "text-destructive/70" : "text-gold/70")}
        />
      </div>
    </motion.button>
  );
};

export default TierRiskBanner;
