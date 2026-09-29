import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExercisePreviewSheet } from "@/components/coach/ExercisePreviewSheet";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";
import type { ProgramBlock } from "@/hooks/use-coach-program";

/**
 * The preview sheet, and the two ways it can quietly become the wrong product.
 *
 * One: a photograph. The duotone stock photo was removed from the whole app
 * (c1c4368b) because one movement rendered as a photograph in a list of gold
 * line art reads as a different product, and a member said so. A new surface
 * that renders exercise media is exactly where it would come back.
 *
 * Two: a promise with nothing behind it. The glyph frame used to say "follow
 * the steps below" whatever was underneath, and a movement carried over from an
 * older program — whose name was never a catalog slug — matches neither
 * library, so the sheet said it above nothing at all.
 */

const drawn = ILLUSTRATED_EXERCISES[0];

const block = (over: Partial<ProgramBlock> = {}): ProgramBlock => ({
  slug: null,
  name: drawn.title,
  sets: 4,
  reps: "8-12",
  rpe: 8,
  ...over,
});

describe("the exercise preview sheet", () => {
  it("names the movement and its prescription in the header", () => {
    render(<ExercisePreviewSheet open onClose={() => {}} block={block()} source="program" />);
    expect(screen.getByText(drawn.title)).toBeInTheDocument();
    expect(screen.getByText("4 × 8–12 · RPE 8"), "sets, reps and RPE, the one label").toBeInTheDocument();
  });

  it("never renders a photograph, drawn or not", () => {
    for (const b of [block(), block({ name: "Some Movement From An Older Program" })]) {
      const { container, unmount } = render(
        <ExercisePreviewSheet open onClose={() => {}} block={b} source="program" />,
      );
      for (const img of container.querySelectorAll("img")) {
        const src = img.getAttribute("src") ?? "";
        expect(/\.(jpe?g|png)(\?|$)/i.test(src), `photo-shaped src: ${src}`).toBe(false);
      }
      unmount();
    }
  });

  it("shows a movement it cannot draw as the glyph, and says there is no demonstration", () => {
    // A name from neither library: the illustrated set is keyed by title and
    // the photo set by name, and this matches nothing in either.
    render(
      <ExercisePreviewSheet
        open
        onClose={() => {}}
        block={block({ name: "Zzz Nonexistent Movement" })}
        source="program"
      />,
    );
    expect(
      screen.getByText("No demonstration for this movement"),
      "an empty frame that promised steps was the bug",
    ).toBeInTheDocument();
    expect(screen.queryByText("Follow the steps below")).not.toBeInTheDocument();
  });

  it("promises steps only when it has them", () => {
    render(<ExercisePreviewSheet open onClose={() => {}} block={block()} source="program" />);
    expect(screen.queryByText("No demonstration for this movement")).not.toBeInTheDocument();
  });

  it("renders the written steps of a movement it knows", () => {
    render(<ExercisePreviewSheet open onClose={() => {}} block={block()} source="program" />);
    expect(screen.getByText("How to perform")).toBeInTheDocument();
    expect(screen.getByText(drawn.steps[0])).toBeInTheDocument();
  });

  it("carries rest and tempo when the block prescribes them", () => {
    render(
      <ExercisePreviewSheet
        open
        onClose={() => {}}
        block={block({ rest_sec: 90, tempo: "3-1-1" })}
        source="program"
      />,
    );
    expect(screen.getByText("Rest 1:30 · Tempo 3-1-1")).toBeInTheDocument();
    // The header carries the rest too, as the runner shows it.
    expect(screen.getByText("4 × 8–12 · RPE 8 · 1:30 rest")).toBeInTheDocument();
  });

  it("renders nothing at all when closed", () => {
    const { container } = render(
      <ExercisePreviewSheet open={false} onClose={() => {}} block={block()} source="program" />,
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("survives a null block without throwing", () => {
    // The parent clears the block on close; the sheet must not care.
    expect(() =>
      render(<ExercisePreviewSheet open={false} onClose={() => {}} block={null} source="program" />),
    ).not.toThrow();
  });
});

describe("the hand on the dose", () => {
  it("offers Edit dose only when the page allows hand edits, and saves the athlete's numbers", async () => {
    const { rerender } = render(<ExercisePreviewSheet open onClose={() => {}} block={block()} source="program" />);
    expect(screen.queryByText("Edit dose")).toBeNull();
    const onEditDose = vi.fn();
    rerender(<ExercisePreviewSheet open onClose={() => {}} block={block()} source="program" onEditDose={onEditDose} editReach="Also changes the weeks after this one" />);
    fireEvent.click(screen.getByText("Edit dose"));
    expect(screen.getByText("Also changes the weeks after this one")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reps, a number or a range like 5-8"), { target: { value: "5-8" } });
    fireEvent.click(screen.getByLabelText("Add 1 set"));
    fireEvent.click(screen.getByText("Save dose"));
    expect(onEditDose).toHaveBeenCalledWith({ sets: 5, reps: "5-8", rpe: 8, rest_sec: null });
  });
});
