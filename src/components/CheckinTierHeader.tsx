import { ChevronLeft, Zap, Flame, Target, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTierConfig, formatTierShort, type StatusTier } from "@/lib/status-tiers";
import { motion } from "framer-motion";

interface CheckinTierHeaderProps {
  tier: string;
  division?: number | null;
  username?: string | null;
  streak: number;
  totalXp: number;
  completedCount: number;
  maxCount: number;
  onBack: () => void;
}

/**
 * Aggressive, tier-specific check-in header.
 * - Per-tier gradient background, accent color, and pressure microcopy
 * - Big XP counter, streak flame, live progress bar
 * - "Bold & aggressive" voice: don't break it, hold the line, etc.
 */
const CheckinTierHeader = ({
  tier,
  division = 0,
  username,
  streak,
  totalXp,
  completedCount,
  maxCount,
  onBack,
}: CheckinTierHeaderProps) => {
  const cfg = getTierConfig(tier);
  // maxCount can hit 0 if the habit set ever loses its core habits — a
  // bare division rendered "NaN%" and width: NaN%.
  const perfPercent = maxCount > 0 ? Math.round((completedCount / maxCount) * 100) : 0;

  // Aggressive headline depending on tier rank + progress
  const getHeadline = () => {
    if (perfPercent >= 80) return "PERFECT EXECUTION INCOMING";
    if (perfPercent >= 50) return "HOLD THE LINE — FINISH STRONG";
    if (perfPercent >= 25) return "DON'T STOP NOW";
    return cfg.rank >= 4 ? "ELITE DOESN'T SKIP DAYS" : "EXECUTE TODAY OR FALL";
  };

  // Streak warning — burns hot at 7+, critical at 14+
  const streakIntensity =
    streak >= 30 ? "legendary" : streak >= 14 ? "critical" : streak >= 7 ? "hot" : streak >= 3 ? "warm" : "cold";

  // Per-tier background gradient
  const tierBgGradient: Record<number, string> = {
    0: "from-secondary/40 via-background to-background",
    1: "from-[hsl(var(--teal))]/15 via-background to-background",
    2: "from-[hsl(210_90%_56%)]/15 via-background to-background",
    3: "from-[hsl(var(--purple))]/18 via-background to-background",
    4: "from-gold/20 via-background to-background",
    5: "from-[hsl(18_95%_58%)]/22 via-gold/10 to-background",
    6: "from-[hsl(280_70%_55%)]/22 via-gold/10 to-[hsl(350_80%_55%)]/15",
  };

  const tierAccent: Record<number, { bar: string; ring: string; chipBg: string; chipText: string }> = {
    0: { bar: "bg-muted-foreground/40", ring: "ring-border/50", chipBg: "bg-secondary/60", chipText: "text-muted-foreground" },
    1: { bar: "bg-[hsl(var(--teal))]", ring: "ring-[hsl(var(--teal))]/40", chipBg: "bg-[hsl(var(--teal))]/15", chipText: "text-[hsl(var(--teal))]" },
    2: { bar: "bg-[hsl(210_90%_56%)]", ring: "ring-[hsl(210_90%_56%)]/40", chipBg: "bg-[hsl(210_90%_56%)]/15", chipText: "text-[hsl(210_90%_56%)]" },
    3: { bar: "bg-[hsl(var(--purple))]", ring: "ring-[hsl(var(--purple))]/40", chipBg: "bg-[hsl(var(--purple))]/15", chipText: "text-[hsl(var(--purple))]" },
    4: { bar: "bg-gradient-to-r from-gold to-gold-light", ring: "ring-gold/50", chipBg: "bg-gold/15", chipText: "text-gold" },
    5: { bar: "bg-gradient-to-r from-[hsl(18_95%_58%)] via-gold to-[hsl(18_95%_58%)]", ring: "ring-[hsl(18_95%_58%)]/55", chipBg: "bg-gradient-to-r from-[hsl(18_95%_58%)]/20 to-gold/15", chipText: "text-[hsl(18_95%_58%)]" },
    6: { bar: "bg-gradient-to-r from-[hsl(280_70%_55%)] via-gold to-[hsl(350_80%_55%)]", ring: "ring-[hsl(280_70%_60%)]/55", chipBg: "bg-gradient-to-r from-[hsl(280_70%_55%)]/20 via-gold/15 to-[hsl(350_80%_55%)]/20", chipText: "text-transparent bg-clip-text bg-gradient-to-r from-[hsl(280_70%_70%)] via-gold to-[hsl(350_80%_65%)]" },
  };

  const accent = tierAccent[cfg.rank] ?? tierAccent[0];
  const bg = tierBgGradient[cfg.rank] ?? tierBgGradient[0];

  const streakFlameColor =
    streakIntensity === "legendary"
      ? "text-gold drop-shadow-[0_0_10px_hsl(var(--gold)/0.7)]"
      : streakIntensity === "critical"
      ? "text-[hsl(18_95%_58%)] drop-shadow-[0_0_10px_hsl(18_95%_58%/0.7)]"
      : streakIntensity === "hot"
      ? "text-streak-orange drop-shadow-[0_0_8px_hsl(var(--streak-orange)/0.5)]"
      : streakIntensity === "warm"
      ? "text-amber"
      : "text-muted-foreground";

  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pt-3 pb-3 mb-4 bg-[hsl(var(--background)/0.97)] border-b border-border/40 overflow-hidden">
      {/* Tier-specific glow background */}
      <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br pointer-events-none opacity-90", bg)} />

      {/* Apex/Legend — amber cinder rain (3 embers from right) */}
      {cfg.rank >= 5 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {[
            { right: "8%",  delay: "0s",   color: "hsl(18 95% 58%)" },
            { right: "32%", delay: "1.4s", color: "hsl(var(--gold))" },
            { right: "60%", delay: "2.8s", color: cfg.rank === 6 ? "hsl(280 70% 70%)" : "hsl(18 95% 62%)" },
          ].map((e, i) => (
            <span
              key={i}
              className="absolute bottom-0 status-ember-rise rounded-full w-[2.5px] h-[2.5px]"
              style={{
                right: e.right,
                background: e.color,
                boxShadow: `0 0 5px ${e.color}, 0 0 10px ${e.color}`,
                animationDelay: e.delay,
                animationDuration: "5s",
              }}
            />
          ))}
        </div>
      )}
      {/* Top row */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          {/* Tier badge + username */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-[2px] rounded text-[8px] uppercase tracking-[0.16em] font-black ring-1",
                accent.chipBg,
                accent.chipText,
                accent.ring,
              )}
            >
              {cfg.rank >= 5 && <Flame size={9} strokeWidth={3} fill="currentColor" />}
              {formatTierShort(tier, division)}
            </span>
            {username && (
              <span className="text-[11px] font-bold text-foreground/80 truncate">
                @{username}
              </span>
            )}
          </div>
          {/* Aggressive headline */}
          <h1 className="font-display text-[15px] font-black tracking-tight leading-tight uppercase">
            {getHeadline()}
          </h1>
        </div>

        {/* Live XP chip */}
        <motion.div
          key={totalXp}
          initial={{ scale: 1.18 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 shrink-0",
            cfg.rank >= 5
              ? "border-gold/70 bg-gradient-to-r from-gold/20 via-[hsl(18_95%_58%)]/20 to-gold/20 shadow-[0_0_14px_hsl(var(--gold)/0.5)]"
              : cfg.rank === 4
              ? "border-gold/60 bg-gold/15 shadow-[0_0_10px_hsl(var(--gold)/0.4)]"
              : "border-gold/40 bg-gold/10",
          )}
        >
          <Zap
            size={13}
            className={cn("text-gold", cfg.rank >= 5 && "status-flame-flicker")}
            fill="currentColor"
          />
          <span className="text-base font-display font-black text-gold tabular-nums leading-none">
            {totalXp}
          </span>
          <span className="text-[9px] text-gold/70 font-bold">XP</span>
        </motion.div>
      </div>

      {/* Streak + progress row */}
      <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
        {/* Streak block */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/60 border border-border/40">
          <Flame
            size={14}
            className={cn(
              streakFlameColor,
              (streakIntensity === "critical" || streakIntensity === "legendary") && "status-flame-flicker",
            )}
            fill="currentColor"
            strokeWidth={2.4}
          />
          <span
            className={cn(
              "font-display text-sm font-black tabular-nums leading-none",
              streakIntensity === "legendary"
                ? "text-gold"
                : streakIntensity === "critical"
                ? "text-[hsl(18_95%_58%)]"
                : streakIntensity === "hot"
                ? "text-streak-orange"
                : streakIntensity === "warm"
                ? "text-amber"
                : "text-muted-foreground",
            )}
          >
            {streak}
          </span>
          <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
            day{streak === 1 ? "" : "s"}
          </span>
        </div>

        {/* Progress bar with aggressive label */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-[0.15em] font-black text-muted-foreground flex items-center gap-1">
              <Target size={9} strokeWidth={3} />
              Today
            </span>
            <span
              className={cn(
                "text-[11px] font-display font-black tabular-nums",
                perfPercent >= 80
                  ? "text-gold"
                  : perfPercent >= 50
                  ? "text-xp-green"
                  : perfPercent >= 25
                  ? "text-amber"
                  : "text-destructive",
              )}
            >
              {completedCount}/{maxCount} · {perfPercent}%
            </span>
          </div>
          <div className="relative w-full h-2 rounded-full bg-secondary/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(perfPercent, 2)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn("h-full rounded-full relative overflow-hidden", accent.bar)}
            >
              {/* Animated shimmer for high tiers when filling up — faster on Apex/Legend */}
              {cfg.rank >= 4 && perfPercent > 30 && (
                <div
                  className={cn(
                    "absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,hsl(0_0%_100%/0.35)_50%,transparent_70%)] [background-size:200%_100%]",
                    cfg.rank >= 5
                      ? "[animation:shimmer-slide_1.4s_linear_infinite]"
                      : "[animation:shimmer-slide_2.2s_linear_infinite]",
                  )}
                />
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Pressure microcopy — appears when progress is low */}
      {perfPercent < 30 && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wider font-black text-destructive/90"
        >
          <AlertTriangle size={10} strokeWidth={3} />
          {cfg.pressureMessage}
        </motion.p>
      )}
      {perfPercent >= 80 && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wider font-black text-gold"
        >
          <TrendingUp size={10} strokeWidth={3} />
          You're crushing it — submit & lock the day in.
        </motion.p>
      )}
    </div>
  );
};

export default CheckinTierHeader;
