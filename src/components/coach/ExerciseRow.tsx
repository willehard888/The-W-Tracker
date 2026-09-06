import { useEffect, useState } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { toast } from "sonner";
import { useExerciseLibrary, resolveExercise, exerciseImgBranded } from "@/lib/exercise-library";
import { resolveGroup } from "@/lib/exercise-group";
import ExerciseTile from "@/components/coach/ExerciseTile";
import { IllustrationThumb, IllustrationHero } from "@/components/coach/ExerciseIllustration";
import { ExerciseCoachingCompact } from "@/components/coach/ExerciseCoachingBlock";
import { resolveIllustration } from "@/lib/exercise-match";
import BrandedExercisePhoto from "@/components/coach/BrandedExercisePhoto";
import { useExerciseHistory, useDayLogs, useLogSet } from "@/hooks/use-workout-log";
import Sparkline from "@/components/coach/Sparkline";

export interface ProgramBlock {
  slug?: string | null;
  name: string;
  sets: number;
  reps: string | number;
  rpe?: number | null;
  notes?: string | null;
  alt?: string | null;
  rest_sec?: number | null;
  tempo?: string | null;
}

interface Props {
  block: ProgramBlock;
  programId: string;
  week: number;
  dayIndex: number;
  /** When false, logging inputs are hidden (e.g. browsing a future week). */
  loggable?: boolean;
}

const daysAgo = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
};

/**
 * One exercise in a session: photo + name + target, expandable to step-by-step
 * instructions and an inline "log your set" row (weight × reps). The logged
 * result is what the AI coach reads to progress the next block.
 */
