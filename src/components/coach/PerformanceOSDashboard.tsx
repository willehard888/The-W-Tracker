import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Sparkles, Calendar, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePerformanceSnapshots, useLatestWeeklyReview } from "@/hooks/use-performance-snapshots";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/error-copy";

const Sparkline = ({ values }: { values: number[] }) => {
  if (values.length < 2) return <div className="h-12 flex items-center text-[10px] text-muted-foreground">Not enough data yet.</div>;
  const w = 280;
  const h = 48;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ");
  const last = values[values.length - 1];
  const lastX = (values.length - 1) * step;
  const lastY = h - ((last - min) / range) * h;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(42 88% 62%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(42 88% 62%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sparkFill)" />
      <polyline points={pts} fill="none" stroke="hsl(42 88% 62%)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="hsl(42 88% 62%)" stroke="hsl(255 18% 5%)" strokeWidth="2" />
    </svg>
  );
};

const PerformanceOSDashboard = () => {
  const { data: snaps, isLoading } = usePerformanceSnapshots(28);
  const { data: review } = useLatestWeeklyReview();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const generateReview = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("coach-weekly-review");
      if (error) throw error;
      toast.success("Weekly review updated");
      await qc.invalidateQueries({ queryKey: ["coach-weekly-review-latest"] });
      await qc.invalidateQueries({ queryKey: ["coach-performance-snapshots"] });
    } catch (e: any) {
      toast.error(friendlyError(e, "Failed to generate review"));
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="h-32 rounded-2xl bg-card/40 border border-border/40 animate-pulse" />;
  }

  const values = (snaps ?? []).map((s) => s.performance_score);
  const latest = values[values.length - 1] ?? null;
  const prev = values[values.length - 2] ?? null;
  const delta = latest != null && prev != null ? latest - prev : 0;
  const TrendIcon = delta > 1 ? TrendingUp : delta < -1 ? TrendingDown : Minus;
  const trendColor = delta > 1 ? "text-xp-green" : delta < -1 ? "text-rose-400" : "text-muted-foreground";

  // Average components over last 7 days
  const last7 = (snaps ?? []).slice(-7);
  const avgComponent = (key: string) => {
    if (!last7.length) return 0;
    const total = last7.reduce((s, x) => s + Number((x.components as any)?.[key] ?? 0), 0);
    return Math.round(total / last7.length);
  };
  // Keys must match what coach-weekly-review actually WRITES (sleep_pts,
  // train_pts, consistency_pts, energy_pts) — the old rpe_pts/missed_pts were
  // coach-daily-plan's readiness keys, so two tiles rendered a permanent 0.
  const sleepAvg = avgComponent("sleep_pts");
  const recoveryAvg = avgComponent("energy_pts");
  const consistencyAvg = avgComponent("consistency_pts");

  return (
    <div className="space-y-3">
      {/* Performance Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/40 bg-gradient-to-br from-[hsl(255_18%_8%)] to-[hsl(255_22%_5%)] p-4 overflow-hidden shadow-[0_12px_28px_-16px_hsl(0_0%_0%/0.7)]"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="eyebrow text-gold/80">Performance Score</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display text-4xl font-black tabular-nums leading-none">
                {latest ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
              {delta !== 0 && latest != null && (
                <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold", trendColor)}>
                  <TrendIcon size={11} /> {Math.abs(delta)}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">28-day trend</p>
          </div>
          <Sparkles size={16} className="text-gold/60" />
        </div>
        <Sparkline values={values} />
      </motion.div>

      {/* Component breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sleep", val: sleepAvg, max: 40 },
          { label: "Recovery", val: recoveryAvg, max: 25 },
          { label: "Consistency", val: consistencyAvg, max: 20 },
        ].map((c) => (
          <div key={c.label} className="surface-card p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="text-lg font-black tabular-nums mt-0.5">{c.val}<span className="text-[10px] text-muted-foreground/60">/{c.max}</span></p>
            <div className="h-1 rounded-full bg-card mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] transition-all"
                style={{ width: `${Math.min(100, (c.val / c.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Latest weekly review */}
      {review && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/40 bg-card/30 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={12} className="text-gold" />
            <p className="eyebrow text-gold/80">
              Week of {new Date(review.week_starts_on).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
          {review.driver_of_week && (
            <div className="mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Driver of the week</p>
              <p className="text-sm font-bold mt-0.5">{review.driver_of_week}</p>
            </div>
          )}
          {review.next_week_focus && (
            <div className="mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next week focus</p>
              <p className="text-[12px] mt-0.5 leading-relaxed">{review.next_week_focus}</p>
            </div>
          )}
          {review.program_tweak && (
            <div className="rounded-lg border border-gold/20 bg-gold/5 px-2.5 py-1.5 mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gold/80">Program tweak</p>
              <p className="text-[11px] mt-0.5">{review.program_tweak}</p>
            </div>
          )}
        </motion.div>
      )}

      <Button
        variant="ember-glass"
        size="sm"
        className="w-full"
        loading={generating}
        onClick={generateReview}
      >
        <RefreshCw size={12} className="mr-1.5" />
        {review ? "Refresh weekly review" : "Generate weekly review"}
      </Button>
    </div>
  );
};

export default PerformanceOSDashboard;
