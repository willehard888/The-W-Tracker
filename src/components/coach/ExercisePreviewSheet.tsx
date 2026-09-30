import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { IllustrationPlayer } from "@/components/coach/ExerciseIllustration";
import { ExerciseCoachingBlock } from "@/components/coach/ExerciseCoachingBlock";
import ExerciseTile from "@/components/coach/ExerciseTile";
import { resolveIllustration } from "@/lib/exercise-match";
import { resolveGroup } from "@/lib/exercise-group";
import { useExerciseLibrary, resolveExercise } from "@/lib/exercise-library";
import { ExerciseLogForm } from "@/components/coach/ExerciseLogForm";
import { Stepper } from "@/components/coach/session/SetRow";
import { prescriptionLabel } from "@/lib/training/prescription";
import { clampDose, type DosePatch } from "@/lib/training/plan-edit";
import { formatRest } from "@/lib/training/runner";
import { track, FUNNEL } from "@/lib/analytics";
import type { ProgramBlock } from "@/hooks/use-coach-program";
import { Input } from "@/components/ui/input";

/**
 * "What is this movement, actually?"
 *
 * A name and a 40 px thumbnail is enough for somebody who already knows the
 * lift. For everybody else the day's plan is a list of words, and the only way
 * to find out was to start the workout and hope the runner's picture explained
 * it — or leave the app entirely.
 *
 * A sheet rather than the /exercises/:slug route on purpose: the route would
 * navigate away and bring the athlete back to the top of the program page,
 * having lost which week and which day they were reading. Everything here is
 * already built — the player, the glyph fallback, the coaching prose, the
 * steps — so this is a frame around content that existed, not a new surface.
 *
 * There is no photograph. The duotone stock photo that used to be the middle
 * fallback was removed deliberately (c1c4368b): one movement rendered as a
 * photograph in a list of gold line art reads as a different product, and a
 * member noticed. A movement with no drawing shows the glyph and leans on its
 * written steps, which every illustrated movement has.
 */
