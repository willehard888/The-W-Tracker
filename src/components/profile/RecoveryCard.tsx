import { useNavigate } from "react-router-dom";
import { HeartPulse, Moon, Wind, ChevronRight } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import { useRecentNights, useNightSync, useSetNightFactors, NIGHT_FACTORS } from "@/hooks/use-night-metrics";
import { hapticSelection } from "@/lib/haptics";

const median = (xs: number[]) => {
  const a = xs.filter((v) => v != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const hm = (min?: number | null) => (min == null ? "—" : `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`);

/**
 * Last night's recovery — sleep stages, resting HR vs the athlete's own baseline,
 * respiratory rate — plus quick "what happened?" tags (alcohol / late meal / …)
 * that give the coach ground truth. "Ask coach why" opens the causal deep-dive.
 * Hidden on web / when no data yet.
 */
const RecoveryCard = () => {
  const navigate = useNavigate();
  useNightSync(); // pull last night from HealthKit on mount (iOS only)
  const { data: nights, isLoading } = useRecentNights(30);
  const setFactors = useSetNightFactors();

  const last = nights?.[0];
  const hasData = !!last && (last.resting_hr != null || last.sleep_total_min != null);

  if (!hasData) {
    if (isLoading || Capacitor.getPlatform() !== "ios") return null;
    return (
      <button
        type="button"
        onClick={() => navigate("/coach")}
        className="w-full text-left rounded-2xl border border-border/50 bg-card/50 p-4 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2 mb-1">
          <HeartPulse size={13} className="text-[hsl(18_95%_58%)]" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/80">Recovery</p>
        </div>
        <p className="text-[12.5px] text-muted-foreground leading-snug">
          Allow Apple Health (sleep, heart rate) to see last night's recovery and let the coach explain why you slept the way you did.
        </p>
      </button>
    );
  }

  const prior = (nights ?? []).slice(1, 15).map((n) => n.resting_hr).filter((v): v is number => v != null);
  const baseRhr = median(prior);
  const rhrDelta = last!.resting_hr != null && baseRhr != null ? last!.resting_hr - baseRhr : null;

  const deep = last!.sleep_deep_min ?? 0;
  const rem = last!.sleep_rem_min ?? 0;
  const core = last!.sleep_core_min ?? 0;
  const awake = last!.awake_min ?? 0;
  const span = deep + rem + core + awake || 1;

  const underRecovered = (rhrDelta != null && rhrDelta >= 5) || awake > 60;
  const status = underRecovered ? "Under-recovered" : "Recovered";
  const active = new Set(last!.factors ?? []);

  const toggleFactor = (f: string) => {
    hapticSelection();
    const next = new Set(active);
    next.has(f) ? next.delete(f) : next.add(f);
    setFactors.mutate({ nightDate: last!.night_date, factors: [...next] });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        underRecovered ? "border-[hsl(18_95%_58%)]/40 bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.07] via-card/95 to-card"
          : "border-[hsl(152_68%_46%)]/35 bg-gradient-to-br from-[hsl(152_68%_46%)]/[0.06] via-card/95 to-card",
      )}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <HeartPulse size={13} className={underRecovered ? "text-[hsl(18_95%_58%)]" : "text-[hsl(152_68%_46%)]"} />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/80">Recovery · last night</p>
        <span className={cn("ml-auto text-[10px] font-black uppercase tracking-wider", underRecovered ? "text-[hsl(18_95%_58%)]" : "text-[hsl(152_68%_46%)]")}>{status}</span>
      </div>

      {last!.sleep_total_min != null && (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary/50 mb-1.5">
            <span style={{ width: `${(deep / span) * 100}%` }} className="bg-[hsl(245_60%_55%)]" />
            <span style={{ width: `${(rem / span) * 100}%` }} className="bg-[hsl(280_55%_60%)]" />
            <span style={{ width: `${(core / span) * 100}%` }} className="bg-[hsl(200_65%_50%)]" />
            <span style={{ width: `${(awake / span) * 100}%` }} className="bg-muted-foreground/40" />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2.5">
            <span className="inline-flex items-center gap-1"><Moon size={10} /> {hm(last!.sleep_total_min)} asleep</span>
            {deep > 0 && <span>deep {hm(deep)}</span>}
            {rem > 0 && <span>REM {hm(rem)}</span>}
          </div>
        </>
      )}

      <div className="flex items-center gap-4 mb-3">
        {last!.resting_hr != null && (
          <div className="flex items-center gap-1.5">
            <HeartPulse size={13} className="text-muted-foreground/70" />
            <span className="text-[13px] font-black tabular-nums">{Math.round(last!.resting_hr)}</span>
            <span className="text-[10px] text-muted-foreground">rhr</span>
            {rhrDelta != null && Math.abs(rhrDelta) >= 1 && (
              <span className={cn("text-[10px] font-black tabular-nums", rhrDelta > 0 ? "text-[hsl(18_95%_58%)]" : "text-[hsl(152_68%_46%)]")}>
                {rhrDelta > 0 ? "+" : ""}{Math.round(rhrDelta)}
              </span>
            )}
          </div>
        )}
        {last!.respiratory_rate != null && (
          <div className="flex items-center gap-1.5">
            <Wind size={13} className="text-muted-foreground/70" />
            <span className="text-[13px] font-black tabular-nums">{last!.respiratory_rate}</span>
            <span className="text-[10px] text-muted-foreground">br/min</span>
          </div>
        )}
      </div>

      {/* What happened last night? — ground truth for the coach's causal read */}
      <p className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">What happened last night?</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {NIGHT_FACTORS.map((f) => {
          const on = active.has(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggleFactor(f)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] font-bold border transition-all active:scale-95 capitalize",
                on ? "bg-gold text-primary-foreground border-transparent" : "bg-secondary/40 border-border/50 text-muted-foreground",
              )}
            >
              {f}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate("/coach")}
        className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-secondary/40 border border-border/50 py-2 text-[11px] font-black uppercase tracking-widest text-gold/90 active:scale-[0.99] transition-transform"
      >
        Ask coach why <ChevronRight size={13} />
      </button>
    </div>
  );
};

export default RecoveryCard;
