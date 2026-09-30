import { hapticImpact } from "@/lib/haptics";
import { Check, ChevronRight } from "lucide-react";
import { useExerciseLibrary, resolveExercise } from "@/lib/exercise-library";
import { resolveGroup } from "@/lib/exercise-group";
import ExerciseTile from "@/components/coach/ExerciseTile";
import { IllustrationThumb } from "@/components/coach/ExerciseIllustration";
import { resolveIllustration } from "@/lib/exercise-match";
import { useDaySets } from "@/hooks/use-workout-log";
import { fmtKg } from "@/components/coach/session/SetRow";
import { prescriptionLabel } from "@/lib/training/prescription";

import type { ProgramBlock } from "@/hooks/use-coach-program";
export type { ProgramBlock };

interface Props {
  block: ProgramBlock;
  programId: string;
  week: number;
  dayIndex: number;
  /** When false, logging inputs are hidden (e.g. browsing a future week). */
  loggable?: boolean;
  /** Open the movement full size. The row itself is only a row. */
  onOpen: () => void;
}

/**
 * One exercise in a planned session: drawing, name, target, and whether it has
 * been logged today.
 *
 * It used to be an accordion as well — the illustration again at hero size,
 * the muscles, the coaching prose, the instructions, a progression chart and a
 * logging form, all inline. That made it a second, divergent copy of what the
 * exercise library already rendered, and it is now one: tapping opens
 * ExercisePreviewSheet, which owns all of it.
 */
const ExerciseRow = ({ block, programId, week, dayIndex, loggable = true, onOpen }: Props) => {
  const libReady = useExerciseLibrary();
  const ex = libReady ? resolveExercise(block.slug, block.name) : null;

  const daySets = useDaySets(loggable ? programId : undefined, week, dayIndex);
  const rows = (block.slug ? daySets.data?.[block.slug] : undefined) ?? [];
  const done = rows.filter((r) => r.weight != null || r.reps != null);
  const sets = Math.max(1, block.sets || 1);
  const lockedCount = new Set(done.map((r) => r.set_index)).size;
  // The heaviest locked set is the one worth a glance on the row.
  const top = [...done].sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1) || (b.reps ?? 0) - (a.reps ?? 0))[0];

  // The drawing, or the muscle-group glyph. There is no third option any
  // more: the duotone photo that used to sit between them was the one thing
  // in a session that looked like it came from somewhere else.
  const illustrated = resolveIllustration(block.slug, block.name) ?? (ex ? resolveIllustration(null, ex.name) : null);
  const group = resolveGroup(block.name, ex?.primary);

  return (
    <li className="border-b border-border/35 last:border-b-0 pb-1.5 last:pb-0">
      <button
        type="button"
        onClick={() => { hapticImpact("light"); onOpen(); }}
        className="press-row w-full min-h-11 flex items-center gap-2.5 py-1.5 text-left"
      >
        {illustrated ? (
          <IllustrationThumb ex={illustrated} size={40} className="rounded-lg" />
        ) : (
          <ExerciseTile group={group} size={40} />
        )}
        <div className="flex-1 min-w-0">
          {/* Two lines before an ellipsis: beside the prescription a long name
              lost the word that tells two lifts apart ("Reverse Grip Bent-Ov…"). */}
          <span className="font-bold text-sm leading-snug text-foreground line-clamp-2">{block.name}</span>
          {lockedCount > 0 && top && (
            <span className="text-label font-bold text-xp-green inline-flex items-center gap-1 tabular-nums">
              <Check aria-hidden size={12} /> {Math.min(lockedCount, sets)}/{sets} locked
              {top.weight != null ? ` · ${fmtKg(Number(top.weight))}` : ""}
              {top.weight != null && top.reps != null ? " × " : top.reps != null ? " · " : ""}
              {top.reps != null ? `${top.reps}` : ""}
            </span>
          )}
        </div>
        <span className="text-meta font-bold text-foreground/85 tabular-nums whitespace-nowrap inline-flex items-center gap-1">
          {prescriptionLabel(block)}
          <ChevronRight aria-hidden size={11} className="text-muted-foreground/75" />
        </span>
      </button>
    </li>
  );
};

export default ExerciseRow;
