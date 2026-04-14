import { Flame, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEffectiveStreak, getStreakDeadlineState } from "@/lib/streak";

interface StreakDisplayProps {
  streak: number;
  longestStreak: number;
  className?: string;
  lastCheckinAt?: string | null;
}

const MILESTONES = [
  { days: 3, label: "3d", emoji: "🔥" },
  { days: 7, label: "7d", emoji: "⚡" },
  { days: 14, label: "14d", emoji: "💪" },
  { days: 30, label: "30d", emoji: "👑" },
  { days: 60, label: "60d", emoji: "💎" },
  { days: 100, label: "100d", emoji: "🏆" },
];

const getStreakTier = (streak: number) => {
  if (streak >= 100) return { name: "Legendary", color: "gold", index: 5 };
  if (streak >= 60) return { name: "Diamond", color: "gold", index: 4 };
  if (streak >= 30) return { name: "Champion", color: "gold", index: 3 };
  if (streak >= 14) return { name: "On Fire", color: "orange", index: 2 };
  if (streak >= 7) return { name: "Heating Up", color: "orange", index: 1 };
  if (streak >= 3) return { name: "Ignited", color: "orange", index: 0 };
  return { name: "Start", color: "muted", index: -1 };
};

const StreakParticles = ({ isDiamond, isLegendary }: { isDiamond: boolean; isLegendary: boolean }) => {
  const particles = isLegendary ? 12 : 6;
  const colors = isLegendary
    ? ["hsl(42 78% 54%)", "hsl(42 90% 70%)", "hsl(280 70% 60%)", "hsl(200 80% 65%)", "hsl(350 80% 60%)"]
    : ["hsl(42 78% 54%)", "hsl(42 90% 70%)", "hsl(200 80% 65%)"];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: particles }).map((_, i) => {
        const size = isLegendary ? 3 + Math.random() * 4 : 2 + Math.random() * 3;
        const left = 5 + Math.random() * 90;
        const delay = Math.random() * 5;
        const duration = 3 + Math.random() * 4;
        const color = colors[i % colors.length];

        return (
          <div
            key={i}
            className="absolute rounded-full animate-[streak-particle_var(--dur)_ease-in-out_infinite]"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              bottom: "-4px",
              background: color,
              boxShadow: `0 0 ${size * 2}px ${color}`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              opacity: 0,
            }}
          />
        );
      })}
    </div>
  );
};

