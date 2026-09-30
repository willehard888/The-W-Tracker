import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { localDateKey } from "@/lib/date";
import { formatRest, parseDecimal, setRowSeed, suggestedLoad, type SetSeed } from "@/lib/training/runner";
import { prescriptionGloss } from "@/lib/training/prescription";
import { useExerciseHistory, useDaySets, useLogSet } from "@/hooks/use-workout-log";
import { SetRow, fmtKg } from "@/components/coach/session/SetRow";
import Sparkline from "@/components/coach/Sparkline";
import type { ProgramBlock } from "@/hooks/use-coach-program";
import { Input } from "@/components/ui/input";

// Whole local days between two day keys. `logged_on` is a date, and parsing
// it as UTC midnight then rounding called a set logged this evening "1d ago".
const daysAgo = (day: string) => {
  const d = Math.round((Date.parse(`${localDateKey()}T00:00:00Z`) - Date.parse(`${day.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
};

/**
 * Lock your sets, from the program page.
 *
 * Every prescribed set is a row — the same SetRow the runner uses, writing the
 * same workout_set_logs slot (program, week, day, movement, set_index). This
 * used to be one input triple that wrote set 1 forever: a second save
 * overwrote the first, and set 2 could only be recorded by starting the
 * runner. Now the two surfaces are one logger; a set locked here is done in
 * the runner, and the runner's next set is the next open row here.
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
  const daySets = useDaySets(programId, week, dayIndex);
  const logged = (block.slug ? daySets.data?.[block.slug] : undefined) ?? [];
  const history = useExerciseHistory(block.slug ?? null);
  const logSet = useLogSet();

  const sets = Math.min(20, Math.max(1, Math.round(block.sets) || 1));
  const isDone = (n: number) => logged.some((s) => s.set_index === n && (s.weight != null || s.reps != null));
  const doneCount = Array.from({ length: sets }, (_, i) => i + 1).filter(isDone).length;
  const nextSet = Array.from({ length: sets }, (_, i) => i + 1).find((n) => !isDone(n)) ?? sets + 1;

  // Drafts live here, keyed by set: the sheet stays mounted while it is open,
  // and setRowSeed keeps a late history query from overwriting typing.
  const [drafts, setDrafts] = useState<Record<number, SetSeed>>({});
  const [saving, setSaving] = useState<number | null>(null);

  // One felt RPE for the movement — written on every set it locks. Blank
  // falls back to the prescribed number, which is what every row stored
  // before the field existed; a stored value equal to the prescription is
  // not echoed back as the athlete's own.
  const [rpe, setRpe] = useState("");
  const storedRpe = logged.find((s) => s.rpe != null && s.rpe !== block.rpe)?.rpe;
  useEffect(() => { if (storedRpe != null) setRpe(String(storedRpe)); }, [storedRpe]);

  // The most recent PRIOR session of this movement (not today's own rows).
  const prior = (history.data ?? []).filter(
    (h) => !(h.program_id === programId && h.week === week && h.day_index === dayIndex),
  );
  const last = prior.find((h) => h.weight != null);

  // Weight progression, chronological, one point per logged set.
  const weightSeries = (history.data ?? []).filter((h) => h.weight != null).map((h) => Number(h.weight)).reverse();
  const trend = weightSeries.length >= 2 ? weightSeries[weightSeries.length - 1] - weightSeries[0] : 0;

  /** Quick-fill: the weight onto every set still open, reps from last time. */
  const fill = (w: number, r: number | null) => {
    hapticImpact("light");
    setDrafts((d) => {
      const next = { ...d };
      for (let n = nextSet; n <= sets; n++) {
        if (isDone(n)) continue;
        next[n] = { weight: String(w), reps: r != null ? String(r) : d[n]?.reps ?? "" };
      }
      return next;
    });
  };

  const lock = async (n: number, weightStr: string, repsStr: string) => {
    const w = parseDecimal(weightStr);
    const rr = parseDecimal(repsStr);
    const r = rr == null ? null : Math.trunc(rr);
    if (w == null && r == null) { toast.error("Add a weight or reps first."); return; }
    const felt = rpe.trim() === "" ? null : parseInt(rpe, 10);
    const rpeToLog = felt != null && felt >= 1 && felt <= 10 ? felt : block.rpe ?? null;
    hapticImpact("light");
    setSaving(n);
    try {
      await logSet.mutateAsync({
        programId, week, day: dayIndex, slug: block.slug ?? null,
        name: block.name, weight: w, reps: r, rpe: rpeToLog, setIndex: n,
      });
      setDrafts((d) => { const next = { ...d }; delete next[n]; return next; });
      toast.success(`${block.name}: set ${n} locked`);
    } catch {
      toast.error("Couldn't save — check connection.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="surface-panel rounded-xl p-2.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-label font-bold text-muted-foreground">
            Lock your sets{doneCount > 0 && <span className="text-xp-green"> · {doneCount}/{sets}</span>}
          </p>
          {last && (
            <p className="text-label text-muted-foreground tabular-nums">
              Last: {last.weight != null ? fmtKg(Number(last.weight)) : ""}{last.weight != null && last.reps != null ? " × " : ""}{last.reps != null ? `${last.reps}` : ""} · {daysAgo(last.logged_on)}
            </p>
          )}
        </div>
        <p className="text-meta text-muted-foreground mb-2">
          {prescriptionGloss(block)}{block.rest_sec ? ` Rest ${formatRest(block.rest_sec)} between sets.` : ""}
        </p>

        {/* Quick-fill from last time: every open set takes the weight, so
            straight sets are one tap and a lock per set. */}
        {last?.weight != null && nextSet <= sets && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { label: `Same · ${fmtKg(Number(last.weight))}`, w: Number(last.weight) },
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

        <div className="space-y-1.5">
          {Array.from({ length: sets }, (_, i) => i + 1).map((n) => {
            const existing = logged.find((s) => s.set_index === n);
            const suggestion = suggestedLoad(history.data, n, logged, block.reps);
            const seed = setRowSeed(drafts[n], existing, suggestion, n === nextSet);
            return (
              <SetRow
                key={n}
                index={n}
                done={isDone(n)}
                isCurrent={n === nextSet}
                weight={seed.weight}
                reps={seed.reps}
                onChange={(w, r) => setDrafts((d) => ({ ...d, [n]: { weight: w, reps: r } }))}
                onLog={(w, r) => lock(n, w, r)}
                saving={saving === n}
              />
            );
          })}
        </div>

        {/* Felt RPE. Optional — leaving it blank stores the prescribed value. */}
        <label className="mt-2 flex items-center justify-end gap-2 text-label text-muted-foreground">
          <span>Felt RPE</span>
          <Input
            type="number" inputMode="numeric" min={1} max={10} value={rpe}
            placeholder={block.rpe ? String(block.rpe) : "1–10"}
            aria-label="Felt RPE, 1 to 10"
            onChange={(e) => setRpe(e.target.value)}
            className="w-16 rounded-lg px-2 text-center tabular-nums"
          />
        </label>
      </div>

      {/* Progression — weight over time from locked sets. */}
      {weightSeries.length >= 2 && (
        <div className="surface-panel rounded-xl p-2.5">
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
    </div>
  );
};
