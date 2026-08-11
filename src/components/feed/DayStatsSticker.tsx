import { Zap, CheckCheck, ShieldCheck } from "lucide-react";
import StreakFlameInline from "@/components/StreakFlameInline";
import { cn } from "@/lib/utils";

export interface DayStats {
  xp_earned: number;
  habits_done: number;
  verified: boolean;
  /** Consecutive check-in days AS OF the photo's day (computed server-side
   *  from history — can differ from the current streak, and that's the point:
   *  the sticker freezes the moment). */
  streak_at_day: number;
}

/**
 * DayStatsSticker v2 — the flagship stat card overlaid on check-in proof
 * photos. Gradient gold hairline → deep glass card with a slow edge sheen,
 * and the SAME living flame as the header (StreakFlameInline, pure CSS)
 * burning at the streak the athlete had when the photo was taken — its tier
 * ladder (7/14/30/60/100d) makes long streaks visibly hotter on their own.
 */
const DayStatsSticker = ({ stats, className }: { stats: DayStats; className?: string }) => {
  return (
    <div
      className={cn(
        // Gradient hairline frame (p-px trick) + soft gold ambience
        "pointer-events-none absolute bottom-2 left-2 rounded-2xl p-px",
        "bg-gradient-to-br from-gold/80 via-gold/25 to-gold/50",
        "shadow-[0_6px_24px_-6px_rgba(0,0,0,0.75),0_0_22px_-6px_hsl(42_78%_54%/0.4)]",
        className,
      )}
    >
      <div className="edge-sheen rounded-[15px] bg-black/70 backdrop-blur-xl px-3 py-2">
        {/* Micro wordmark — the brand seal */}
        <p className="text-[6.5px] font-bold tracking-[0.32em] text-gold/80 uppercase leading-none">
          Whealth Factory
        </p>

        {/* Hero row: living flame at the photo-day streak · XP · habits · verified */}
        <div className="mt-1.5 flex items-center gap-2">
          {stats.streak_at_day > 0 && (
            <>
              <StreakFlameInline
                streak={stats.streak_at_day}
                size={16}
                suffix="d"
                className="leading-none"
                countClassName="text-[12px] font-black text-white"
              />
              <span className="h-3.5 w-px bg-gold/25" />
            </>
          )}
          <span className="inline-flex items-center gap-0.5 font-display text-[14px] font-black text-gold leading-none tabular-nums glow-gold-text">
            <Zap size={12} strokeWidth={2.8} className="drop-shadow-[0_0_8px_hsl(42_78%_54%/0.7)]" />
            +{stats.xp_earned} XP
          </span>
          {stats.habits_done > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-white/85 leading-none tabular-nums">
              <CheckCheck size={11} strokeWidth={2.8} className="text-white/60" />
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
    </div>
  );
};

export default DayStatsSticker;
