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
              <p className={cn("text-[10px] font-black uppercase tracking-[0.22em] mb-0.5", canCheckin ? "text-gold" : "text-muted-foreground")}>
                {canCheckin ? "Lock your day" : "Day locked"}
              </p>
              <p className="font-display font-black text-[19px] leading-none tracking-tight">
                {canCheckin ? "Daily Check-In" : "Come back tomorrow"}
              </p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                {canCheckin
                  ? streak > 0 ? `Defend your ${streak}-day streak.` : "Start your streak. Earn XP. Climb."
                  : `Next in ${timeUntilCheckin}`}
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
            {/* LOCK IN — a physical 3D game button. Dark base below, glossy
                red face above; the whole card is the <button>, so
                group-active presses the face 6px down into the base. */}
            <div className="relative mt-3.5">
              <div
                aria-hidden
                className="absolute inset-x-0 top-1.5 -bottom-1.5 rounded-2xl"
                style={{
                  background: "linear-gradient(180deg, hsl(0 72% 26%), hsl(0 70% 17%))",
                  boxShadow: "0 12px 28px -8px hsl(4 90% 40% / 0.6)",
                }}
              />
              <div
                className={cn(
                  "cta-breathe-anim relative flex items-center justify-between gap-3 min-h-[66px] px-5 rounded-2xl overflow-hidden",
                  "transition-[transform,box-shadow,filter] duration-100 ease-out",
                  "group-active:translate-y-1.5 group-active:brightness-95",
                  "group-active:[animation:none]",
                )}
                style={{
                  background: "linear-gradient(180deg, hsl(6 92% 62%) 0%, hsl(4 86% 53%) 46%, hsl(2 80% 45%) 100%)",
                  boxShadow:
                    "inset 0 2px 0 hsl(12 100% 78% / 0.75), inset 0 -3px 0 hsl(0 70% 32% / 0.9), inset 0 -14px 22px -12px hsl(0 80% 22% / 0.8), 0 1px 0 hsl(0 60% 20%)",
                  animation: "cta-breathe 3.4s ease-in-out infinite",
                }}
              >
                {/* Idle gloss sweep */}
                <span
                  aria-hidden
                  className="cta-gloss-anim absolute inset-y-0 left-0 w-1/3 pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg, transparent, hsl(20 100% 92% / 0.34), transparent)",
                    animation: "cta-gloss 5.2s ease-in-out infinite",
                  }}
                />
                <span
                  className="relative font-display font-black text-[26px] leading-none uppercase tracking-tight inline-flex items-center gap-2.5 text-white"
                  style={{ textShadow: "0 2px 0 hsl(0 70% 28%), 0 0 22px hsl(10 100% 70% / 0.5)" }}
                >
                  <Flame size={24} strokeWidth={2.9} /> Lock in
                </span>
                <span
                  className="relative inline-flex items-center gap-1 font-black text-[13px] tabular-nums shrink-0"
                  style={{ color: "hsl(18 100% 92%)", textShadow: "0 1px 0 hsl(0 70% 30%)" }}
                >
                  +{maxXp} XP
                  <ChevronRight size={20} className="transition-transform group-active:translate-x-0.5" />
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3.5 flex items-center justify-between rounded-xl px-4 py-2.5 border border-border/40">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Locked</p>
              <p className="text-xs font-black text-gold/80 tabular-nums">Day banked ✓</p>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

export default CommandDeck;
