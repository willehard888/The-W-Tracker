import { useEffect } from "react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { IllustrationPlayer } from "@/components/coach/ExerciseIllustration";
import { ExerciseCoachingBlock } from "@/components/coach/ExerciseCoachingBlock";
import ExerciseTile from "@/components/coach/ExerciseTile";
import { resolveIllustration } from "@/lib/exercise-match";
import { resolveGroup } from "@/lib/exercise-group";
import { useExerciseLibrary, resolveExercise } from "@/lib/exercise-library";
import { track, FUNNEL } from "@/lib/analytics";
import type { ProgramBlock } from "@/hooks/use-coach-program";

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
}: {
  open: boolean;
  onClose: () => void;
  /** Null while the sheet animates shut — the last block is already gone. */
  block: ProgramBlock | null;
  /** Which surface opened it. A funnel does not need to know the movement. */
  source: "program" | "runner";
}) => {
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
      subtitle={
        block
          ? `${block.sets}×${block.reps}${block.rpe ? ` · RPE ${block.rpe}` : ""}`
          : undefined
      }
      height="tall"
    >
      {block && (
        <div className="space-y-5">
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
              <p className="text-label font-bold text-muted-foreground/75">
                {steps.length > 0 ? "Follow the steps below" : "No demonstration for this movement"}
              </p>
            </div>
          )}

          {muscles.length > 0 && (
            <p className="text-note text-muted-foreground/90">
              <span className="text-gold font-bold">Works</span>{" "}
              {muscles.join(", ")}
              {ex?.equipment ? ` · ${ex.equipment}` : ""}
            </p>
          )}

          {(block.rest_sec || block.tempo) && (
            <p className="text-meta text-muted-foreground/75">
              {block.rest_sec ? `Rest ${block.rest_sec}s` : ""}
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
            <p className="text-meta text-muted-foreground/80 leading-relaxed">{block.notes}</p>
          )}
        </div>
      )}
    </BottomSheet>
  );
};

export default ExercisePreviewSheet;
