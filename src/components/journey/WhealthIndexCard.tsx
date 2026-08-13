import { Crown } from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import type { WhealthSnapshot } from "@/hooks/use-whealth-snapshots";
import type { PillarScores } from "@/lib/whealth-index";

const PILLAR_META: Array<{ key: keyof PillarScores; label: string }> = [
  { key: "sleep", label: "Sleep" },
  { key: "recovery", label: "Recovery" },
  { key: "movement", label: "Movement" },
  { key: "nutrition", label: "Nutrition" },
  { key: "mind", label: "Mind" },
  { key: "inner", label: "Inner" },
];

const barColor = (v: number) =>
  v >= 75 ? "bg-gold" : v >= 50 ? "bg-gold/70" : v >= 25 ? "bg-[hsl(18_95%_58%)]/80" : "bg-destructive/70";

/**
 * The Whealth Index hero — one number for "how is my life going", decomposed
 * into six honest pillars (null = not enough data yet, shown as a quiet dash,
 * never a fake score). Data: nightly coach-insights snapshots.
 */
const WhealthIndexCard = ({ latest, prior }: { latest: WhealthSnapshot; prior?: WhealthSnapshot }) => {
  const delta = prior ? latest.overall - prior.overall : null;

  return (
    <div className="rounded-2xl p-px bg-gradient-to-br from-gold/50 via-gold/15 to-gold/30">
      <div className="rounded-[15px] bg-card/80 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shadow-[0_0_16px_-4px_hsl(42_78%_54%/0.5)]">
              <Crown size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">Whealth Index</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Computed nightly from all your data</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-black leading-none tabular-nums glow-gold-text">
              <AnimatedNumber value={latest.overall} duration={800} />
            </p>
            {delta != null && delta !== 0 && (
              <p className={cn("text-[10px] font-bold tabular-nums", delta > 0 ? "text-teal" : "text-destructive")}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} vs {prior!.snapshotDate.slice(5)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {PILLAR_META.map(({ key, label }) => {
            const v = latest.pillars[key];
            const pv = prior?.pillars[key];
            const d = v != null && pv != null ? v - pv : null;
            return (
              <div key={key} className="flex items-center gap-2.5">
                <p className="w-[74px] shrink-0 text-[11px] font-bold text-foreground/85">{label}</p>
                <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
                  {v != null && (
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-700", barColor(v))}
                      style={{ width: `${v}%` }}
                    />
                  )}
                </div>
                <p className="w-8 shrink-0 text-right text-[11px] font-black tabular-nums">
                  {v == null ? <span className="text-muted-foreground/50">—</span> : v}
                </p>
                <p className={cn(
                  "w-8 shrink-0 text-right text-[9px] font-bold tabular-nums",
                  d == null || d === 0 ? "text-muted-foreground/40" : d > 0 ? "text-teal" : "text-destructive",
                )}>
                  {d == null || d === 0 ? "·" : `${d > 0 ? "+" : ""}${d}`}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[10px] text-muted-foreground/70 leading-snug">
          — means not enough data yet for an honest score. Connect Apple Health and keep checking in.
        </p>
      </div>
    </div>
  );
};

export default WhealthIndexCard;