export const ExercisePreviewSheet = ({
  open,
  onClose,
  block,
  source,
  logging,
  onSwap,
  onRemove,
  onEditDose,
  editReach,
}: {
  open: boolean;
  onClose: () => void;
  /** Null while the sheet animates shut — the last block is already gone. */
  block: ProgramBlock | null;
  /** Which surface opened it. A funnel does not need to know the movement. */
  source: "program" | "runner";
  /** Where to write a logged result. Omitted while browsing a future week. */
  logging?: { programId: string; week: number; dayIndex: number };
  /** Hand edits, offered only while nothing is logged for this movement. */
  onSwap?: () => void;
  onRemove?: () => void;
  /** The dose by hand — sets, reps, RPE, rest. Same gate as swap. */
  onEditDose?: (patch: DosePatch) => void;
  /** What the page says an edit reaches ("Also changes the weeks after this one"). */
  editReach?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [dose, setDose] = useState<{ sets: string; reps: string; rpe: string; rest: string }>({ sets: "", reps: "", rpe: "", rest: "" });
  const beginEdit = () => {
    if (!block) return;
    setDose({ sets: String(block.sets), reps: String(block.reps ?? ""), rpe: block.rpe != null ? String(block.rpe) : "", rest: block.rest_sec != null ? String(block.rest_sec) : "" });
    setEditing(true);
  };
  const saveDose = () => {
    const patch = clampDose({
      sets: Number(dose.sets) || undefined,
      reps: dose.reps,
      rpe: dose.rpe.trim() === "" ? null : Number(dose.rpe),
      rest_sec: dose.rest.trim() === "" ? null : Number(dose.rest),
    });
    onEditDose?.(patch);
    setEditing(false);
  };
  useEffect(() => { if (!open) setEditing(false); }, [open]);
  const libReady = useExerciseLibrary();
  const ex = block && libReady ? resolveExercise(block.slug, block.name) : null;
  const illustrated = block
    ? resolveIllustration(block.slug, block.name) ?? (ex ? resolveIllustration(null, ex.name) : null)
    : null;
  const group = resolveGroup(block?.name ?? "", ex?.primary);

  // Fired on the movement, not on the tap, so a sheet reopened for a second
  // exercise counts twice and a re-render counts once.
  const drawn = !!illustrated;
  const slug = block?.slug ?? null;
  useEffect(() => {
    if (!open || !block) return;
    void track(FUNNEL.exercisePreviewOpened, { source, drawn });
    // `slug` stands in for "which movement" without entering the props.
  }, [open, slug, source, drawn, block]);

  // Photo-set instructions first: they are the longer of the two lists
  // (avg 155 chars vs 76), and the illustrated `steps` are the fallback that
  // stops a drawn movement from rendering a picture and nothing beneath it.
  const steps = ex?.instructions?.length ? ex.instructions : illustrated?.steps ?? [];
  const muscles = illustrated
    ? [...illustrated.primary, ...illustrated.secondary]
    : ex?.primary ?? [];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={block?.name ?? "Exercise"}
      title={block?.name}
      subtitle={block ? prescriptionLabel(block, { rest: true }) : undefined}
      height="tall"
    >
      {block && (
        <div className="space-y-5">
          {/* The dose, and the hand on it. A self-built program used to carry
              the engine's numbers with no way to change them. */}
          {onEditDose && (
            editing ? (
              <div className="surface-tint-gold rounded-xl p-2.5 space-y-2">
                <p className="text-label font-bold text-muted-foreground">Your dose</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <Stepper value={dose.sets} unit="sets" inputMode="numeric" label="Sets" stepLabel="1 set"
                    onChange={(v) => setDose((d) => ({ ...d, sets: v }))}
                    onStep={(k) => setDose((d) => ({ ...d, sets: String(Math.min(20, Math.max(1, (Number(d.sets) || 1) + k))) }))} />
                  <Stepper value={dose.rpe} unit="RPE" inputMode="decimal" label="RPE" stepLabel="0.5 RPE"
                    onChange={(v) => setDose((d) => ({ ...d, rpe: v }))}
                    onStep={(k) => setDose((d) => ({ ...d, rpe: String(Math.min(10, Math.max(5, (Number(d.rpe) || 8) + 0.5 * k))) }))} />
                  <label className="flex items-center gap-2 text-label text-muted-foreground">
                    <span className="w-9">Reps</span>
                    <Input type="text" inputMode="numeric" value={dose.reps} aria-label="Reps, a number or a range like 5-8" placeholder="5-8"
                      onChange={(e) => setDose((d) => ({ ...d, reps: e.target.value.replace(/[^0-9-]/g, "") }))}
                      className="w-[4.25rem] rounded-lg px-1 text-center font-bold tabular-nums" />
                  </label>
                  <Stepper value={dose.rest} unit="s" inputMode="numeric" label="Rest in seconds" stepLabel="15 seconds"
                    onChange={(v) => setDose((d) => ({ ...d, rest: v }))}
                    onStep={(k) => setDose((d) => ({ ...d, rest: String(Math.min(900, Math.max(0, (Number(d.rest) || 0) + 15 * k))) }))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-label text-muted-foreground">{editReach ?? "From this week on"}</p>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button type="button" variant="ember" size="sm" onClick={saveDose}>Save dose</Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={beginEdit}>
                Edit dose
              </Button>
            )
          )}

          {logging && (
            <ExerciseLogForm
              block={block}
              programId={logging.programId}
              week={logging.week}
              dayIndex={logging.dayIndex}
            />
          )}

          {(onSwap || onRemove) && (
            <div className="flex gap-2">
              {onSwap && (
                <Button type="button" variant="outline" size="sm" onClick={() => { onSwap(); onClose(); }}>
                  <ArrowLeftRight aria-hidden size={14} /> Swap
                </Button>
              )}
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => { onRemove(); onClose(); }}
                >
                  Remove
                </Button>
              )}
            </div>
          )}

          {illustrated ? (
            <IllustrationPlayer ex={illustrated} />
          ) : (
            <div className="rounded-2xl border border-gold/20 bg-[hsl(258_16%_6%)] py-10 flex flex-col items-center gap-2">
              <ExerciseTile group={group} size={72} />
              {/* The glyph used to promise steps unconditionally. A movement
                  carried over from an older program can match neither library —
                  its name was never a catalog slug — and then the sheet said
                  "follow the steps below" above nothing at all. Say which of
                  the two this is. */}
              <p className="text-label font-bold text-muted-foreground">
                {steps.length > 0 ? "Follow the steps below" : "No demonstration for this movement"}
              </p>
            </div>
          )}

          {muscles.length > 0 && (
            <p className="text-note text-muted-foreground">
              <span className="text-gold font-bold">Works</span>{" "}
              {muscles.join(", ")}
              {ex?.equipment ? ` · ${ex.equipment}` : ""}
            </p>
          )}

          {(block.rest_sec || block.tempo) && (
            <p className="text-meta text-muted-foreground/75">
              {block.rest_sec ? `Rest ${formatRest(block.rest_sec)}` : ""}
              {block.rest_sec && block.tempo ? " · " : ""}
              {block.tempo ? `Tempo ${block.tempo}` : ""}
            </p>
          )}

          {steps.length > 0 && (
            <div>
              <p className="eyebrow-sm mb-2">How to perform</p>
              <ol className="space-y-2 list-none">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-note text-foreground/85 leading-relaxed">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-gold/15 text-gold text-label font-black flex items-center justify-center mt-px">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Returns null for the two thirds of movements without written
              coaching, so the section is simply absent rather than empty. */}
          <ExerciseCoachingBlock slug={illustrated?.slug} />

          {block.notes && (
            <p className="text-meta text-muted-foreground leading-relaxed">{block.notes}</p>
          )}

          {block.alt && (
            <p className="text-meta text-muted-foreground">
              <span className="text-label font-bold text-muted-foreground mr-1">Swap</span>
              {block.alt}
            </p>
          )}

        </div>
      )}
    </BottomSheet>
  );
};

export default ExercisePreviewSheet;
