import { fmtDate } from "@/lib/format";
import { m } from "framer-motion";
import { Calendar, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePerformanceSnapshots, useLatestWeeklyReview } from "@/hooks/use-performance-snapshots";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { friendlyError, readEdgeError } from "@/lib/error-copy";

/**
 * The weekly review: its three component scores (once a review has written
 * them), the review itself, and the button that asks for one. The index card
 * that used to lead this block was the Whealth Index under a second name
 * ("Performance score") and a staler value; Progress's summary shows the index
 * once, from the reader Journey uses.
 */
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
      toast.error((await readEdgeError(e, friendlyError(e, "The weekly review is unavailable right now."))).message);
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    // The height of what usually follows (the button), not of the card that left.
    return <div className="h-9 rounded-md bg-card/40 skeleton-block" aria-hidden />;
  }

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
  // Two writers fill `components`: coach-weekly-review (the *_pts keys below)
  // and the nightly index snapshot (a per-pillar breakdown, no *_pts). With
  // only nightly rows the three tiles read 0/40 · 0/25 · 0/20 under an 82.
  const hasParts = last7.some((x) => (x.components as Record<string, unknown> | null)?.sleep_pts != null);
  const sleepAvg = avgComponent("sleep_pts");
  const recoveryAvg = avgComponent("energy_pts");
  const consistencyAvg = avgComponent("consistency_pts");

  return (
    <div className="space-y-3">
      {/* Component breakdown — only once a weekly review has written it. */}
      {hasParts && (
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sleep", val: sleepAvg, max: 40 },
          { label: "Recovery", val: recoveryAvg, max: 25 },
          { label: "Consistency", val: consistencyAvg, max: 20 },
        ].map((c) => (
          <div key={c.label} className="surface-card p-3">
            <p className="text-label font-bold text-muted-foreground">{c.label}</p>
            <p className="text-lg font-black tabular-nums mt-0.5">{c.val}<span className="text-label text-muted-foreground/75">/{c.max}</span></p>
            <div className="h-1 rounded-full bg-card mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] transition-[width]"
                style={{ width: `${Math.min(100, (c.val / c.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Latest weekly review */}
      {review && (
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/40 bg-card/30 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar aria-hidden size={12} className="text-gold" />
            <p className="text-label font-bold text-gold/80">
              Week of {fmtDate(review.week_starts_on)}
            </p>
          </div>
          {review.driver_of_week && (
            <div className="mb-2.5">
              <p className="text-label font-bold text-muted-foreground">Driver of the week</p>
              <p className="text-sm font-bold mt-0.5">{review.driver_of_week}</p>
            </div>
          )}
          {review.next_week_focus && (
            <div className="mb-2.5">
              <p className="text-label font-bold text-muted-foreground">Next week focus</p>
              <p className="text-meta mt-0.5 leading-relaxed">{review.next_week_focus}</p>
            </div>
          )}
          {review.program_tweak && (
            <div className="rounded-lg border border-gold/20 bg-gold/5 px-2.5 py-1.5 mt-2">
              <p className="text-label font-bold text-gold/80">Program tweak</p>
              <p className="text-meta mt-0.5">{review.program_tweak}</p>
            </div>
          )}
        </m.div>
      )}

      <Button
        variant="ember-glass"
        size="sm"
        className="w-full"
        loading={generating}
        onClick={generateReview}
      >
        <RefreshCw aria-hidden size={12} className="mr-1.5" />
        {review ? "Refresh weekly review" : "Generate weekly review"}
      </Button>
    </div>
  );
};

export default PerformanceOSDashboard;
