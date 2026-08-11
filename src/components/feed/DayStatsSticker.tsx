import { Zap, CheckCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DayStats {
  xp_earned: number;
  habits_done: number;
  verified: boolean;
}

/**
 * DayStatsSticker — the premium stat chip overlaid on check-in proof photos in
 * the feed. Turns a plain proof image into a branded "verified discipline"
 * stat card: that DAY's earned XP + habits done, and a teal Verified ✓ when
 * the check-in was HealthKit-verified (per-day truth, not the author-level
 * ribbon). Visual grammar lifted from StoryShareModal (micro wordmark,
 * gold hero number) and the tier ribbon's glass-chip pattern.
 */
const DayStatsSticker = ({ stats, className }: { stats: DayStats; className?: string }) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-2 left-2 rounded-xl border border-gold/35",
        "bg-black/55 backdrop-blur-md px-2.5 py-1.5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      <p className="text-[6.5px] font-bold tracking-[0.3em] text-gold/70 uppercase leading-none">
        Whealth Factory
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-0.5 font-display text-[13px] font-black text-gold leading-none tabular-nums">
          <Zap size={11} strokeWidth={2.8} className="drop-shadow-[0_0_6px_hsl(42_78%_54%/0.6)]" />
          +{stats.xp_earned} XP
        </span>
        {stats.habits_done > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white/80 leading-none tabular-nums">
            <CheckCheck size={10} strokeWidth={2.8} className="text-white/60" />
            {stats.habits_done}
          </span>
        )}
        {stats.verified && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-teal/20 border border-teal/40 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-teal leading-none">
            <ShieldCheck size={9} strokeWidth={2.8} />
            Verified
          </span>
        )}
      </div>
    </div>
  );
};

export default DayStatsSticker;