const StreakDisplay = ({ streak, longestStreak, className, lastCheckinAt }: StreakDisplayProps) => {
  const displayStreak = getEffectiveStreak(streak, lastCheckinAt);
  const deadline = getStreakDeadlineState(streak, lastCheckinAt);
  const tier = getStreakTier(displayStreak);
  const isHot = tier.index >= 1;
  const isOnFire = tier.index >= 2;
  const isBlazing = tier.index >= 3;
  const isDiamond = tier.index >= 4;
  const isLegendary = tier.index >= 5;

  const currentMilestone = [...MILESTONES].reverse().find((m) => displayStreak >= m.days);
  const nextMilestone = MILESTONES.find((m) => displayStreak < m.days);
  const prevDays = currentMilestone?.days || 0;
  const nextDays = nextMilestone?.days || 365;
  const segmentProgress = Math.min(100, ((displayStreak - prevDays) / (nextDays - prevDays)) * 100);

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-4 overflow-hidden transition-all",
        !isHot && "border-border",
        isHot && !isOnFire && "border-[hsl(var(--streak-orange))]/40 shadow-[0_0_16px_hsl(var(--streak-orange)/0.12)]",
        isOnFire && !isBlazing && "border-[hsl(var(--streak-orange))]/50 animate-[streak-pulse-glow_3s_ease-in-out_infinite]",
        isBlazing && !isDiamond && "border-gold/50 animate-[streak-pulse-glow-gold_3s_ease-in-out_infinite]",
        isDiamond && !isLegendary && "border-[hsl(200_80%_65%)]/50 animate-[streak-pulse-glow-diamond_2.5s_ease-in-out_infinite]",
        isLegendary && "border-[hsl(280_70%_60%)]/50 animate-[streak-pulse-glow-legendary_2s_ease-in-out_infinite]",
        className
      )}
    >
      {/* Ambient glow overlay */}
      {isHot && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isLegendary
              ? "linear-gradient(135deg, hsl(280 70% 60% / 0.1), hsl(42 78% 54% / 0.08), hsl(200 80% 65% / 0.06), transparent 70%)"
              : isDiamond
              ? "linear-gradient(135deg, hsl(200 80% 65% / 0.1), hsl(42 78% 54% / 0.06), transparent 65%)"
              : isBlazing
              ? "linear-gradient(135deg, hsl(42 78% 54% / 0.08), transparent 60%)"
              : isOnFire
              ? "linear-gradient(135deg, hsl(18 95% 58% / 0.1), hsl(42 78% 54% / 0.04), transparent 70%)"
              : "linear-gradient(135deg, hsl(18 95% 58% / 0.06), transparent 60%)",
          }}
        />
      )}

      {/* Legendary rainbow shimmer */}
      {isLegendary && (
        <div
          className="absolute inset-0 pointer-events-none animate-[streak-rainbow_4s_linear_infinite]"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(280 70% 60% / 0.06), hsl(42 78% 54% / 0.06), hsl(200 80% 65% / 0.06), transparent)",
            backgroundSize: "200% 100%",
          }}
        />
      )}

      {/* Floating particles for 60+ */}
      {isDiamond && <StreakParticles isDiamond={isDiamond} isLegendary={isLegendary} />}

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-all",
              !isHot && "bg-secondary text-muted-foreground",
              isHot && !isOnFire && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
              isOnFire && !isBlazing && "bg-[hsl(var(--streak-orange))]/20 text-[hsl(var(--streak-orange))] shadow-[0_0_16px_hsl(var(--streak-orange)/0.25)]",
              isBlazing && !isDiamond && "gradient-gold text-primary-foreground shadow-[0_0_20px_hsl(var(--gold)/0.4)]",
              isDiamond && !isLegendary && "bg-gradient-to-br from-[hsl(200_80%_55%)] to-[hsl(42_78%_54%)] text-white shadow-[0_0_24px_hsl(200_80%_65%/0.4)]",
              isLegendary && "bg-gradient-to-br from-[hsl(280_70%_55%)] via-[hsl(42_78%_54%)] to-[hsl(350_80%_55%)] text-white shadow-[0_0_28px_hsl(280_70%_60%/0.5)]"
            )}
          >
            <Flame
              size={20}
              className={cn(
                isHot && !isOnFire && "animate-[streak-fire_2.2s_ease-in-out_infinite]",
                isOnFire && !isBlazing && "animate-[streak-fire_1.6s_ease-in-out_infinite]",
                isBlazing && !isDiamond && "animate-[streak-fire_1.2s_ease-in-out_infinite]",
                isDiamond && "animate-[streak-fire_0.9s_ease-in-out_infinite]"
              )}
            />
          </div>

          {/* Sparkle icon for legendary */}
          {isLegendary && (
            <Sparkles
              size={16}
              className="absolute top-3 right-3 text-[hsl(280_70%_65%)] animate-[streak-fire_2s_ease-in-out_infinite]"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "font-black font-display tabular-nums leading-none tracking-tighter text-7xl",
                  !isHot && "text-foreground",
                  isHot && !isOnFire && "text-[hsl(var(--streak-orange))]",
                  isOnFire && !isBlazing && "text-[hsl(var(--streak-orange))] animate-[streak-number-pulse_3s_ease-in-out_infinite]",
                  isBlazing && !isDiamond && "text-gold animate-[streak-number-pulse_2.5s_ease-in-out_infinite]",
                  isDiamond && !isLegendary && "streak-diamond-text animate-[streak-number-pulse_2s_ease-in-out_infinite]",
                  isLegendary && "streak-legendary-text animate-[streak-number-pulse_1.8s_ease-in-out_infinite]"
                )}
              >
                {displayStreak}
              </span>
              <span className="text-sm font-bold text-muted-foreground">days</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {tier.index >= 0 && (
                <span
                  className={cn(
                    "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                    !isHot && "bg-[hsl(var(--streak-orange))]/10 text-[hsl(var(--streak-orange))]/80",
                    isHot && !isOnFire && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
                    isOnFire && !isBlazing && "bg-[hsl(var(--streak-orange))]/20 text-[hsl(var(--streak-orange))] shadow-[0_0_8px_hsl(var(--streak-orange)/0.15)]",
                    isBlazing && !isDiamond && "bg-gold/15 text-gold shadow-[0_0_8px_hsl(var(--gold)/0.2)]",
                    isDiamond && !isLegendary && "bg-[hsl(200_80%_65%)]/15 text-[hsl(200_80%_65%)] shadow-[0_0_10px_hsl(200_80%_65%/0.2)]",
                    isLegendary && "bg-[hsl(280_70%_60%)]/15 text-[hsl(280_70%_65%)] shadow-[0_0_12px_hsl(280_70%_60%/0.25)] animate-[streak-badge-shimmer_3s_ease-in-out_infinite]"
                  )}
                >
                  {isDiamond && !isLegendary && "💎 "}
                  {isLegendary && "🏆 "}
                  {tier.name}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/60">Best: {longestStreak}d</span>
            </div>
          </div>
        </div>

        {/* Milestone progress track */}
        <div className="flex items-center gap-[3px]">
          {MILESTONES.map((m) => {
            const reached = streak >= m.days;
            const isNext = nextMilestone?.days === m.days;
            const isPast = currentMilestone && m.days <= currentMilestone.days;

            return (
              <div key={m.days} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-full h-2 rounded-full overflow-hidden transition-all duration-500",
                    !reached && "bg-secondary/60"
                  )}
                >
                  {isPast ? (
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        background: isLegendary
                          ? "linear-gradient(90deg, hsl(280 70% 55%), hsl(42 78% 54%), hsl(200 80% 60%))"
                          : isDiamond
                          ? "linear-gradient(90deg, hsl(200 80% 55%), hsl(42 78% 54%))"
                          : isBlazing
                          ? "linear-gradient(90deg, hsl(18 95% 58%), hsl(42 78% 54%))"
                          : "hsl(18 95% 58%)",
                      }}
                    />
                  ) : isNext ? (
                    <div
                      className="h-full rounded-full transition-all duration-1000 relative"
                      style={{
                        width: `${Math.max(8, segmentProgress)}%`,
                        background: isLegendary
                          ? "linear-gradient(90deg, hsl(280 70% 60%), hsl(42 85% 70%))"
                          : isDiamond
                          ? "linear-gradient(90deg, hsl(200 80% 60%), hsl(42 85% 70%))"
                          : isBlazing
                          ? "linear-gradient(90deg, hsl(42 78% 54%), hsl(42 85% 70%))"
                          : isHot
                          ? "hsl(18 95% 58%)"
                          : "hsl(18 95% 58% / 0.7)",
                      }}
                    >
                      <div className="absolute inset-0 overflow-hidden rounded-full">
                        <div
                          className="absolute inset-0 -translate-x-full animate-[shine_3s_ease-in-out_infinite]"
                          style={{
                            background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.4), transparent)",
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={cn("text-center transition-all", reached ? "opacity-100" : isNext ? "opacity-70" : "opacity-30")}>
                  <span
                    className={cn(
                      "text-[8px] font-bold tabular-nums block leading-none",
                      reached && isLegendary && "text-[hsl(280_70%_65%)]",
                      reached && isDiamond && !isLegendary && "text-[hsl(200_80%_65%)]",
                      reached && isBlazing && !isDiamond && "text-gold",
                      reached && !isBlazing && "text-[hsl(var(--streak-orange))]",
                      !reached && "text-muted-foreground"
                    )}
                  >
                    {m.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next milestone CTA */}
        {nextMilestone && (
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "font-bold",
                  isLegendary
                    ? "text-[hsl(280_70%_65%)]"
                    : isDiamond
                    ? "text-[hsl(200_80%_65%)]"
                    : isBlazing
                    ? "text-gold"
                    : isHot
                    ? "text-[hsl(var(--streak-orange))]"
                    : "text-foreground"
                )}
              >
                {nextMilestone.days - displayStreak}d
              </span>{" "}
              to {nextMilestone.emoji} {nextMilestone.label} milestone
            </p>
            <ChevronRight size={12} className="text-muted-foreground/40" />
          </div>
        )}

        {/* Pressure microcopy */}
        {displayStreak >= 3 && (
          <div className="mt-2 pt-2 border-t border-border/20">
            <p className="text-[9px] text-muted-foreground/60 font-semibold text-center italic">
              {displayStreak >= 60 ? "🔱 Few ever reach this. Don't stop." :
               displayStreak >= 30 ? "👑 Most fail before this point." :
               displayStreak >= 14 ? "💪 Don't break now. Keep pushing." :
               displayStreak >= 7 ? "⚡ You're heating up. Stay locked in." :
               "🔥 Keep going. Consistency is everything."}
            </p>
          </div>
        )}

        {!nextMilestone && (
          <div className="flex items-center justify-center mt-2.5 pt-2 border-t border-gold/20">
            <span className={cn(
              "text-[10px] font-bold",
              isLegendary ? "text-[hsl(280_70%_65%)]" : "text-gold"
            )}>
              🏆 All milestones reached!
            </span>
          </div>
        )}

        {/* Streak deadline warning */}
        {deadline && streak > 0 && (
          <div className={cn(
            "flex items-center justify-between mt-2 pt-2 border-t",
            deadline.expired
              ? "border-destructive/30"
              : deadline.urgent
              ? "border-destructive/20"
              : "border-border/30"
          )}>
            {deadline.expired ? (
              <p className="text-[10px] font-bold text-destructive animate-pulse">
                💀 Streak at risk! Check in NOW
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                <span className={cn(
                  "font-bold tabular-nums",
                  deadline.urgent ? "text-destructive" : "text-foreground"
                )}>
                  {deadline.urgent && "⚠️ "}
                  {deadline.hours}h {deadline.mins}m
                </span>
                {" "}until streak loss
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StreakDisplay;
