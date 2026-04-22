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
        "relative rounded-2xl border-2 bg-gradient-to-br from-card via-card to-card/80 p-5 overflow-hidden transition-all",
        // Stronger base shadow always
        "shadow-[0_8px_32px_-8px_hsl(0_0%_0%/0.4)]",
        !isHot && "border-border/80",
        isHot && !isOnFire && "border-[hsl(var(--streak-orange))]/60 shadow-[0_0_28px_hsl(var(--streak-orange)/0.22),inset_0_1px_0_hsl(var(--streak-orange)/0.15)]",
        isOnFire && !isBlazing && "border-[hsl(var(--streak-orange))]/70 shadow-[0_0_36px_hsl(var(--streak-orange)/0.32),inset_0_1px_0_hsl(var(--streak-orange)/0.2)] animate-[streak-pulse-glow_3s_ease-in-out_infinite]",
        isBlazing && !isDiamond && "border-gold/70 shadow-[0_0_44px_hsl(var(--gold)/0.4),inset_0_1px_0_hsl(var(--gold)/0.25)] animate-[streak-pulse-glow-gold_3s_ease-in-out_infinite]",
        isDiamond && !isLegendary && "border-[hsl(200_80%_65%)]/70 shadow-[0_0_48px_hsl(200_80%_65%/0.4),inset_0_1px_0_hsl(200_80%_65%/0.25)] animate-[streak-pulse-glow-diamond_2.5s_ease-in-out_infinite]",
        isLegendary && "border-[hsl(280_70%_60%)]/70 shadow-[0_0_56px_hsl(280_70%_60%/0.45),inset_0_1px_0_hsl(280_70%_60%/0.3)] animate-[streak-pulse-glow-legendary_2s_ease-in-out_infinite]",
        className
      )}
    >
      {/* Top accent ribbon */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-[3px] pointer-events-none",
          !isHot && "bg-gradient-to-r from-transparent via-border to-transparent",
          isHot && !isOnFire && "bg-gradient-to-r from-transparent via-[hsl(var(--streak-orange))] to-transparent opacity-70",
          isOnFire && !isBlazing && "bg-gradient-to-r from-transparent via-[hsl(var(--streak-orange))] to-transparent",
          isBlazing && !isDiamond && "bg-gradient-to-r from-transparent via-gold to-transparent",
          isDiamond && !isLegendary && "bg-gradient-to-r from-[hsl(200_80%_65%)] via-gold to-[hsl(200_80%_65%)]",
          isLegendary && "bg-[linear-gradient(90deg,hsl(280_70%_60%),hsl(42_78%_54%),hsl(350_80%_55%),hsl(280_70%_60%))] [background-size:200%_100%] animate-[shimmer-slide_4s_linear_infinite]"
        )}
      />

      {/* Ambient glow overlay (stronger) */}
      {isHot && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isLegendary
              ? "radial-gradient(circle at 20% 0%, hsl(280 70% 60% / 0.22), transparent 55%), radial-gradient(circle at 80% 100%, hsl(42 78% 54% / 0.18), transparent 55%)"
              : isDiamond
              ? "radial-gradient(circle at 25% 0%, hsl(200 80% 65% / 0.22), transparent 55%), radial-gradient(circle at 75% 100%, hsl(42 78% 54% / 0.14), transparent 55%)"
              : isBlazing
              ? "radial-gradient(circle at 30% 0%, hsl(42 78% 54% / 0.22), transparent 60%)"
              : isOnFire
              ? "radial-gradient(circle at 30% 0%, hsl(18 95% 58% / 0.22), transparent 60%)"
              : "radial-gradient(circle at 30% 0%, hsl(18 95% 58% / 0.16), transparent 60%)",
          }}
        />
      )}

      {/* Legendary rainbow shimmer */}
      {isLegendary && (
        <div
          className="absolute inset-0 pointer-events-none animate-[streak-rainbow_4s_linear_infinite]"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(280 70% 60% / 0.1), hsl(42 78% 54% / 0.1), hsl(200 80% 65% / 0.1), transparent)",
            backgroundSize: "200% 100%",
          }}
        />
      )}

      {/* Floating particles for 60+ */}
      {isDiamond && <StreakParticles isDiamond={isDiamond} isLegendary={isLegendary} />}

      <div className="relative">
        {/* Section label */}
        <div className="flex items-center justify-between mb-3">
          <p className={cn(
            "text-[10px] font-black uppercase tracking-[0.22em]",
            !isHot && "text-muted-foreground",
            isHot && !isBlazing && "text-[hsl(var(--streak-orange))]",
            isBlazing && !isDiamond && "text-gold",
            isDiamond && !isLegendary && "text-[hsl(200_80%_65%)]",
            isLegendary && "text-[hsl(280_70%_70%)]",
          )}>
            🔥 Active Streak
          </p>
          {tier.index >= 0 && (
            <span
              className={cn(
                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                isHot && !isOnFire && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))] border-[hsl(var(--streak-orange))]/40",
                isOnFire && !isBlazing && "bg-[hsl(var(--streak-orange))]/20 text-[hsl(var(--streak-orange))] border-[hsl(var(--streak-orange))]/50 shadow-[0_0_10px_hsl(var(--streak-orange)/0.25)]",
                isBlazing && !isDiamond && "bg-gold/20 text-gold border-gold/50 shadow-[0_0_12px_hsl(var(--gold)/0.3)]",
                isDiamond && !isLegendary && "bg-[hsl(200_80%_65%)]/20 text-[hsl(200_80%_65%)] border-[hsl(200_80%_65%)]/50 shadow-[0_0_12px_hsl(200_80%_65%/0.3)]",
                isLegendary && "bg-[hsl(280_70%_60%)]/20 text-[hsl(280_70%_70%)] border-[hsl(280_70%_60%)]/50 shadow-[0_0_14px_hsl(280_70%_60%/0.35)] animate-[streak-badge-shimmer_3s_ease-in-out_infinite]"
              )}
            >
              {isDiamond && !isLegendary && "💎 "}
              {isLegendary && "🏆 "}
              {tier.name}
            </span>
          )}
        </div>

        {/* Hero row */}
        <div className="flex items-center gap-4 mb-4">
          <div
            className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-2xl shrink-0 transition-all",
              !isHot && "bg-secondary text-muted-foreground",
              isHot && !isOnFire && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))] shadow-[0_0_20px_hsl(var(--streak-orange)/0.3)]",
              isOnFire && !isBlazing && "bg-[hsl(var(--streak-orange))]/25 text-[hsl(var(--streak-orange))] shadow-[0_0_28px_hsl(var(--streak-orange)/0.45)]",
              isBlazing && !isDiamond && "gradient-gold text-primary-foreground shadow-[0_0_32px_hsl(var(--gold)/0.55)]",
              isDiamond && !isLegendary && "bg-gradient-to-br from-[hsl(200_80%_55%)] to-[hsl(42_78%_54%)] text-white shadow-[0_0_36px_hsl(200_80%_65%/0.55)]",
              isLegendary && "bg-gradient-to-br from-[hsl(280_70%_55%)] via-[hsl(42_78%_54%)] to-[hsl(350_80%_55%)] text-white shadow-[0_0_40px_hsl(280_70%_60%/0.6)]"
            )}
          >
            {/* Pulsing ring for hot+ */}
            {isHot && (
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 rounded-2xl pointer-events-none animate-ping opacity-40",
                  !isBlazing && "bg-[hsl(var(--streak-orange))]/30",
                  isBlazing && !isDiamond && "bg-gold/30",
                  isDiamond && !isLegendary && "bg-[hsl(200_80%_65%)]/30",
                  isLegendary && "bg-[hsl(280_70%_60%)]/30",
                )}
                style={{ animationDuration: isLegendary ? "1.4s" : isDiamond ? "1.6s" : isBlazing ? "1.8s" : "2.2s" }}
              />
            )}
            <Flame
              size={32}
              strokeWidth={2.4}
              className={cn(
                "relative drop-shadow-[0_2px_8px_currentColor]",
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
              size={20}
              className="absolute top-4 right-4 text-[hsl(280_70%_70%)] drop-shadow-[0_0_12px_hsl(280_70%_60%)] animate-[streak-fire_2s_ease-in-out_infinite]"
            />
          )}

          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "font-black font-display tabular-nums leading-none tracking-tighter drop-shadow-[0_2px_8px_currentColor]",
                  displayStreak >= 100 ? "text-[56px]" : displayStreak >= 10 ? "text-[64px]" : "text-[72px]",
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
              <span className="font-black text-muted-foreground font-display text-sm uppercase tracking-widest">
                day{displayStreak === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider">
                Best <span className="text-foreground font-black tabular-nums">{longestStreak}d</span>
              </span>
            </div>
          </div>
        </div>

        {/* Milestone progress track */}
        <div className="flex items-center gap-1">
          {MILESTONES.map((m) => {
            const reached = streak >= m.days;
            const isNext = nextMilestone?.days === m.days;
            const isPast = currentMilestone && m.days <= currentMilestone.days;

            return (
              <div key={m.days} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-full h-2.5 rounded-full overflow-hidden transition-all duration-500",
                    !reached && "bg-secondary/60",
                    isNext && "ring-1 ring-[hsl(var(--streak-orange))]/40"
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

                <div className={cn("text-center transition-all", reached ? "opacity-100" : isNext ? "opacity-90" : "opacity-50")}>
                  <span
                    className={cn(
                      "text-[11px] font-black tabular-nums block leading-none tracking-tight",
                      reached && isLegendary && "text-[hsl(280_70%_65%)]",
                      reached && isDiamond && !isLegendary && "text-[hsl(200_80%_65%)]",
                      reached && isBlazing && !isDiamond && "text-gold",
                      reached && !isBlazing && "text-[hsl(var(--streak-orange))]",
                      isNext && !reached && "text-[hsl(var(--streak-orange))]/90",
                      !reached && !isNext && "text-muted-foreground"
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
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              <span
                className={cn(
                  "font-black tabular-nums text-sm",
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
              to <span className="font-bold text-foreground">{nextMilestone.emoji} {nextMilestone.label}</span> milestone
            </p>
            <ChevronRight size={14} className="text-muted-foreground/50" />
          </div>
        )}

        {/* Pressure microcopy */}
        {displayStreak >= 3 && (
          <div className="mt-2 pt-2 border-t border-border/20">
            <p className="text-[11px] text-muted-foreground/75 font-semibold text-center italic">
              {displayStreak >= 60 ? "🔱 Few ever reach this. Don't stop." :
               displayStreak >= 30 ? "👑 Most fail before this point." :
               displayStreak >= 14 ? "💪 Don't break now. Keep pushing." :
               displayStreak >= 7 ? "⚡ You're heating up. Stay locked in." :
               "🔥 Keep going. Consistency is everything."}
            </p>
          </div>
        )}

        {!nextMilestone && (
          <div className="flex items-center justify-center mt-3 pt-2.5 border-t border-gold/20">
            <span className={cn(
              "text-xs font-black",
              isLegendary ? "text-[hsl(280_70%_65%)]" : "text-gold"
            )}>
              🏆 All milestones reached!
            </span>
          </div>
        )}

        {/* Streak deadline warning */}
        {deadline && displayStreak > 0 && (
          <div className={cn(
            "flex items-center justify-between mt-2 pt-2 border-t",
            deadline.expired
              ? "border-destructive/30"
              : deadline.urgent
              ? "border-destructive/20"
              : "border-border/30"
          )}>
            {deadline.expired ? (
              <p className="text-xs font-black text-destructive animate-pulse">
                💀 Streak at risk! Check in NOW
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className={cn(
                  "font-black tabular-nums",
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
