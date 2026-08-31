import { useMemo, useRef, useState, useEffect } from "react";
import { Flame, ChevronRight, Check } from "lucide-react";
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
// Deterministic spark field for the melt-on-press lava — no per-render randomness.
const SPARKS = [
  { left: "12%", top: "38%", s: 3, delay: 0 },
  { left: "31%", top: "58%", s: 2, delay: 0.5 },
  { left: "49%", top: "44%", s: 3, delay: 0.9 },
  { left: "66%", top: "62%", s: 2, delay: 0.3 },
  { left: "81%", top: "40%", s: 3, delay: 1.1 },
  { left: "92%", top: "56%", s: 2, delay: 0.7 },
] as const;

const CommandDeck = ({
  streak,
  canCheckin,
  timeUntilCheckin,
  tier,
  className,
}: CommandDeckProps) => {
  const navigate = useNavigate();
  // Committed melt: a tap keeps the lava rising for the full choreography
  // before navigating, so the melt is seen on every press — not only on a
  // long hold. Reduced-motion users navigate immediately.
  const [locking, setLocking] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (lockTimer.current) clearTimeout(lockTimer.current); }, []);
  const isLegend = tier === "legend";
  const isApex = tier === "apex";

  // Honest XP promise: computed from the user's OWN habit set via the same
  // scoring model as the check-in screen (was a hardcoded "+50 XP" that
  // contradicted the number DailyCheckin showed for the same action).
  const { keys: habitKeys } = useCheckinConfig();
  const maxXp = useMemo(() => maxDailyXp(resolveCheckinHabits(habitKeys)), [habitKeys]);

  // ── Day already banked ───────────────────────────────────────────────
  // Once the day is logged there is nothing to do here until midnight, so the
  // card collapses to a single confirmation row. It used to keep the full
  // ~140px hero — the largest and heaviest block on Home — rendered grey and
  // inert, which meant the first thing the eye landed on was a dead element
  // telling the user to come back tomorrow. Now it states the win, the streak
  // it protected and when the next one opens, in ~55px.
  //
  // Deliberately not a button: with the check-in closed there is nowhere
  // useful to send a tap, and a disabled control that looks pressable is worse
  // than a plain status line. Every hook above runs unconditionally, so this
  // early return is safe.
  if (!canCheckin) {
    return (
      <div
        className={cn(
          "surface-card surface-card-quiet flex items-center gap-3 px-4 py-3",
          className,
        )}
      >
        <span className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
          <Check aria-hidden size={15} className="text-gold" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black leading-tight">Day banked</p>
          {timeUntilCheckin && (
            <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">
              Next check-in in {timeUntilCheckin}
            </p>
          )}
        </div>
        {streak > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--ember)/0.12)] border border-[hsl(var(--ember))]/30 px-2.5 py-1">
            <Flame aria-hidden size={13} className="text-[hsl(var(--ember))] status-flame-flicker" strokeWidth={2.8} />
            <span className="font-display font-black text-[14px] tabular-nums leading-none text-[hsl(22_95%_66%)]">
              {streak}
            </span>
          </span>
        )}
      </div>
    );
  }

  // Past the early return, the day is always open — the inert variants of
  // every style below were removed with it rather than left as dead branches.
  const border = isLegend
    ? "linear-gradient(135deg, hsl(280 70% 60%), hsl(var(--gold)), hsl(350 80% 60%), hsl(280 70% 60%))"
    : isApex
    ? "linear-gradient(135deg, hsl(var(--ember)), hsl(var(--gold)), hsl(42 85% 70%), hsl(var(--ember)))"
    : "linear-gradient(135deg, hsl(var(--gold)), hsl(var(--ember)), hsl(42 85% 70%), hsl(var(--gold)))";

  return (
    <div
      className={cn("rounded-3xl p-[1.5px] overflow-hidden relative breathing-glow", className)}
      style={{
        backgroundImage: border,
        backgroundSize: "200% 200%",
        animation: "shimmer-slide 5s ease-in-out infinite",
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (locking) return;
          hapticImpact("medium");
          if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
            navigate("/checkin");
            return;
          }
          setLocking(true);
          lockTimer.current = setTimeout(() => navigate("/checkin"), 150);
        }}
        className={cn(
          "group relative w-full text-left rounded-3xl p-4 overflow-hidden transition-all duration-200 active:scale-[0.99]",
          locking && "cta-locking",
        )}
        style={{
          background:
            "radial-gradient(130% 90% at 0% 0%, hsl(var(--gold) / 0.16), transparent 60%), linear-gradient(135deg, hsl(255 14% 8%), hsl(255 14% 5%))",
        }}
      >
        {/* Ambient corner glow */}
        <div
          aria-hidden
          className="absolute -top-16 -right-12 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--gold) / 0.30) 0%, transparent 65%)" }}
        />

        <div className="relative">
          {/* Top row — flame icon + streak chip */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 relative gradient-gold text-primary-foreground shadow-[0_0_24px_hsl(var(--gold)/0.55)]">
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-gold/40 animate-ping opacity-40"
                style={{ animationDuration: "2.4s" }}
              />
              <Flame aria-hidden size={24} strokeWidth={2.6} className="relative status-flame-flicker" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="eyebrow text-gold mb-0.5">Lock your day</p>
              <p className="font-display font-black text-[19px] leading-none tracking-tight">
                Daily Check-In
              </p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                {streak > 0 ? `Defend your ${streak}-day streak.` : "Start your streak. Earn XP. Climb."}
              </p>
            </div>

            {/* Streak chip — header-style flame flicker */}
            {streak > 0 && (
              <div className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--ember)/0.12)] border border-[hsl(var(--ember))]/30 px-2.5 py-1">
                <Flame aria-hidden size={13} className="text-[hsl(var(--ember))] status-flame-flicker" strokeWidth={2.8} />
                <span className="font-display font-black text-[14px] tabular-nums leading-none text-[hsl(22_95%_66%)]">{streak}</span>
              </div>
            )}
          </div>

          {/* Primary action bar — LOCK IN. A physical 3D game button: dark
              base below, glossy molten-gold face above; the whole card is the
              <button>, so group-active presses the face 6px down into the base
              while the lava slab below floods up and melts the face
              (press-and-hold shows the melt; releasing navigates). */}
          <div className="relative mt-3.5">
              <div
                aria-hidden
                className="cta-press-base absolute inset-x-0 top-1.5 -bottom-1.5 rounded-2xl"
                style={{ background: "linear-gradient(180deg, hsl(20 70% 22%), hsl(18 65% 13%))" }}
              />
              <div
                className={cn(
                  "cta-breathe-anim cta-melt-face relative flex items-center justify-between gap-3 min-h-[66px] px-5 rounded-2xl overflow-hidden",
                  "transition-[transform,box-shadow,filter] duration-100 ease-out",
                  "group-active:translate-y-1.5 group-active:brightness-105",
                  "group-active:[animation:none]",
                )}
                style={{
                  background: "linear-gradient(160deg, hsl(46 96% 64%) 0%, hsl(38 92% 55%) 34%, hsl(24 94% 52%) 70%, hsl(16 90% 47%) 100%)",
                  boxShadow:
                    "inset 0 2px 0 hsl(48 100% 85% / 0.9), inset 0 -3px 0 hsl(18 80% 30% / 0.9), inset 0 -14px 22px -12px hsl(14 85% 30% / 0.75), 0 1px 0 hsl(20 60% 18%)",
                  animation: "cta-breathe 3.4s ease-in-out infinite",
                }}
              >
                {/* Melt-on-press: a lava slab parked below the face floods up
                    while the press is held — living crest, two magma layers
                    drifting opposite ways, white-hot sparks — while gold
                    drips sag from the unmelted top edge and the outer glow
                    blooms. Pure CSS state (.group:active) — releasing
                    reverses everything automatically. */}
                <div
                  aria-hidden
                  className="cta-melt-slab pointer-events-none absolute -left-1.5 -right-1.5 -bottom-1.5 h-[132%]"
                >
                  {/* heated gold just above the melt front — no hard cut */}
                  <div
                    className="absolute inset-x-0 -top-5 h-[22px]"
                    style={{ background: "linear-gradient(to top, hsl(20 94% 44% / 0.65), hsl(26 92% 48% / 0.28) 55%, transparent)" }}
                  />
                  {/* molten body */}
                  <div
                    className="absolute inset-x-0 top-4 bottom-0"
                    style={{
                      background:
                        "linear-gradient(to top, hsl(4 88% 34%) 0%, hsl(14 96% 46%) 26%, hsl(26 100% 54%) 56%, hsl(38 100% 60%) 100%)",
                    }}
                  />
                  {/* magma layer A — bright cores + dark patches drifting left */}
                  <div
                    className="cta-melt-anim absolute inset-x-0 top-4 bottom-0"
                    style={{
                      filter: "blur(1.5px)",
                      backgroundImage:
                        "radial-gradient(30px 14px at 40px 22px, hsl(52 100% 86%) 14%, hsl(30 100% 56% / 0.8) 46%, transparent 72%), radial-gradient(38px 17px at 132px 44px, hsl(46 100% 74%) 12%, hsl(24 100% 52% / 0.75) 48%, transparent 72%), radial-gradient(26px 12px at 214px 26px, hsl(52 100% 82%) 16%, hsl(28 100% 55% / 0.8) 50%, transparent 72%), radial-gradient(34px 16px at 286px 50px, hsl(48 100% 78%) 13%, hsl(26 100% 54% / 0.8) 48%, transparent 72%), radial-gradient(42px 15px at 90px 66px, hsl(8 78% 34%) 55%, transparent 76%), radial-gradient(48px 17px at 250px 70px, hsl(6 72% 30%) 55%, transparent 76%)",
                      backgroundSize: "330px 100%",
                      backgroundRepeat: "repeat-x",
                      animation: "cta-melt-drift-l 8s linear infinite",
                    }}
                  />
                  {/* magma layer B — softer churn drifting right (parallax) */}
                  <div
                    className="cta-melt-anim absolute inset-x-0 top-4 bottom-0"
                    style={{
                      filter: "blur(2.5px)",
                      opacity: 0.7,
                      backgroundImage:
                        "radial-gradient(46px 20px at 70px 34px, hsl(30 100% 55% / 0.75), transparent 70%), radial-gradient(38px 17px at 190px 56px, hsl(16 100% 46% / 0.7), transparent 70%), radial-gradient(52px 22px at 300px 30px, hsl(33 100% 57% / 0.7), transparent 70%)",
                      backgroundSize: "360px 100%",
                      backgroundRepeat: "repeat-x",
                      animation: "cta-melt-drift-r 5.5s linear infinite",
                    }}
                  />
                  {/* rolling crest — the melt front, undulating */}
                  <div
                    className="cta-melt-anim absolute inset-x-0 top-0 h-[28px]"
                    style={{
                      filter: "blur(0.5px)",
                      backgroundImage:
                        "radial-gradient(34px 22px at 5% 100%, hsl(38 100% 60%), transparent 71%), radial-gradient(26px 16px at 19% 100%, hsl(32 100% 56%), transparent 71%), radial-gradient(40px 24px at 36% 100%, hsl(38 100% 60%), transparent 71%), radial-gradient(24px 14px at 52% 100%, hsl(30 100% 55%), transparent 71%), radial-gradient(36px 21px at 68% 100%, hsl(36 100% 58%), transparent 71%), radial-gradient(28px 17px at 83% 100%, hsl(32 100% 56%), transparent 71%), radial-gradient(32px 20px at 96% 100%, hsl(36 100% 59%), transparent 71%)",
                      backgroundSize: "105% 100%",
                      animation: "cta-crest-roll 3.2s ease-in-out infinite",
                    }}
                  />
                  {/* white-hot line riding the crest, breathing */}
                  <div
                    className="cta-melt-anim absolute inset-x-0 top-[9px] h-[15px]"
                    style={{
                      filter: "blur(5px)",
                      backgroundImage:
                        "radial-gradient(44px 13px at 10% 60%, hsl(50 100% 86% / 0.95), transparent 70%), radial-gradient(56px 14px at 42% 55%, hsl(54 100% 90%), transparent 70%), radial-gradient(48px 13px at 76% 60%, hsl(50 100% 86% / 0.95), transparent 70%), radial-gradient(30px 11px at 94% 58%, hsl(52 100% 88% / 0.9), transparent 70%)",
                      animation: "cta-glow-breathe 1.7s ease-in-out infinite",
                    }}
                  />
                  {/* white-hot sparks twinkling inside the lava */}
                  <div className="cta-melt-sparks absolute inset-0 top-2.5">
                    {SPARKS.map((sp, i) => (
                      <span
                        key={i}
                        className="cta-melt-anim absolute rounded-full"
                        style={{
                          left: sp.left,
                          top: sp.top,
                          width: sp.s,
                          height: sp.s,
                          background: "hsl(54 100% 92%)",
                          boxShadow: "0 0 8px 2px hsl(45 100% 70% / 0.9)",
                          animation: `cta-spark 1.5s ease-in-out ${sp.delay}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
                {/* Gold drips sagging from the unmelted top edge while pressed */}
                <div
                  aria-hidden
                  className="cta-melt-drips pointer-events-none absolute inset-x-0 top-0 h-[26px] z-[1]"
                  style={{
                    filter: "blur(0.6px)",
                    backgroundImage:
                      "radial-gradient(11px 26px at 9% 0%, hsl(44 96% 62%), hsl(40 92% 55%) 55%, transparent 74%), radial-gradient(8px 19px at 23% 0%, hsl(45 96% 63%), transparent 72%), radial-gradient(13px 30px at 41% 0%, hsl(43 95% 60%), hsl(38 90% 52%) 55%, transparent 74%), radial-gradient(9px 22px at 58% 0%, hsl(45 96% 63%), transparent 72%), radial-gradient(12px 27px at 74% 0%, hsl(43 95% 61%), transparent 74%), radial-gradient(8px 18px at 90% 0%, hsl(44 96% 62%), transparent 72%)",
                  }}
                />
                {/* Heat flush over the whole face while pressed */}
                <div
                  aria-hidden
                  className="cta-melt-heat pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(90% 130% at 50% 100%, hsl(30 100% 60% / 0.55), transparent 70%)" }}
                />
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
                  className="cta-melt-label relative z-[2] font-display font-black text-[26px] leading-none uppercase tracking-tight inline-flex items-center gap-2.5"
                  style={{ color: "hsl(20 85% 10%)", textShadow: "0 1px 0 hsl(46 100% 75% / 0.6)" }}
                >
                  <Flame aria-hidden size={24} strokeWidth={2.9} /> Lock in
                </span>
                <span
                  className="relative z-[2] inline-flex items-center gap-1 font-black text-[13px] tabular-nums shrink-0"
                  style={{ color: "hsl(20 70% 16%)" }}
                >
                  +{maxXp} XP
                  <ChevronRight aria-hidden size={20} className="transition-transform group-active:translate-x-0.5" />
                </span>
              </div>
            </div>
        </div>
      </button>
    </div>
  );
};

export default CommandDeck;
