import { Flame, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import CompactStreakPanel from "@/components/home/CompactStreakPanel";

interface CommandDeckProps {
  streak: number;
  longestStreak: number;
  lastCheckinAt?: string | null;
  canCheckin: boolean;
  timeUntilCheckin: string | null;
  tier: string;
  className?: string;
}

const CommandDeck = ({
  streak,
  longestStreak,
  lastCheckinAt,
  canCheckin,
  timeUntilCheckin,
  tier,
  className,
}: CommandDeckProps) => {
  const navigate = useNavigate();
  const isLegend = tier === "legend";
  const isApex = tier === "apex";

  // Tier-tinted accent for the CTA frame
  const ctaGradient = canCheckin
    ? isLegend
      ? "linear-gradient(135deg, hsl(280 70% 60%), hsl(42 78% 54%), hsl(350 80% 60%), hsl(280 70% 60%))"
      : isApex
      ? "linear-gradient(135deg, hsl(18 95% 58%), hsl(42 78% 54%), hsl(42 85% 70%), hsl(18 95% 58%))"
      : "linear-gradient(135deg, hsl(42 78% 54%), hsl(18 95% 58%), hsl(42 85% 70%), hsl(42 78% 54%))"
    : "linear-gradient(135deg, hsl(var(--border)), hsl(var(--border)))";

  return (
    <div
      className={cn(
        "rounded-3xl p-[1.5px] overflow-hidden relative",
        canCheckin && "breathing-glow",
        className,
      )}
      style={{
        // Use longhand `backgroundImage` so it doesn't conflict with
        // `backgroundSize` on rerender (React shorthand-collision warning).
        backgroundImage: ctaGradient,
        backgroundSize: "200% 200%",
        animation: canCheckin ? "shimmer-slide 5s ease-in-out infinite" : undefined,
      }}
    >
      <div className="rounded-3xl bg-gradient-to-br from-card via-card to-card/85 p-2.5 sm:p-3 grid gap-2.5 sm:gap-3 sm:grid-cols-2 depth-realistic">
        {/* Streak compact */}
        <CompactStreakPanel
          streak={streak}
          longestStreak={longestStreak}
          lastCheckinAt={lastCheckinAt}
        />

        {/* Lock Your Day CTA */}
        <button
          type="button"
          onClick={() => canCheckin && navigate("/checkin")}
          disabled={!canCheckin}
          className={cn(
            "group relative w-full text-left rounded-2xl p-4 overflow-hidden transition-all duration-200 active:scale-[0.985]",
            canCheckin ? "border depth-realistic-warm" : "opacity-70 border depth-realistic",
          )}
          style={{
            background: canCheckin
              ? "radial-gradient(120% 90% at 0% 0%, hsl(42 78% 54% / 0.18), transparent 60%), linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 5%))"
              : "linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 6%))",
            borderColor: canCheckin ? "hsl(42 78% 54% / 0.45)" : "hsl(var(--border))",
          }}
        >
          {/* Ambient glow */}
          <div
            className="absolute -top-16 -right-12 w-44 h-44 rounded-full pointer-events-none"
            style={{
              background: canCheckin
                ? "radial-gradient(circle, hsl(42 78% 54% / 0.32) 0%, transparent 65%)"
                : "transparent",
            }}
          />

          <div className="relative flex flex-col h-full justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 relative",
                  canCheckin
                    ? "gradient-gold text-primary-foreground shadow-[0_0_28px_hsl(42_78%_54%/0.6)]"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {canCheckin && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl bg-gold/40 animate-ping opacity-50"
                    style={{ animationDuration: "2s" }}
                  />
                )}
                <Flame size={26} strokeWidth={2.6} className="relative" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[10px] font-black uppercase tracking-[0.22em] mb-0.5",
                    canCheckin ? "text-gold" : "text-muted-foreground",
                  )}
                >
                  {canCheckin ? "🔒 Lock Your Day" : "✓ Day Locked"}
                </p>
                <p className="font-display font-black text-xl leading-[1.1] tracking-tight text-balance">
                  {canCheckin ? "Daily Check-In" : "Come back tomorrow"}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">
                  {canCheckin
                    ? streak > 0
                      ? `Defend your ${streak}-day streak.`
                      : "Start your streak. Earn XP. Climb."
                    : `Next in ${timeUntilCheckin}`}
                </p>
              </div>
            </div>

            {canCheckin ? (
              // Full-width primary action bar — unmistakable now that this is
              // the only check-in entry point (the bottom-nav tab was removed).
              <div className="flex items-center justify-between gap-2 rounded-xl px-4 py-3 gradient-gold text-primary-foreground shadow-[0_8px_22px_-8px_hsl(42_78%_54%/0.75)] group-active:brightness-95">
                <span className="font-black text-sm uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Flame size={15} strokeWidth={2.9} /> Check in now
                </span>
                <span className="inline-flex items-center gap-1 font-black text-sm tabular-nums">
                  +50 XP
                  <ChevronRight size={17} className="transition-transform group-active:translate-x-0.5" />
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Locked
                </p>
                <p className="text-xs font-black text-muted-foreground tabular-nums">+50 XP</p>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};

export default CommandDeck;
