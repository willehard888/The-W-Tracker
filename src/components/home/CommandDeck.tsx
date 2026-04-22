import { Flame, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import StreakDisplay from "@/components/StreakDisplay";

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
        background: ctaGradient,
        backgroundSize: "200% 200%",
        animation: canCheckin ? "shimmer-slide 5s ease-in-out infinite" : undefined,
      }}
    >
      <div className="rounded-3xl bg-gradient-to-br from-card via-card to-card/85 p-3 sm:p-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Streak compact */}
        <StreakDisplay
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
            "group relative w-full text-left rounded-2xl p-4 overflow-hidden transition-transform active:scale-[0.99]",
            canCheckin ? "border" : "opacity-70 border",
          )}
          style={{
            background: canCheckin
              ? "radial-gradient(120% 90% at 0% 0%, hsl(42 78% 54% / 0.18), transparent 60%), linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 5%))"
              : "linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 6%))",
            borderColor: canCheckin ? "hsl(42 78% 54% / 0.45)" : "hsl(var(--border))",
            boxShadow: canCheckin
              ? "0 10px 32px -16px hsl(42 78% 54% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.05)"
              : undefined,
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
                  "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 relative",
                  canCheckin
                    ? "gradient-gold text-primary-foreground shadow-[0_0_24px_hsl(42_78%_54%/0.55)]"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {canCheckin && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-xl bg-gold/40 animate-ping opacity-50"
                    style={{ animationDuration: "2s" }}
                  />
                )}
                <Flame size={22} strokeWidth={2.6} className="relative" />
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
                <p className="font-display font-black text-lg leading-tight tracking-tight">
                  {canCheckin ? "Daily Check-In" : "Come back tomorrow"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {canCheckin
                    ? streak > 0
                      ? `Defend your ${streak}-day streak.`
                      : "Start your streak. Earn XP. Climb."
                    : `Next in ${timeUntilCheckin}`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gold/15">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {canCheckin ? "Today's reward" : "Locked"}
              </p>
              <div className="flex items-center gap-1">
                {canCheckin ? (
                  <p className="text-xs font-black text-gold tabular-nums">+50 XP base</p>
                ) : (
                  <p className="text-xs font-black text-muted-foreground tabular-nums">+50 XP</p>
                )}
                <ChevronRight
                  size={16}
                  className={canCheckin ? "text-gold animate-pulse" : "text-muted-foreground/40"}
                />
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default CommandDeck;
