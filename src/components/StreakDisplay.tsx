import { Flame, Zap } from "lucide-react";
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
  spark: { label: "Spark", nextAt: 7, emoji: "✨" },
  warming: { label: "Warming Up", nextAt: 14, emoji: "🔥" },
  burning: { label: "On Fire", nextAt: 30, emoji: "🔥🔥" },
  blazing: { label: "Blazing", nextAt: 100, emoji: "🔥🔥🔥" },
  inferno: { label: "Inferno", nextAt: 365, emoji: "🌋" },
};

const StreakDisplay = ({ streak, longestStreak, className }: StreakDisplayProps) => {
  const tier = getStreakTier(streak);
  const config = tierConfig[tier];
  const isHighTier = tier === "blazing" || tier === "inferno";
  const isMidTier = tier === "burning";
  const isActive = streak > 0;
  const progress = Math.min(100, (streak / config.nextAt) * 100);
  const nextMilestone = config.nextAt;
  const daysToNext = Math.max(0, nextMilestone - streak);

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-4 overflow-hidden transition-all",
        tier === "spark" && "border-[hsl(var(--streak-orange))]/20",
        tier === "warming" && "border-[hsl(var(--streak-orange))]/35 shadow-[0_0_12px_hsl(var(--streak-orange)/0.1)]",
        isMidTier && "border-[hsl(var(--streak-orange))]/50 shadow-[0_0_20px_hsl(var(--streak-orange)/0.15)]",
        tier === "blazing" && "border-gold/50 shadow-[0_0_28px_hsl(var(--streak-orange)/0.25),0_0_60px_hsl(var(--gold)/0.08)]",
        tier === "inferno" && "border-gold/70 shadow-[0_0_40px_hsl(var(--streak-orange)/0.35),0_0_80px_hsl(var(--gold)/0.15),inset_0_0_30px_hsl(var(--streak-orange)/0.05)]",
        className
      )}
    >
      {/* Animated border shimmer for high tiers */}
      {isHighTier && (
        <div className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: `linear-gradient(135deg, transparent 30%, hsl(42 78% 54% / ${tier === "inferno" ? 0.08 : 0.05}) 50%, transparent 70%)`,
            backgroundSize: "200% 200%",
            animation: "shine 4s ease-in-out infinite",
          }}
        />
      )}

      {/* Background layers */}
      {tier === "spark" && (
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--streak-orange))]/[0.04] to-transparent pointer-events-none" />
      )}
      {tier === "warming" && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, hsl(18 95% 58% / 0.08), hsl(32 90% 55% / 0.04), transparent 70%)" }}
        />
      )}
      {isMidTier && (
        <>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, hsl(18 95% 58% / 0.12), hsl(42 78% 54% / 0.06), transparent 60%)" }}
          />
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none opacity-40 blur-xl animate-[pulse_3s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, hsl(18 95% 58% / 0.25) 0%, transparent 70%)" }}
          />
        </>
      )}
      {tier === "blazing" && (
        <>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, hsl(18 95% 58% / 0.12), hsl(42 78% 54% / 0.1), transparent 50%)" }}
          />
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none opacity-60 blur-xl animate-pulse"
            style={{ background: "radial-gradient(circle, hsl(18 95% 58% / 0.35) 0%, transparent 70%)" }}
          />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full pointer-events-none opacity-30 blur-xl animate-[pulse_2.5s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, hsl(42 78% 54% / 0.3) 0%, transparent 70%)" }}
          />
        </>
      )}
      {tier === "inferno" && (
        <>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, hsl(0 80% 50% / 0.1), hsl(18 95% 58% / 0.12), hsl(42 78% 54% / 0.1), transparent)" }}
          />
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none opacity-80 blur-xl animate-pulse"
            style={{ background: "radial-gradient(circle, hsl(18 95% 58% / 0.4) 0%, transparent 70%)" }}
          />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full pointer-events-none opacity-50 blur-xl animate-[pulse_2s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, hsl(42 78% 54% / 0.35) 0%, transparent 70%)" }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full pointer-events-none opacity-20 blur-2xl animate-[pulse_3s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, hsl(0 80% 50% / 0.3) 0%, transparent 70%)" }}
          />
        </>
      )}

      <div className="relative">
        {/* Top row: icon + streak number */}
        <div className="flex items-center gap-3">
          {/* Fire icon with animated ring */}
          <div className="relative">
            {isHighTier && (
              <div className="absolute -inset-1.5 rounded-2xl opacity-50 blur-sm animate-[pulse_2s_ease-in-out_infinite]"
                style={{ background: `linear-gradient(135deg, hsl(18 95% 58% / 0.4), hsl(42 78% 54% / 0.3))` }}
              />
            )}
            <div
              className={cn(
                "relative flex h-12 w-12 items-center justify-center rounded-xl transition-all",
                tier === "spark" && "bg-[hsl(var(--streak-orange))]/10 text-[hsl(var(--streak-orange))]/60",
                tier === "warming" && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
                isMidTier && "bg-[hsl(var(--streak-orange))]/20 text-[hsl(var(--streak-orange))] shadow-[0_0_16px_hsl(var(--streak-orange)/0.25)]",
                isHighTier && "gradient-gold text-primary-foreground shadow-[0_0_20px_hsl(var(--streak-orange)/0.5)]",
              )}
            >
              <Flame size={22} className={cn(
                isHighTier && "drop-shadow-[0_0_6px_hsl(0_0%_0%/0.4)]",
                (isMidTier || isHighTier) && "animate-[streak-fire_1.5s_ease-in-out_infinite]"
              )} />
            </div>
            {/* Pulsing indicators */}
            {isMidTier && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--streak-orange)/0.6)]"
                style={{ background: "hsl(18 95% 58%)" }}
              />
            )}
            {isHighTier && (
              <>
                <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full animate-pulse shadow-[0_0_10px_hsl(var(--gold)/0.6)]"
                  style={{ background: "hsl(42 78% 54%)" }}
                />
                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_8px_hsl(var(--streak-orange)/0.5)]"
                  style={{ background: "hsl(18 95% 58%)" }}
                />
              </>
            )}
          </div>

          {/* Streak number and label */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase">Streak</p>
              {streak >= 7 && (
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                  tier === "warming" && "bg-[hsl(var(--streak-orange))]/10 text-[hsl(var(--streak-orange))]/80 border-[hsl(var(--streak-orange))]/20",
                  isMidTier && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))] border-[hsl(var(--streak-orange))]/30",
                  tier === "blazing" && "bg-gold/15 text-gold border-gold/30",
                  tier === "inferno" && "bg-gold/20 text-gold border-gold/40 glow-gold-text shadow-[0_0_8px_hsl(var(--gold)/0.2)]",
                )}>
                  {config.label}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5">
              <p className={cn(
                "text-4xl font-black font-display tracking-tighter leading-none tabular-nums",
                tier === "spark" && "text-[hsl(var(--streak-orange))]/60",
                tier === "warming" && "text-[hsl(var(--streak-orange))]",
                isMidTier && "text-[hsl(var(--streak-orange))] drop-shadow-[0_0_10px_hsl(var(--streak-orange)/0.4)]",
                tier === "blazing" && "text-gold glow-gold-text",
                tier === "inferno" && "text-gold glow-gold-text drop-shadow-[0_0_14px_hsl(var(--streak-orange)/0.6)]",
              )}>
                {streak}
              </p>
              <span className={cn(
                "text-sm font-bold",
                isHighTier ? "text-gold/60" : isMidTier ? "text-[hsl(var(--streak-orange))]/60" : "text-muted-foreground",
              )}>days</span>
            </div>
          </div>

          {/* Right side: best streak badge */}
          <div className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border",
            isHighTier ? "border-gold/20 bg-gold/5" : "border-border bg-secondary/50"
          )}>
            <Zap size={12} className={cn(isHighTier ? "text-gold" : "text-muted-foreground")} />
            <p className={cn(
              "text-lg font-black font-display tabular-nums leading-none",
              isHighTier ? "text-gold/80" : "text-muted-foreground"
            )}>{longestStreak}</p>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Best</p>
          </div>
        </div>

        {/* Progress section */}
        <div className="mt-3">
          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-secondary/60 overflow-hidden surface-inset">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out relative"
              style={{
                width: `${Math.max(6, progress)}%`,
                background: isHighTier
                  ? "linear-gradient(90deg, hsl(0 80% 50%), hsl(18 95% 58%), hsl(42 78% 54%), hsl(42 85% 70%))"
                  : isMidTier
                  ? "linear-gradient(90deg, hsl(18 95% 58% / 0.7), hsl(18 95% 58%), hsl(32 90% 56%))"
                  : tier === "warming"
                  ? "linear-gradient(90deg, hsl(18 95% 58% / 0.5), hsl(18 95% 58% / 0.8))"
                  : "hsl(18 95% 58% / 0.4)",
              }}
            >
              {/* Shimmer animation */}
              {isActive && (
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <div className="absolute inset-0 -translate-x-full animate-[shine_3s_ease-in-out_infinite]"
                    style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.5), transparent)" }}
                  />
                </div>
              )}
              {/* Glowing end dot */}
              {(isMidTier || isHighTier) && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full animate-pulse"
                  style={{
                    background: isHighTier ? "hsl(42 78% 54%)" : "hsl(18 95% 58%)",
                    boxShadow: `0 0 8px ${isHighTier ? "hsl(42 78% 54% / 0.6)" : "hsl(18 95% 58% / 0.6)"}`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Milestone info */}
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-muted-foreground">
              {daysToNext > 0 ? (
                <>
                  <span className={cn(
                    "font-bold",
                    isHighTier ? "text-gold" : isMidTier ? "text-[hsl(var(--streak-orange))]" : "text-muted-foreground"
                  )}>{daysToNext}d</span> to {config.label === "Spark" ? "Warming Up" : config.label === "Warming Up" ? "On Fire 🔥" : config.label === "On Fire" ? "Blazing 💫" : config.label === "Blazing" ? "Inferno 🌋" : "Legendary"}
                </>
              ) : (
                <span className="text-gold font-bold">Max tier reached! 👑</span>
              )}
            </p>
            <p className={cn(
              "text-[10px] font-bold tabular-nums",
              isHighTier ? "text-gold/50" : "text-muted-foreground/50"
            )}>{Math.round(progress)}%</p>
          </div>
        </div>

        {/* Flame emoji row for mid+ tiers */}
        {(isMidTier || isHighTier) && (
          <div className="flex justify-center gap-1 mt-2.5 pt-2 border-t border-border/30">
            {Array.from({ length: tier === "inferno" ? 7 : tier === "blazing" ? 5 : 3 }).map((_, i) => (
              <span
                key={i}
                className="text-xs animate-[float_2s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {tier === "inferno" ? (i % 2 === 0 ? "🔥" : "💀") : "🔥"}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StreakDisplay;
