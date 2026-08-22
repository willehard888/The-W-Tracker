import { useMemo } from "react";
import { Flame, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useCheckinConfig } from "@/hooks/use-checkin-config";
import { resolveCheckinHabits } from "@/lib/checkin-habits";
import { maxDailyXp } from "@/lib/checkin-xp";

interface CommandDeckProps {
  streak: number;
  longestStreak: number;
  lastCheckinAt?: string | null;
  canCheckin: boolean;
  timeUntilCheckin: string | null;
  tier: string;
  className?: string;
}

/**
 * The single daily action — a clean, premium check-in card. The streak panel
 * was removed; the streak now lives as a small flame chip (same flicker as the
 * header) so the card stays simple and the one job is unmistakable.
 */
const CommandDeck = ({
  streak,
  canCheckin,
  timeUntilCheckin,
  tier,
  className,
}: CommandDeckProps) => {
  const navigate = useNavigate();
  const isLegend = tier === "legend";
  const isApex = tier === "apex";

  // Honest XP promise: computed from the user's OWN habit set via the same
  // scoring model as the check-in screen (was a hardcoded "+50 XP" that
  // contradicted the number DailyCheckin showed for the same action).
  const { keys: habitKeys } = useCheckinConfig();
  const maxXp = useMemo(() => maxDailyXp(resolveCheckinHabits(habitKeys)), [habitKeys]);

  const border = canCheckin
    ? isLegend
      ? "linear-gradient(135deg, hsl(280 70% 60%), hsl(var(--gold)), hsl(350 80% 60%), hsl(280 70% 60%))"
      : isApex
      ? "linear-gradient(135deg, hsl(var(--ember)), hsl(var(--gold)), hsl(42 85% 70%), hsl(var(--ember)))"
      : "linear-gradient(135deg, hsl(var(--gold)), hsl(var(--ember)), hsl(42 85% 70%), hsl(var(--gold)))"
    : "linear-gradient(135deg, hsl(var(--border)), hsl(var(--border)))";

  return (
    <div
      className={cn("rounded-3xl p-[1.5px] overflow-hidden relative", canCheckin && "breathing-glow", className)}
      style={{
        backgroundImage: border,
        backgroundSize: "200% 200%",
        animation: canCheckin ? "shimmer-slide 5s ease-in-out infinite" : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => { if (canCheckin) { hapticImpact("medium"); navigate("/checkin"); } }}
        disabled={!canCheckin}
        className={cn(
          "group relative w-full text-left rounded-3xl p-4 overflow-hidden transition-all duration-200 active:scale-[0.99]",
          !canCheckin && "opacity-80",
        )}
        style={{
          background: canCheckin
            ? "radial-gradient(130% 90% at 0% 0%, hsl(var(--gold) / 0.16), transparent 60%), linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 5%))"
            : "linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 6%))",
        }}
      >
        {/* Ambient corner glow */}
        {canCheckin && (
          <div
            aria-hidden
            className="absolute -top-16 -right-12 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(var(--gold) / 0.30) 0%, transparent 65%)" }}
          />
        )}

        <div className="relative">
          {/* Top row — flame icon + streak chip */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 relative",
                canCheckin
                  ? "gradient-gold text-primary-foreground shadow-[0_0_24px_hsl(var(--gold)/0.55)]"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {canCheckin && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl bg-gold/40 animate-ping opacity-40"
                  style={{ animationDuration: "2.4s" }}
                />
              )}
              <Flame size={24} strokeWidth={2.6} className={cn("relative", canCheckin && "status-flame-flicker")} />
            </div>

            <div className="min-w-0 flex-1">
              <p className={cn("eyebrow mb-0.5", canCheckin ? "text-gold" : "text-muted-foreground")}>
                {canCheckin ? "Today's check-in" : "Day locked"}
              </p>
              <p className="font-display font-black text-[19px] leading-none tracking-tight">
                {canCheckin ? "Log your Core 4" : "See you tomorrow"}
              </p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                {canCheckin
                  ? streak > 0 ? `Keep your ${streak}-day streak alive.` : "Sleep, workout, water, mind — then lock the day."
                  : `Opens at midnight · ${timeUntilCheckin}`}
              </p>
            </div>

            {/* Streak chip — header-style flame flicker */}
            {streak > 0 && (
              <div className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--ember)/0.12)] border border-[hsl(var(--ember))]/30 px-2.5 py-1">
                <Flame size={13} className="text-[hsl(var(--ember))] status-flame-flicker" strokeWidth={2.8} />
                <span className="font-display font-black text-[14px] tabular-nums leading-none text-[hsl(22_95%_66%)]">{streak}</span>
              </div>
            )}
          </div>

          {/* Primary action bar */}
          {canCheckin ? (
            <div className="mt-3.5 flex items-center justify-between gap-2 rounded-xl px-4 py-3 gradient-gold text-primary-foreground shadow-[0_8px_22px_-8px_hsl(var(--gold)/0.7)] group-active:brightness-95">
              <span className="font-black text-sm uppercase tracking-wide inline-flex items-center gap-1.5">
                <Flame size={15} strokeWidth={2.9} /> Check in
              </span>
              <span className="inline-flex items-center gap-1 font-black text-sm tabular-nums">
                Up to +{maxXp} XP
                <ChevronRight size={17} className="transition-transform group-active:translate-x-0.5" />
              </span>
            </div>
          ) : (
            <div className="mt-3.5 flex items-center justify-between rounded-xl px-4 py-2.5 border border-border/40">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Locked</p>
              <p className="text-xs font-black text-gold/80 tabular-nums">Locked ✓</p>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

export default CommandDeck;