const ExerciseRow = ({ block, programId, week, dayIndex, loggable = true }: Props) => {
  const libReady = useExerciseLibrary();
  const ex = libReady ? resolveExercise(block.slug, block.name) : null;
  const [open, setOpen] = useState(false);

  const dayLogs = useDayLogs(loggable ? programId : undefined, week, dayIndex);
  const existing = block.slug ? dayLogs.data?.[block.slug] : undefined;
  const history = useExerciseHistory(open ? (block.slug ?? null) : null);
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

  // Illustration first (the consistent hand-drawn set), then the duotone
  // photo, then the muscle-group glyph — every row stays on brand.
  const illustrated = resolveIllustration(block.slug, block.name) ?? (ex ? resolveIllustration(null, ex.name) : null);
  const group = resolveGroup(block.name, ex?.primary);
  const hasMore = !!(ex || illustrated || block.notes || block.alt || block.rest_sec || block.tempo);

  const save = async () => {
    const w = weight.trim() === "" ? null : Number(weight);
    const r = reps.trim() === "" ? null : parseInt(reps, 10);
    if (w == null && r == null) { toast.error("Add a weight or reps first."); return; }
    // Felt RPE beats prescribed RPE. This used to store `block.rpe` — the
    // number the PROGRAM asked for — so workout_set_logs.rpe recorded what the
    // session was supposed to feel like, never what it did. Progression reads
    // this column, so the honest number is the one worth keeping; the
    // prescription stays as the fallback when the athlete doesn't fill it in.
    const feltRpe = rpe.trim() === "" ? null : parseInt(rpe, 10);
    const rpeToLog = feltRpe != null && feltRpe >= 1 && feltRpe <= 10
      ? feltRpe
      : block.rpe ?? null;
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

  const logged = !!existing && (existing.weight != null || existing.reps != null);

  return (
    <li className="border-b border-border/30 last:border-b-0 pb-1.5 last:pb-0">
      <button
        type="button"
        onClick={() => hasMore && (hapticImpact("light"), setOpen((v) => !v))}
        className="w-full flex items-center gap-2.5 py-1.5 text-left"
      >
        {illustrated ? (
          <IllustrationThumb ex={illustrated} size={40} className="rounded-lg" />
        ) : ex?.images?.[0] ? (
          <div className="shrink-0 h-10 w-10 rounded-lg overflow-hidden border border-gold/25 bg-[hsl(258_16%_6%)]">
            <img
              src={exerciseImgBranded(ex.images[0], 96)}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <ExerciseTile group={group} size={40} />
        )}
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm text-foreground block truncate">{block.name}</span>
          {logged && (
            <span className="text-[11px] font-bold text-xp-green inline-flex items-center gap-1">
              <Check size={12} /> {existing!.weight != null ? `${existing!.weight}kg` : ""}{existing!.weight != null && existing!.reps != null ? " × " : ""}{existing!.reps != null ? `${existing!.reps}` : ""} logged
            </span>
          )}
        </div>
        <span className="text-[12px] font-bold text-foreground/85 tabular-nums whitespace-nowrap inline-flex items-center gap-1">
          {block.sets}×{block.reps}{block.rpe ? ` · RPE ${block.rpe}` : ""}
          {hasMore && (
            <ChevronDown size={11} className={cn("text-muted-foreground/70 transition-transform", open && "rotate-180")} />
          )}
        </span>
      </button>

      {open && (
        <div className="pl-0 pb-2 space-y-2.5">
          {/* The static Start/Finish pair here; the rep only plays in the
              detail and the runner, so a list never carries a loop per row. */}
          {illustrated ? (
            <IllustrationHero ex={illustrated} />
          ) : ex?.images?.[0] ? (
            <BrandedExercisePhoto src={ex.images[ex.images.length - 1]} alt={block.name} width={640} imgClassName="max-h-56" />
          ) : null}

          {ex && (ex.primary.length > 0 || ex.equipment) && (
            <p className="text-[11px] font-bold text-muted-foreground">
              {[ex.primary.join(", "), ex.equipment].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Rhythm, the top cue and the worst mistake — the parts of the
              coaching that are worth reading with a loaded bar nearby. The
              full block lives in the library detail. */}
          <ExerciseCoachingCompact slug={illustrated?.slug} />

          {/* Instructions come from the 542-photo set, the illustration from the
              269-illustrated set — and only 40 titles match exactly across the
              two. So for most movements this row drew a beautiful illustration
              and then rendered NOTHING underneath it, mid-workout, which is
              precisely when an athlete needs the cue. The illustrated set has
              its own `steps`; they were already loaded to draw the picture.
              Whichever list has content wins, photo text first because it is
              the longer of the two (avg 155 chars vs 76). */}
          {(ex?.instructions?.length ? ex.instructions : illustrated?.steps ?? []).length > 0 && (
            <ol className="space-y-1 list-none">
              {(ex?.instructions?.length ? ex.instructions : illustrated!.steps).map((step, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-foreground/80 leading-snug">
                  <span className="shrink-0 h-4 w-4 rounded-full bg-gold/15 text-gold text-[10px] font-black flex items-center justify-center mt-px">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}

          {(block.rest_sec || block.tempo) && (
            <p className="text-[11px] text-muted-foreground/80">
              {block.rest_sec ? `Rest ${block.rest_sec}s` : ""}{block.rest_sec && block.tempo ? " · " : ""}{block.tempo ? `Tempo ${block.tempo}` : ""}
            </p>
          )}
          {block.notes && <p className="text-[12px] text-muted-foreground leading-snug">{block.notes}</p>}
          {block.alt && (
            <p className="text-[12px] text-muted-foreground/85">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">Swap</span>{block.alt}
            </p>
          )}

          {/* Progression chart — weight over time from logged sets. */}
          {weightSeries.length >= 2 && (
            <div className="rounded-xl bg-background/40 border border-border/40 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold text-muted-foreground">Progression</p>
                <p className={cn(
                  "text-[11px] font-black tabular-nums",
                  trend > 0 ? "text-xp-green" : trend < 0 ? "text-destructive" : "text-muted-foreground",
                )}>
                  {trend > 0 ? "+" : ""}{trend !== 0 ? `${Math.round(trend * 10) / 10}kg` : "flat"} · {weightSeries.length} logs
                </p>
              </div>
              <Sparkline values={weightSeries} className="w-full h-8" />
            </div>
          )}

          {/* Log your set — weight × reps. The AI reads this to progress you. */}
          {loggable && (
            <div className="rounded-xl bg-background/50 border border-border/50 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-bold text-muted-foreground">Log your result</p>
                {last && (
                  <p className="text-[11px] text-muted-foreground">
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
                      className="press rounded-full bg-gold/12 border border-gold/30 px-2.5 py-1 text-[11px] font-bold text-gold transition-transform"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="number" inputMode="decimal" value={weight} placeholder="kg"
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-[13px] text-center outline-none focus:border-gold/50"
                  />
                </div>
                <span className="text-muted-foreground text-xs font-black">×</span>
                <div className="flex-1">
                  <input
                    type="number" inputMode="numeric" value={reps} placeholder="reps"
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-[13px] text-center outline-none focus:border-gold/50"
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
                    className="w-full rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-[13px] text-center outline-none focus:border-gold/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={save}
                  disabled={logSet.isPending}
                  className="press shrink-0 inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-2 text-[12px] font-black text-primary-foreground disabled:opacity-60 transition-transform"
                >
                  {logSet.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {logged ? "Update" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

export default ExerciseRow;
