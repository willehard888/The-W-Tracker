import { useNavigate } from "react-router-dom";
import { HeartPulse, Moon, Wind, ChevronRight } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import { useRecentNights, useNightSync, useSetNightFactors, NIGHT_FACTORS } from "@/hooks/use-night-metrics";
import { hapticSelection } from "@/lib/haptics";
import Sparkline from "@/components/coach/Sparkline";

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
          <HeartPulse size={13} className="text-[hsl(var(--ember))]" />
          <p className="eyebrow text-muted-foreground/80">Recovery</p>
        </div>
        <p className="text-[12px] text-muted-foreground leading-snug">
          Allow Apple Health (sleep, heart rate) to see last night's recovery and let the coach explain why you slept the way you did.
        </p>
      </button>
    );
  }

  const prior = (nights ?? []).slice(1, 15).map((n) => n.resting_hr).filter((v): v is number => v != null);
  const baseRhr = median(prior);
  const rhrDelta = last!.resting_hr != null && baseRhr != null ? last!.resting_hr - baseRhr : null;

  // 14-night resting-HR trend (oldest → newest) — the "am I getting fitter?"
  // signal. A falling RHR is improving cardiovascular fitness/recovery, so here
  // DOWN is good. Reuses the dependency-free Sparkline; only shown with ≥5 pts.
  const rhrTrend = (nights ?? [])
    .slice(0, 14)
    .map((n) => n.resting_hr)
    .filter((v): v is number => v != null)
    .reverse();
  // Median of the first 3 vs last 3 nights — a single bad night at either
  // endpoint must not flip the "fitter" badge (same treatment as the baseline).
  const trendDelta = (() => {
    if (rhrTrend.length < 5) return null;
    const head = median(rhrTrend.slice(0, 3));
    const tail = median(rhrTrend.slice(-3));
    return head != null && tail != null ? tail - head : null;
  })();

  const deep = last!.sleep_deep_min ?? 0;
  const rem = last!.sleep_rem_min ?? 0;
  const core = last!.sleep_core_min ?? 0;
  const awake = last!.awake_min ?? 0;
  const span = deep + rem + core + awake || 1;

  const underRecovered = (rhrDelta != null && rhrDelta >= 5) || awake > 60;
  const status = underRecovered ? "Under-recovered" : "Recovered";
  const active = new Set(last!.factors ?? []);

  // Deterministic causal one-liner (mirrors the coach's edge reasoning) so the
  // "why" is visible in-card without an AI call. User tags override the guess.
  const priorDeep = (nights ?? []).slice(1, 15).map((n) => n.sleep_deep_min).filter((v): v is number => v != null);
  const baseDeep = median(priorDeep);
  const rhrUp = rhrDelta != null && rhrDelta >= 5;
  const deepLow = baseDeep != null && deep > 0 && deep < baseDeep * 0.7;
  const tags = last!.factors ?? [];
  const cause =
    tags.length ? `Tagged ${tags.join(", ")} — likely the cause.`
    : rhrUp && (deepLow || awake >= 45) ? "Elevated resting HR + disrupted deep sleep — often alcohol, a late heavy meal, or high stress. Tag it below or ask the coach."
    : rhrUp ? "Resting HR up vs your baseline — under-recovery or a hard day."
    : deepLow ? "Less deep sleep than usual — protect tonight's wind-down."
    : "Recovery looks solid. Keep the routine.";

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
        underRecovered ? "border-[hsl(var(--ember))]/40 bg-gradient-to-br from-[hsl(var(--ember))]/[0.07] via-card/95 to-card"
          : "border-xp-green/35 bg-gradient-to-br from-xp-green/[0.06] via-card/95 to-card",
      )}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <HeartPulse size={13} className={underRecovered ? "text-[hsl(var(--ember))]" : "text-xp-green"} />
        <p className="eyebrow text-muted-foreground/80">Recovery · last night</p>
        <span className={cn("eyebrow ml-auto", underRecovered ? "text-[hsl(var(--ember))]" : "text-xp-green")}>{status}</span>
      </div>

      {last!.sleep_total_min != null && (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary/50 mb-1.5">
            <span style={{ width: `${(deep / span) * 100}%` }} className="bg-[hsl(245_60%_55%)]" />
            <span style={{ width: `${(rem / span) * 100}%` }} className="bg-[hsl(280_55%_60%)]" />
            <span style={{ width: `${(core / span) * 100}%` }} className="bg-[hsl(200_65%_50%)]" />
            <span style={{ width: `${(awake / span) * 100}%` }} className="bg-muted-foreground/40" />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2.5">
            <span className="inline-flex items-center gap-1"><Moon size={12} /> {hm(last!.sleep_total_min)} asleep</span>
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
            <span className="text-[11px] text-muted-foreground">rhr</span>
            {rhrDelta != null && Math.abs(rhrDelta) >= 1 && (
              <span className={cn("text-[11px] font-black tabular-nums", rhrDelta > 0 ? "text-[hsl(var(--ember))]" : "text-xp-green")}>
                {rhrDelta > 0 ? "+" : ""}{Math.round(rhrDelta)}
              </span>
            )}
          </div>
        )}
        {last!.respiratory_rate != null && (
          <div className="flex items-center gap-1.5">
            <Wind size={13} className="text-muted-foreground/70" />
            <span className="text-[13px] font-black tabular-nums">{last!.respiratory_rate}</span>
            <span className="text-[11px] text-muted-foreground">br/min</span>
          </div>
        )}
      </div>

      {/* 14-night RHR trajectory — proof of getting fitter over time, not just
          last night. Falling line = improving; labeled so DOWN reads as good. */}
      {rhrTrend.length >= 5 && (
        <div className="mb-3 surface-card surface-card-quiet px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <p className="eyebrow-sm text-muted-foreground/60">
              Resting HR · {rhrTrend.length} nights
            </p>
            {trendDelta != null && Math.abs(trendDelta) >= 1 && (
              <span className={cn("text-[11px] font-black tabular-nums", trendDelta < 0 ? "text-xp-green" : "text-[hsl(var(--ember))]")}>
                {trendDelta < 0 ? "↓" : "↑"} {Math.abs(Math.round(trendDelta))} bpm
                <span className="text-muted-foreground/60 font-bold"> {trendDelta < 0 ? "· fitter" : ""}</span>
              </span>
            )}
          </div>
          <Sparkline values={rhrTrend} className="w-full h-7" />
        </div>
      )}

      {/* Causal read — the "why", stated plainly */}
      <p className="text-[12px] text-foreground/85 leading-snug mb-3">{cause}</p>

      {/* What happened last night? — ground truth for the coach's causal read */}
      <p className="eyebrow text-muted-foreground/60 mb-1.5">What happened last night?</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {NIGHT_FACTORS.map((f) => {
          const on = active.has(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggleFactor(f)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold border transition-all active:scale-95 capitalize",
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
        className="eyebrow w-full inline-flex items-center justify-center gap-1 rounded-xl bg-secondary/40 border border-border/50 py-2 text-gold/90 active:scale-[0.99] transition-transform"
      >
        Ask coach why <ChevronRight size={13} />
      </button>
    </div>
  );
};

export default RecoveryCard;
