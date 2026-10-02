import { fmtDate } from "@/lib/format";
import { m } from "framer-motion";
import { Calendar, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { usePerformanceSnapshots, useAutoWeeklyReview, reviewQuestions } from "@/hooks/use-performance-snapshots";
import { QuestionRow } from "@/components/coach/rows";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { friendlyError, readEdgeError } from "@/lib/error-copy";
import { cn } from "@/lib/utils";
import { NBSP } from "@/lib/format";
import { fmtKg } from "@/components/coach/session/SetRow";

/** One stored lift row of a weekly review — computed in the edge function by the overload rule. */
export interface ReviewLift {
  slug: string;
  name: string;
  move: "up" | "hold" | "repeat";
  weight: number | null;
  reps: number | null;
  step: number;
  reason: string;
  last: { on: string; weight: number | null; reps: number | null } | null;
  pr: boolean;
}

const isLift = (v: unknown): v is ReviewLift =>
  typeof v === "object" && v !== null && typeof (v as ReviewLift).name === "string" && typeof (v as ReviewLift).move === "string";

/** The review's `lifts` column, typed; anything else is an empty week. */
export const reviewLifts = (v: unknown): ReviewLift[] => (Array.isArray(v) ? v.filter(isLift) : []);

/**
 * The week's lifts: the load the rule says next for every movement trained
 * this week — the same number the set row seeds — with a plate earned marked
 * in gold and a PR named. The model's one-sentence verdict sits under them.
 */
const ReviewLifts = ({ lifts, note }: { lifts: ReviewLift[]; note: string | null }) => {
  if (lifts.length === 0) return null;
  const ups = lifts.filter((l) => l.move === "up").length;
  return (
    <div className="mb-2.5" aria-label="Lifts this week">
      <div className="flex items-baseline justify-between">
        <p className="text-label font-bold text-muted-foreground">Lifts this week</p>
        <p className="text-label text-muted-foreground tabular-nums">
          {ups > 0 ? `${ups} ${ups === 1 ? "plate" : "plates"} earned` : "weights hold"}
        </p>
      </div>
      <ul className="mt-1 divide-y divide-border/35">
        {lifts.map((l) => (
          <li key={l.slug} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="block text-meta font-bold text-foreground truncate">
                {l.name}{l.pr ? <span className="text-xp-green"> · PR</span> : ""}
              </span>
              {l.reason && <span className="block text-label text-muted-foreground/75 truncate">{l.reason}</span>}
            </span>
            <span className={cn("shrink-0 text-meta font-black tabular-nums", l.move === "up" ? "text-gold" : "text-foreground")}>
              {l.move === "up" ? "↑ " : l.move === "repeat" ? "↻ " : ""}
              {l.weight != null ? fmtKg(l.weight) : "—"}{l.reps != null ? ` × ${l.reps}` : ""}
              {l.move === "up" && l.step > 0 && <span className="text-label font-bold text-gold/70"> +{l.step}{NBSP}kg</span>}
            </span>
          </li>
        ))}
      </ul>
      {note && <p className="text-meta mt-1.5 leading-relaxed">{note}</p>}
    </div>
  );
};

/**
 * The weekly review: its three component scores (once a review has written
 * them), the review itself, and the button that asks for one. The index card
 * that used to lead this block was the Whealth Index under a second name
 * ("Performance score") and a staler value; Progress's summary shows the index
 * once, from the reader Journey uses.
 */
const PerformanceOSDashboard = () => {
  const { data: snaps, isLoading } = usePerformanceSnapshots(28);
  // Generates itself once a week; the button below refreshes.
  const { data: review } = useAutoWeeklyReview();
  const navigate = useNavigate();
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
    return <div className="h-9 rounded-md skeleton-block" aria-hidden />;
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
            <p className="text-subhead font-black tabular-nums mt-0.5">{c.val}<span className="text-label text-muted-foreground/75">/{c.max}</span></p>
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
          className="surface-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar aria-hidden size={12} className="text-gold" />
            <p className="text-label font-bold text-gold">
              Week of {fmtDate(review.week_starts_on)}
            </p>
          </div>
          {review.driver_of_week && (
            <div className="mb-2.5">
              <p className="text-label font-bold text-muted-foreground">Driver of the week</p>
              <p className="text-note font-bold mt-0.5">{review.driver_of_week}</p>
            </div>
          )}
          {review.next_week_focus && (
            <div className="mb-2.5">
              <p className="text-label font-bold text-muted-foreground">Next week focus</p>
              <p className="text-meta mt-0.5 leading-relaxed">{review.next_week_focus}</p>
            </div>
          )}
          <ReviewLifts lifts={reviewLifts(review.lifts)} note={review.lifts_note ?? null} />
          {reviewQuestions(review.suggested_questions).length > 0 && (
            <div className="mt-2 divide-y divide-border/35 border-t border-border/35" aria-label="Ask about this week">
              {reviewQuestions(review.suggested_questions).map((q) => (
                <QuestionRow key={q} question={q} onClick={() => navigate(`/coach?ask=${encodeURIComponent(q)}&src=review`)} />
              ))}
            </div>
          )}
          {review.program_tweak && (
            <div className="surface-tint-gold rounded-lg px-2.5 py-1.5 mt-2">
              <p className="text-label font-bold text-gold">Program tweak</p>
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
        {review ? "Refresh" : "Generate weekly review"}
      </Button>
    </div>
  );
};

export default PerformanceOSDashboard;
