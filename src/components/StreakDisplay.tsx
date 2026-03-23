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
  spark: { label: "Spark", nextAt: 7 },
  warming: { label: "Warming Up", nextAt: 14 },
  burning: { label: "On Fire", nextAt: 30 },
  blazing: { label: "Blazing", nextAt: 100 },
  inferno: { label: "Inferno", nextAt: 365 },
};

const StreakDisplay = ({ streak, longestStreak, className }: StreakDisplayProps) => {
  const tier = getStreakTier(streak);
  const config = tierConfig[tier];
  const isHighTier = tier === "blazing" || tier === "inferno";
  const isMidTier = tier === "burning";
  const progress = Math.min(100, (streak / config.nextAt) * 100);

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-4 card-hover card-depth overflow-hidden",
        tier === "spark" && "border-[hsl(var(--streak-orange))]/15",
        tier === "warming" && "border-[hsl(var(--streak-orange))]/30",
        isMidTier && "border-[hsl(var(--streak-orange))]/45",
        tier === "blazing" && "border-gold/40 shadow-[0_0_24px_hsl(var(--streak-orange)/0.2)]",
        tier === "inferno" && "border-gold/60 shadow-[0_0_32px_hsl(var(--streak-orange)/0.3),0_0_60px_hsl(var(--gold)/0.1)]",
        className
      )}
    >
      {/* Ambient backgrounds per tier */}
      {tier === "spark" && (
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--streak-orange))]/[0.03] to-transparent pointer-events-none" />
      )}
      {tier === "warming" && (
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--streak-orange))]/[0.06] to-transparent pointer-events-none" />
      )}
      {isMidTier && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, hsl(18 95% 58% / 0.1), hsl(42 78% 54% / 0.04), transparent 70%)" }}
        />
      )}
      {tier === "blazing" && (
        <>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, hsl(18 95% 58% / 0.1), hsl(42 78% 54% / 0.08), transparent 60%)" }}
          />
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none opacity-50 blur-xl animate-pulse"
            style={{ background: "radial-gradient(circle, hsl(18 95% 58% / 0.3) 0%, transparent 70%)" }}
          />
        </>
      )}
      {tier === "inferno" && (
        <>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, hsl(0 80% 50% / 0.08), hsl(18 95% 58% / 0.1), hsl(42 78% 54% / 0.08))" }}
          />
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none opacity-70 blur-xl animate-pulse"
            style={{ background: "radial-gradient(circle, hsl(18 95% 58% / 0.35) 0%, transparent 70%)" }}
          />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full pointer-events-none opacity-40 blur-xl animate-[pulse_2s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, hsl(42 78% 54% / 0.25) 0%, transparent 70%)" }}
          />
        </>
      )}

      <div className="relative flex items-start gap-3">
        {/* Fire icon */}
        <div className="relative">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
              tier === "spark" && "bg-[hsl(var(--streak-orange))]/10 text-[hsl(var(--streak-orange))]/60",
              tier === "warming" && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
              isMidTier && "bg-[hsl(var(--streak-orange))]/20 text-[hsl(var(--streak-orange))] shadow-[0_0_12px_hsl(var(--streak-orange)/0.2)]",
              isHighTier && "gradient-gold text-primary-foreground shadow-[0_0_16px_hsl(var(--streak-orange)/0.4)]",
            )}
          >
            <Flame size={20} className={cn(isHighTier && "drop-shadow-[0_0_4px_hsl(0_0%_0%/0.3)]")} />
          </div>
          {/* Pulsing dot indicators */}
          {(isMidTier || isHighTier) && (
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--streak-orange)/0.6)]"
              style={{ background: isHighTier ? "hsl(42 78% 54%)" : "hsl(18 95% 58%)" }}
            />
          )}
          {isHighTier && (
            <div className="absolute -bottom-0.5 -left-1 w-2.5 h-2.5 rounded-full bg-[hsl(var(--streak-orange))] animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_6px_hsl(var(--streak-orange)/0.5)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase">Streak</p>
            {streak >= 7 && (
              <span className={cn(
                "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                tier === "warming" && "bg-[hsl(var(--streak-orange))]/10 text-[hsl(var(--streak-orange))]/80",
                isMidTier && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
                tier === "blazing" && "bg-gold/15 text-gold",
                tier === "inferno" && "bg-gold/20 text-gold glow-gold-text",
              )}>
                {config.label}
              </span>
            )}
          </div>

          {/* Big streak number */}
          <div className="flex items-baseline gap-1 mt-0.5">
            <p className={cn(
              "text-3xl font-black font-display tracking-tighter leading-none tabular-nums",
              tier === "spark" && "text-[hsl(var(--streak-orange))]/70",
              tier === "warming" && "text-[hsl(var(--streak-orange))]",
              isMidTier && "text-[hsl(var(--streak-orange))] drop-shadow-[0_0_8px_hsl(var(--streak-orange)/0.3)]",
              tier === "blazing" && "text-gold glow-gold-text",
              tier === "inferno" && "text-gold glow-gold-text drop-shadow-[0_0_10px_hsl(var(--streak-orange)/0.5)]",
            )}>
              {streak}
            </p>
            <span className={cn(
              "text-sm font-bold",
              isHighTier ? "text-gold/60" : isMidTier ? "text-[hsl(var(--streak-orange))]/60" : "text-muted-foreground",
            )}>days</span>
          </div>

          <p className="text-[10px] text-muted-foreground mt-0.5">
            Best: <span className={cn(isHighTier ? "text-gold/70 font-semibold" : "font-medium")}>{longestStreak}d</span>
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-3 h-1.5 rounded-full bg-secondary/60 overflow-hidden surface-inset">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative"
          style={{
            width: `${Math.max(8, progress)}%`,
            background: isHighTier
              ? "linear-gradient(90deg, hsl(0 80% 50%), hsl(18 95% 58%), hsl(42 78% 54%))"
              : isMidTier
              ? "linear-gradient(90deg, hsl(18 95% 58% / 0.8), hsl(18 95% 58%))"
              : "hsl(18 95% 58% / 0.5)",
          }}
        >
          {(isMidTier || isHighTier) && (
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div className="absolute inset-0 -translate-x-full animate-[shine_3s_ease-in-out_infinite]"
                style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.4), transparent)" }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Flame emoji row for high tiers */}
      {isHighTier && (
        <div className="flex justify-center gap-0.5 mt-2">
          {Array.from({ length: tier === "inferno" ? 5 : 3 }).map((_, i) => (
            <span key={i} className="text-[10px] animate-[float_2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 200}ms` }}>
              🔥
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default StreakDisplay;
