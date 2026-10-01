import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { localDateKey } from "@/lib/date";
import { formatRest, parseDecimal, setRowSeed, suggestedLoad, type SetSeed } from "@/lib/training/runner";
import { loadAdvice, LOAD_STEP_KG } from "@/lib/training/overload";
import { NBSP } from "@/lib/format";
import { prescriptionGloss } from "@/lib/training/prescription";
import { useExerciseHistory, useDaySets, useLogSet } from "@/hooks/use-workout-log";
import { SetRow, fmtKg } from "@/components/coach/session/SetRow";
import { ProgressionChart } from "@/components/coach/ProgressionChart";
import { sessionsFor } from "@/lib/training/progression";
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
  const prior = useMemo(
    () => (history.data ?? []).filter((h) => !(h.program_id === programId && h.week === week && h.day_index === dayIndex)),
    [history.data, programId, week, dayIndex],
  );
  const last = prior.find((h) => h.weight != null);
  // What to load next, by the double-progression rule — the number the
  // coach would say, with the reason.
  const advice = useMemo(() => loadAdvice(prior, block.reps, block.rpe), [prior, block.reps, block.rpe]);

  // Every logged session of this movement, oldest first — the curve's data.
  const sessions = useMemo(() => sessionsFor(history.data ?? []), [history.data]);

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
      toast.error("Couldn't save. Connection hiccup. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="surface-panel rounded-xl p-2.5">
        <p className="text-label font-bold text-muted-foreground mb-1">
          Lock your sets{doneCount > 0 && <span className="text-xp-green"> · {doneCount}/{sets}</span>}
        </p>
        <p className="text-meta text-muted-foreground mb-2">
          {prescriptionGloss(block)}{block.rest_sec ? ` Rest ${formatRest(block.rest_sec)} between sets.` : ""}
        </p>

        {/* Next: the weight the rule says, why, and one tap to load it on every
            open set. The other two chips stay for the athlete who knows better. */}
        {last?.weight != null && advice.weight != null && nextSet <= sets && (
          <div className={cn("rounded-xl p-2.5 mb-2", advice.move === "up" ? "surface-tint-gold" : "surface-inset")} aria-label="Next load">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-label font-bold uppercase tracking-wide text-muted-foreground/75">Next</p>
              <p className="text-label text-muted-foreground tabular-nums">
                Last {fmtKg(Number(last.weight))}{last.reps != null ? ` × ${last.reps}` : ""} · {daysAgo(last.logged_on)}
              </p>
            </div>
            <p className="font-display text-head font-black tabular-nums leading-tight text-foreground mt-0.5">
              {fmtKg(advice.weight)}{advice.reps != null ? ` × ${advice.reps}` : ""}
              {advice.move === "up" && <span className="ml-2 text-dense font-black text-gold">↑ +{advice.step}{NBSP}kg</span>}
            </p>
            {advice.reason && <p className="text-meta text-muted-foreground mt-0.5">{advice.reason}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                { label: `Load ${fmtKg(advice.weight)}`, w: advice.weight, r: advice.reps ?? last.reps ?? null, lead: true },
                ...(advice.move === "up" ? [] : [{ label: `+${LOAD_STEP_KG} kg`, w: Number(last.weight) + LOAD_STEP_KG, r: last.reps ?? null, lead: false }]),
                { label: "+5 kg", w: Number(last.weight) + 5, r: last.reps ?? null, lead: false },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => fill(c.w, c.r)}
                  className={cn(
                    "press relative before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] rounded-full px-2.5 py-1 text-label font-bold transition-transform",
                    c.lead ? "bg-gold text-[hsl(26_85%_10%)]" : "bg-gold/12 border border-gold/30 text-gold",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {Array.from({ length: sets }, (_, i) => i + 1).map((n) => {
            const existing = logged.find((s) => s.set_index === n);
            const suggestion = suggestedLoad(prior, n, logged, block.reps, block.rpe);
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

      {/* Progression — the estimated 1RM per session, and the session's sets. */}
      {sessions.length > 0 && (
        <div className="surface-panel rounded-xl p-2.5">
          <p className="text-label font-bold text-muted-foreground mb-2">Progression</p>
          <ProgressionChart points={sessions} name={block.name} />
        </div>
      )}
    </div>
  );
};
