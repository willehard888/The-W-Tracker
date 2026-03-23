import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakDisplayProps {
  streak: number;
  longestStreak: number;
  className?: string;
}

const getStreakTier = (streak: number) => {
  if (streak >= 100) return "inferno";
  if (streak >= 30) return "blazing";
  if (streak >= 14) return "burning";
  if (streak >= 7) return "warming";
  return "spark";
};

const tierConfig = {
  spark: {
    label: "Spark",
    borderClass: "border-[hsl(var(--streak-orange))]/20",
    iconClass: "text-[hsl(var(--streak-orange))]/60",
    iconBg: "bg-[hsl(var(--streak-orange))]/10",
    valueClass: "text-[hsl(var(--streak-orange))]/70",
    flames: 1,
  },
  warming: {
    label: "Warming Up",
    borderClass: "border-[hsl(var(--streak-orange))]/30",
    iconClass: "text-[hsl(var(--streak-orange))]",
    iconBg: "bg-[hsl(var(--streak-orange))]/15",
    valueClass: "text-[hsl(var(--streak-orange))]",
    flames: 2,
  },
  burning: {
    label: "On Fire",
    borderClass: "border-[hsl(var(--streak-orange))]/40",
    iconClass: "text-[hsl(var(--streak-orange))]",
    iconBg: "bg-[hsl(var(--streak-orange))]/20",
    valueClass: "text-[hsl(var(--streak-orange))]",
    flames: 3,
  },
  blazing: {
    label: "Blazing",
    borderClass: "border-gold/40",
    iconClass: "text-gold",
    iconBg: "gradient-gold",
    valueClass: "text-gold",
    flames: 4,
  },
  inferno: {
    label: "Inferno",
    borderClass: "border-gold/50",
    iconClass: "text-gold",
    iconBg: "gradient-gold",
    valueClass: "text-gold",
    flames: 5,
  },
};

const StreakDisplay = ({ streak, longestStreak, className }: StreakDisplayProps) => {
  const tier = getStreakTier(streak);
  const config = tierConfig[tier];
  const isHighTier = tier === "blazing" || tier === "inferno";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-4 card-hover card-depth overflow-hidden",
        config.borderClass,
        isHighTier && "shadow-[0_0_20px_hsl(var(--streak-orange)/0.15)]",
        className
      )}
    >
      {/* Background glow for high tiers */}
      {tier === "burning" && (
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--streak-orange))]/5 to-transparent pointer-events-none" />
      )}
      {tier === "blazing" && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, hsl(18 95% 58% / 0.08), hsl(42 78% 54% / 0.05), transparent 60%)" }}
        />
      )}
      {tier === "inferno" && (
        <>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, hsl(0 80% 50% / 0.06), hsl(18 95% 58% / 0.08), hsl(42 78% 54% / 0.06))" }}
          />
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none opacity-60 blur-xl animate-pulse"
            style={{ background: "radial-gradient(circle, hsl(18 95% 58% / 0.25) 0%, transparent 70%)" }}
          />
        </>
      )}

      <div className="relative flex items-start gap-3">
        {/* Icon with stacked flames for high tiers */}
        <div className="relative">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              config.iconBg,
              isHighTier && "text-primary-foreground shadow-[0_0_12px_hsl(var(--streak-orange)/0.3)]"
            )}
          >
            <Flame size={18} className={cn(!isHighTier && config.iconClass)} />
          </div>
          {/* Extra flame indicators */}
          {tier === "burning" && (
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[hsl(var(--streak-orange))] animate-pulse shadow-[0_0_6px_hsl(var(--streak-orange)/0.5)]" />
          )}
          {isHighTier && (
            <>
              <div className="absolute -top-1.5 -right-1 w-3.5 h-3.5 rounded-full bg-gold animate-pulse shadow-[0_0_8px_hsl(var(--gold)/0.5)]" />
              <div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-[hsl(var(--streak-orange))] animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_6px_hsl(var(--streak-orange)/0.4)]" />
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Streak</p>
            {streak >= 7 && (
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                tier === "warming" && "bg-[hsl(var(--streak-orange))]/10 text-[hsl(var(--streak-orange))]/80",
                tier === "burning" && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
                tier === "blazing" && "bg-gold/15 text-gold",
                tier === "inferno" && "bg-gold/20 text-gold glow-gold-text",
              )}>
                {config.label}
              </span>
            )}
          </div>
          <p className={cn(
            "text-2xl font-bold font-display tracking-tight leading-tight mt-0.5",
            config.valueClass,
            isHighTier && "glow-gold-text font-black",
            tier === "inferno" && "drop-shadow-[0_0_6px_hsl(var(--streak-orange)/0.4)]",
          )}>
            {streak}d
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Best: {longestStreak}d</p>
        </div>
      </div>

      {/* Flame bar at bottom for 14+ */}
      {streak >= 14 && (
        <div className="relative mt-3 h-1 rounded-full bg-secondary/80 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min(100, (streak / (tier === "inferno" ? 365 : tier === "blazing" ? 100 : 30)) * 100)}%`,
              background: isHighTier
                ? "linear-gradient(90deg, hsl(18 95% 58%), hsl(42 78% 54%))"
                : "hsl(18 95% 58% / 0.7)",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default StreakDisplay;
