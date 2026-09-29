import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { localDateKey } from "@/lib/date";
import { parseDecimal, decimalInput } from "@/lib/training/runner";
import { useExerciseHistory, useDayLogs, useLogSet } from "@/hooks/use-workout-log";
import Sparkline from "@/components/coach/Sparkline";
import type { ProgramBlock } from "@/hooks/use-coach-program";

// Whole local days between two day keys. `logged_on` is a date, and parsing
// it as UTC midnight then rounding called a set logged this evening "1d ago".
const daysAgo = (day: string) => {
  const d = Math.round((Date.parse(`${localDateKey()}T00:00:00Z`) - Date.parse(`${day.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
};

/**
 * Log a result against a planned movement, from the program page.
 *
 * Lifted out of ExerciseRow's accordion. The row's tap now opens the preview
 * sheet, which made the accordion unreachable and took this form, the
 * progression chart and the swap controls with it — so they live here and the
 * sheet renders them. One copy, one place to fix.
 *
 * This is the top-set logger, not the runner: it writes set 1, which is what
 * every row wrote before per-set logging existed. The runner owns sets 2..n.
 */
export const ExerciseLogForm = ({
  block,
  programId,
  week,
  dayIndex,
}: {
  block: ProgramBlock;
  programId: string;
  week: number;
  dayIndex: number;
}) => {
  const dayLogs = useDayLogs(programId, week, dayIndex);
  const existing = block.slug ? dayLogs.data?.[block.slug] : undefined;
  const history = useExerciseHistory(block.slug ?? null);
  const logSet = useLogSet();

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  useEffect(() => {
    if (existing) {
      setWeight(existing.weight != null ? String(existing.weight) : "");
      setReps(existing.reps != null ? String(existing.reps) : "");
      // Only show a stored RPE the athlete could have given. Rows logged before
      // this field existed hold the prescribed value, so echoing it back would
      // present the program's number as the athlete's own.
      const stored = (existing as { rpe?: number | null }).rpe;
      setRpe(stored != null && stored !== block.rpe ? String(stored) : "");
    }
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The most recent PRIOR log for this exercise (skip today's own slot).
  const last = (history.data ?? []).find((h) => h.id !== existing?.id && h.weight != null);

  // Weight progression series, chronological (oldest → newest), for the chart.
  const weightSeries = (history.data ?? [])
    .filter((h) => h.weight != null)
    .map((h) => Number(h.weight))
    .reverse();
  const trend = weightSeries.length >= 2 ? weightSeries[weightSeries.length - 1] - weightSeries[0] : 0;

  const fill = (w: number | null, r: number | null) => {
    hapticImpact("light");
    if (w != null) setWeight(String(w));
    if (r != null) setReps(String(r));
  };

  const logged = !!existing && (existing.weight != null || existing.reps != null);

  const save = async () => {
    const w = parseDecimal(weight);
    const rr = parseDecimal(reps);
    const r = rr == null ? null : Math.trunc(rr);
    if (w == null && r == null) { toast.error("Add a weight or reps first."); return; }
    // Felt RPE beats prescribed RPE. This used to store `block.rpe` — the
    // number the PROGRAM asked for — so workout_set_logs.rpe recorded what the
    // session was supposed to feel like, never what it did. Progression reads
    // this column, so the honest number is the one worth keeping; the
    // prescription stays as the fallback when the athlete doesn't fill it in.
    const feltRpe = rpe.trim() === "" ? null : parseInt(rpe, 10);
    const rpeToLog = feltRpe != null && feltRpe >= 1 && feltRpe <= 10 ? feltRpe : block.rpe ?? null;
    hapticImpact("light");
    try {
      await logSet.mutateAsync({
        programId, week, day: dayIndex, slug: block.slug ?? null,
        name: block.name, weight: w, reps: r, rpe: rpeToLog,
      });
      hapticNotification("success");
      toast.success(`${block.name}: logged`);
    } catch {
      toast.error("Couldn't save — check connection.");
    }
  };

  return (
    <div className="space-y-3">
      {/* Progression chart — weight over time from logged sets. */}
      {weightSeries.length >= 2 && (
        <div className="rounded-xl bg-background/40 border border-border/40 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-label font-bold text-muted-foreground">Progression</p>
            <p className={cn(
              "text-label font-black tabular-nums",
              trend > 0 ? "text-xp-green" : trend < 0 ? "text-destructive" : "text-muted-foreground",
            )}>
              {trend > 0 ? "+" : ""}{trend !== 0 ? `${Math.round(trend * 10) / 10}kg` : "flat"} · {weightSeries.length} logs
            </p>
          </div>
          <Sparkline values={weightSeries} className="w-full h-8" />
        </div>
      )}

      {/* Log your set — weight × reps. The AI reads this to progress you. */}
      <div className="rounded-xl bg-background/50 border border-border/50 p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-label font-bold text-muted-foreground">Log your result</p>
          {last && (
            <p className="text-label text-muted-foreground">
              Last: {last.weight != null ? `${last.weight}kg` : ""}{last.weight != null && last.reps != null ? " × " : ""}{last.reps != null ? `${last.reps}` : ""} · {daysAgo(last.logged_on)}
            </p>
          )}
        </div>
        {/* Quick-fill from last session — tap to prefill, tweak if needed. */}
        {last?.weight != null && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { label: `Same · ${last.weight}kg`, w: Number(last.weight) },
              { label: "+2.5 kg", w: Number(last.weight) + 2.5 },
              { label: "+5 kg", w: Number(last.weight) + 5 },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => fill(c.w, last.reps ?? null)}
                className="press relative before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] rounded-full bg-gold/12 border border-gold/30 px-2.5 py-1 text-label font-bold text-gold transition-transform"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="text" inputMode="decimal" value={weight} placeholder="kg" aria-label="Weight in kilograms"
              onChange={(e) => setWeight(decimalInput(e.target.value))}
              className="w-full rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-copy text-center outline-none focus:border-gold/50"
            />
          </div>
          <span className="text-muted-foreground text-xs font-black">×</span>
          <div className="flex-1">
            <input
              type="number" inputMode="numeric" value={reps} placeholder="reps"
              onChange={(e) => setReps(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-copy text-center outline-none focus:border-gold/50"
            />
          </div>
          {/* Felt RPE. Optional — leaving it blank falls back to the
              prescribed value, which is what every row stored before. */}
          <div className="flex-1">
            <input
              type="number" inputMode="numeric" min={1} max={10} value={rpe}
              placeholder={block.rpe ? `RPE ${block.rpe}` : "RPE"}
              aria-label="Felt RPE, 1 to 10"
              onChange={(e) => setRpe(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-copy text-center outline-none focus:border-gold/50"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={logSet.isPending}
            className="press shrink-0 inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-2 text-meta font-black text-primary-foreground disabled:opacity-60 transition-transform"
          >
            {logSet.isPending ? <Loader2 aria-hidden size={13} className="animate-spin" /> : <Check aria-hidden size={13} />}
            {logged ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExerciseLogForm;
