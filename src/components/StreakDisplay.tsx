import { Flame, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakDisplayProps {
  streak: number;
  longestStreak: number;
  className?: string;
}

const MILESTONES = [
{ days: 3, label: "3d", emoji: "🔥" },
{ days: 7, label: "7d", emoji: "⚡" },
{ days: 14, label: "14d", emoji: "💪" },
{ days: 30, label: "30d", emoji: "👑" },
{ days: 60, label: "60d", emoji: "💎" },
{ days: 100, label: "100d", emoji: "🏆" }];


const getStreakTier = (streak: number) => {
  if (streak >= 100) return { name: "Legendary", color: "gold", index: 5 };
  if (streak >= 60) return { name: "Diamond", color: "gold", index: 4 };
  if (streak >= 30) return { name: "Champion", color: "gold", index: 3 };
  if (streak >= 14) return { name: "On Fire", color: "orange", index: 2 };
  if (streak >= 7) return { name: "Heating Up", color: "orange", index: 1 };
  if (streak >= 3) return { name: "Ignited", color: "orange", index: 0 };
  return { name: "Start", color: "muted", index: -1 };
};

const StreakDisplay = ({ streak, longestStreak, className }: StreakDisplayProps) => {
  const tier = getStreakTier(streak);
  const isHot = tier.index >= 1;
  const isOnFire = tier.index >= 2; // 14+ days
  const isBlazing = tier.index >= 3; // 30+ days

  // Find current and next milestone
  const currentMilestone = [...MILESTONES].reverse().find((m) => streak >= m.days);
  const nextMilestone = MILESTONES.find((m) => streak < m.days);

  // Progress between current and next milestone
  const prevDays = currentMilestone?.days || 0;
  const nextDays = nextMilestone?.days || 365;
  const segmentProgress = Math.min(100, (streak - prevDays) / (nextDays - prevDays) * 100);

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-4 overflow-hidden transition-all",
        !isHot && "border-border",
        isHot && !isBlazing && "border-[hsl(var(--streak-orange))]/40 shadow-[0_0_16px_hsl(var(--streak-orange)/0.12)]",
        isBlazing && "border-gold/40 shadow-[0_0_24px_hsl(var(--gold)/0.15)]",
        className
      )}>
      
      {/* Subtle ambient glow */}
      {isHot &&
      <div className="absolute inset-0 pointer-events-none"
      style={{
        background: isBlazing ?
        "linear-gradient(135deg, hsl(42 78% 54% / 0.06), transparent 60%)" :
        "linear-gradient(135deg, hsl(18 95% 58% / 0.06), transparent 60%)"
      }} />

      }

      <div className="relative">
        {/* Header: Flame + Number + Label */}
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
            !isHot && "bg-secondary text-muted-foreground",
            isHot && !isBlazing && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
            isBlazing && "gradient-gold text-primary-foreground shadow-[0_0_12px_hsl(var(--gold)/0.3)]"
          )}>
            <Flame size={20} className={cn(
              isHot && "animate-[streak-fire_2.2s_ease-in-out_infinite]",
              isBlazing && "animate-[streak-fire_1.5s_ease-in-out_infinite]"
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className={cn("font-black font-display tabular-nums leading-none tracking-tighter text-7xl text-destructive",

              !isHot && "text-foreground",
              isHot && !isBlazing && "text-[hsl(var(--streak-orange))]",
              isBlazing && "text-gold"
              )}>
                {streak}
              </span>
              <span className="text-sm font-bold text-muted-foreground">days</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {tier.index >= 0 &&
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                !isHot && "bg-[hsl(var(--streak-orange))]/10 text-[hsl(var(--streak-orange))]/80",
                isHot && !isBlazing && "bg-[hsl(var(--streak-orange))]/15 text-[hsl(var(--streak-orange))]",
                isBlazing && "bg-gold/15 text-gold"
              )}>
                  {tier.name}
                </span>
              }
              <span className="text-[10px] text-muted-foreground/60">
                Best: {longestStreak}d
              </span>
            </div>
          </div>
        </div>

        {/* Milestone progress track */}
        <div className="flex items-center gap-[3px]">
          {MILESTONES.map((m, i) => {
            const reached = streak >= m.days;
            const isNext = nextMilestone?.days === m.days;
            const isPast = currentMilestone && m.days <= currentMilestone.days;

            return (
              <div key={m.days} className="flex-1 flex flex-col items-center gap-1">
                {/* Segment bar */}
                <div className={cn("w-full h-2 rounded-full overflow-hidden transition-all duration-500 text-sidebar-primary",

                reached ? "" : "bg-secondary/60"
                )}>
                  {isPast ?
                  <div className="w-full h-full rounded-full" style={{
                    background: isBlazing ?
                    "linear-gradient(90deg, hsl(18 95% 58%), hsl(42 78% 54%))" :
                    "hsl(18 95% 58%)"
                  }} /> :
                  isNext ?
                  <div className="h-full rounded-full transition-all duration-1000 relative" style={{
                    width: `${Math.max(8, segmentProgress)}%`,
                    background: isBlazing ?
                    "linear-gradient(90deg, hsl(42 78% 54%), hsl(42 85% 70%))" :
                    isHot ?
                    "hsl(18 95% 58%)" :
                    "hsl(18 95% 58% / 0.7)"
                  }}>
                      <div className="absolute inset-0 overflow-hidden rounded-full">
                        <div className="absolute inset-0 -translate-x-full animate-[shine_3s_ease-in-out_infinite]"
                      style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.4), transparent)" }} />
                      
                      </div>
                    </div> :
                  null}
                </div>

                {/* Milestone marker */}
                <div className={cn(
                  "text-center transition-all",
                  reached ? "opacity-100" : isNext ? "opacity-70" : "opacity-30"
                )}>
                  <span className={cn(
                    "text-[8px] font-bold tabular-nums block leading-none",
                    reached && isBlazing && "text-gold",
                    reached && !isBlazing && "text-[hsl(var(--streak-orange))]",
                    !reached && "text-muted-foreground"
                  )}>
                    {m.label}
                  </span>
                </div>
              </div>);

          })}
        </div>

        {/* Next milestone CTA */}
        {nextMilestone &&
        <div className={cn(
          "flex items-center justify-between mt-2.5 pt-2 border-t border-border/30"
        )}>
            <p className="text-[10px] text-muted-foreground">
              <span className={cn(
              "font-bold",
              isBlazing ? "text-gold" : isHot ? "text-[hsl(var(--streak-orange))]" : "text-foreground"
            )}>
                {nextMilestone.days - streak}d
              </span>
              {" "}to {nextMilestone.emoji} {nextMilestone.label} milestone
            </p>
            <ChevronRight size={12} className="text-muted-foreground/40" />
          </div>
        }

        {!nextMilestone &&
        <div className="flex items-center justify-center mt-2.5 pt-2 border-t border-gold/20">
            <span className="text-[10px] font-bold text-gold">🏆 All milestones reached!</span>
          </div>
        }
      </div>
    </div>);

};

export default StreakDisplay;