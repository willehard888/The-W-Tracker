import { Crown, ChevronRight, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import Sparkline from "@/components/coach/Sparkline";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import type { PillarScores } from "@/lib/whealth-index";

export const PILLAR_META: Array<{ key: keyof PillarScores; label: string }> = [
  { key: "sleep", label: "Sleep" },
  { key: "recovery", label: "Recovery" },
  { key: "movement", label: "Movement" },
  { key: "nutrition", label: "Nutrition" },
  { key: "mind", label: "Mind" },
  { key: "inner", label: "Inner" },
];

const barColor = (v: number) =>
  v >= 75 ? "bg-gold" : v >= 50 ? "bg-gold/70" : v >= 25 ? "bg-[hsl(var(--ember)/0.8)]" : "bg-destructive/70";

/** Animated radial gauge — pure SVG stroke-dashoffset, reduced-motion safe. */
const Gauge = ({ value }: { value: number }) => {
  const R = 44;
  const C = 2 * Math.PI * R;
  // Animate from 0 on mount (CSS transition drives it; prefers-reduced-motion
  // users get the final state on next frame with transition disabled via media).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const offset = C * (1 - (shown / 100) * 0.75); // 270° arc

  return (
    <div className="relative h-[116px] w-[116px] shrink-0">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-[225deg]">
        <defs>
          <linearGradient id="whealth-gauge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(42 90% 70%)" />
            <stop offset="55%" stopColor="hsl(var(--gold))" />
            <stop offset="100%" stopColor="hsl(30 90% 50%)" />
          </linearGradient>
        </defs>
        <circle
          cx="52" cy="52" r={R} fill="none"
          stroke="hsl(258 13% 16%)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${C * 0.75} ${C}`}
        />
        <circle
          cx="52" cy="52" r={R} fill="none"
          stroke="url(#whealth-gauge-grad)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)" }}
          className="motion-reduce:transition-none drop-shadow-[0_0_6px_hsl(var(--gold)/0.45)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[34px] font-black leading-none tabular-nums glow-gold-text">
          {value}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground mt-0.5">
          / 100
        </span>
      </div>
    </div>
  );
};

interface WhealthIndexCardProps {
  overall: number;
  pillars: PillarScores;
  priorPillars?: PillarScores;
  priorOverall?: number;
  priorDate?: string;
  /** True when showing the on-device live computation. */
  live: boolean;
  /** 28d overall history (oldest → newest) from nightly snapshots. */
  history?: number[];
  onPillarTap?: (pillar: keyof PillarScores) => void;
  onShare?: () => void;
}

/**
 * The Whealth Index hero v2 — radial gauge, LIVE computation chip, 28-day
 * trend, and tappable pillar rows that open the sub-signal drill-down.
 * Honesty holds: pillars without data show a dash, never a fake score.
 */
const WhealthIndexCard = ({
  overall, pillars, priorPillars, priorOverall, priorDate, live, history, onPillarTap, onShare,
}: WhealthIndexCardProps) => {
  const delta = priorOverall != null ? overall - priorOverall : null;

  return (
    <div className="rounded-2xl p-px bg-gradient-to-br from-gold/50 via-gold/15 to-gold/30">
      <div className="rounded-[15px] bg-card/80 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shadow-[0_0_16px_-4px_hsl(var(--gold)/0.5)]">
              <Crown size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold/85">Whealth Index</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Computed from all your data</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal/12 border border-teal/35 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal">
                <span className="h-1 w-1 rounded-full bg-teal animate-pulse" /> Live
              </span>
            )}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label="Share your Whealth Index"
                className="relative h-8 w-8 rounded-full flex items-center justify-center bg-secondary/60 border border-border/50 text-muted-foreground before:absolute before:-inset-2 before:content-['']"
              >
                <Share2 size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Gauge value={overall} />
          <div className="flex-1 min-w-0">
            {delta != null && delta !== 0 && (
              <p className={cn("text-[12px] font-bold tabular-nums mb-1", delta > 0 ? "text-teal" : "text-destructive")}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} vs {priorDate?.slice(5) ?? "start"}
              </p>
            )}
            {history && history.length >= 2 ? (
              <>
                <Sparkline values={history} className="w-full h-8 text-gold" />
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mt-1">28-day trend</p>
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground leading-snug">
                Your trend line starts building tonight — one point per day.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          {PILLAR_META.map(({ key, label }) => {
            const v = pillars[key];
            const pv = priorPillars?.[key];
            const d = v != null && pv != null ? v - pv : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { if (onPillarTap) { hapticSelection(); onPillarTap(key); } }}
                className="w-full flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-left active:bg-gold/[0.05] transition-colors"
              >
                <p className="w-[74px] shrink-0 text-[12px] font-bold text-foreground/85">{label}</p>
                <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
                  {v != null && (
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-700", barColor(v))}
                      style={{ width: `${v}%` }}
                    />
                  )}
                </div>
                <p className="w-8 shrink-0 text-right text-[12px] font-black tabular-nums">
                  {v == null ? <span className="text-muted-foreground/50">—</span> : v}
                </p>
                <p className={cn(
                  "w-7 shrink-0 text-right text-[10px] font-bold tabular-nums",
                  d == null || d === 0 ? "text-muted-foreground/40" : d > 0 ? "text-teal" : "text-destructive",
                )}>
                  {d == null || d === 0 ? "·" : `${d > 0 ? "+" : ""}${d}`}
                </p>
                <ChevronRight size={12} className="text-gold/50 shrink-0" />
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground/70 leading-snug">
          Tap a pillar to see what drives it. — means not enough data yet for an honest score.
        </p>
      </div>
    </div>
  );
};

export default WhealthIndexCard;
