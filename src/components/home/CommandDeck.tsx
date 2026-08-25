import { useMemo, useState, useRef, useEffect } from "react";
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
// Deterministic particle fans — variance baked in, no per-render randomness.
const EMBERS = [
  { x: 8, dx: -26, dy: -58, s: 5, dur: 620 },
  { x: 20, dx: -12, dy: -74, s: 4, dur: 560 },
  { x: 34, dx: -4, dy: -52, s: 6, dur: 680 },
  { x: 47, dx: 6, dy: -82, s: 4, dur: 600 },
  { x: 58, dx: 14, dy: -60, s: 5, dur: 640 },
  { x: 72, dx: 24, dy: -70, s: 4, dur: 580 },
  { x: 86, dx: 32, dy: -54, s: 5, dur: 660 },
  { x: 94, dx: 40, dy: -66, s: 3, dur: 540 },
] as const;
const SMOKE = [
  { x: 22, dx: -14, dur: 900 },
  { x: 62, dx: 10, dur: 980 },
] as const;

const CommandDeck = ({
  streak,
  canCheckin,
  timeUntilCheckin,
  tier,
  className,
}: CommandDeckProps) => {
  const navigate = useNavigate();
  // Press burst: keyed so a rapid double-press restarts the particles.
  const [burst, setBurst] = useState<number | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireBurst = () => {
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setBurst(Date.now());
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(null), 1100);
  };
  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);
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
        onPointerDown={() => { if (canCheckin) fireBurst(); }}
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
            // LOCK IN — a physical 3D game button. Dark base below, glossy
            // red face above; the whole card is the <button>, so group-active
            // presses the face 6px down into the base.
            <div className="relative mt-3.5">
              {/* Press burst — embers + smoke erupt from the button's top edge */}
              {burst !== null && (
                <div aria-hidden className="pointer-events-none absolute inset-x-4 -top-1 h-0 z-10">
                  {EMBERS.map((e, i) => (
                    <span
                      key={`${burst}-e${i}`}
                      className="absolute bottom-0 rounded-full"
                      style={{
                        left: `${e.x}%`,
                        width: e.s,
                        height: e.s,
                        background: i % 3 === 0 ? "hsl(45 95% 62%)" : "hsl(16 96% 56%)",
                        boxShadow: `0 0 ${e.s * 2}px hsl(20 100% 60% / 0.9)`,
                        animation: `cta-ember ${e.dur}ms cubic-bezier(0.16, 0.8, 0.4, 1) forwards`,
                        ["--dx" as string]: `${e.dx}px`,
                        ["--dy" as string]: `${e.dy}px`,
                      }}
                    />
                  ))}
                  {SMOKE.map((p, i) => (
                    <span
                      key={`${burst}-s${i}`}
                      className="absolute bottom-0 rounded-full"
                      style={{
                        left: `${p.x}%`,
                        width: 14,
                        height: 14,
                        background: "radial-gradient(circle, hsl(20 15% 70% / 0.5), transparent 70%)",
                        filter: "blur(3px)",
                        animation: `cta-smoke ${p.dur}ms ease-out forwards`,
                        ["--dx" as string]: `${p.dx}px`,
                      }}
                    />
                  ))}
                </div>
              )}
              <div
                aria-hidden
                className="absolute inset-x-0 top-1.5 -bottom-1.5 rounded-2xl"
                style={{
                  background: "linear-gradient(180deg, hsl(20 70% 22%), hsl(18 65% 13%))",
                  boxShadow: "0 12px 30px -8px hsl(18 95% 45% / 0.65)",
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
                  background: "linear-gradient(160deg, hsl(46 96% 64%) 0%, hsl(38 92% 55%) 34%, hsl(24 94% 52%) 70%, hsl(16 90% 47%) 100%)",
                  boxShadow:
                    "inset 0 2px 0 hsl(48 100% 85% / 0.9), inset 0 -3px 0 hsl(18 80% 30% / 0.9), inset 0 -14px 22px -12px hsl(14 85% 30% / 0.75), 0 1px 0 hsl(20 60% 18%)",
                  animation: "cta-breathe 3.4s ease-in-out infinite",
                }}
              >
                {/* Idle gloss sweep */}
                <span
                  aria-hidden
                  className="cta-gloss-anim absolute inset-y-0 left-0 w-1/3 pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg, transparent, hsl(48 100% 94% / 0.45), transparent)",
                    animation: "cta-gloss 5.2s ease-in-out infinite",
                  }}
                />
                <span
                  className="relative font-display font-black text-[26px] leading-none uppercase tracking-tight inline-flex items-center gap-2.5"
                  style={{ color: "hsl(20 85% 10%)", textShadow: "0 1px 0 hsl(46 100% 75% / 0.6)" }}
                >
                  <Flame size={24} strokeWidth={2.9} /> Lock in
                </span>
                <span
                  className="relative inline-flex items-center gap-1 font-black text-[13px] tabular-nums shrink-0"
                  style={{ color: "hsl(20 70% 16%)", opacity: 0.85 }}
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
