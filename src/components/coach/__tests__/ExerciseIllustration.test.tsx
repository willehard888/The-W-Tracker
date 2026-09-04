import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IllustrationPlayer } from "@/components/coach/ExerciseIllustration";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";

/**
 * The player turns the two shipped technique states into a demonstration.
 * These cover the three things that make it safe to run on a phone: it only
 * animates while it is meant to, it can be stopped, and reduced motion never
 * reaches the animation at all.
 */

const ex = ILLUSTRATED_EXERCISES[0];

/** jsdom has no IntersectionObserver; treat everything as on screen. */
const stubIntersectionObserver = (intersecting: boolean) => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        this.cb([{ isIntersecting: intersecting }]);
      }
      observe() {}
      disconnect() {}
    },
  );
};

const stubReducedMotion = (reduce: boolean) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

describe("IllustrationPlayer", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubIntersectionObserver(true);
    stubReducedMotion(false);
  });

  it("cross-fades both technique states while in view", () => {
    const { container } = render(<IllustrationPlayer ex={ex} />);

    // One frame per state, plus the blur-up base from the bundled thumb.
    expect(container.querySelectorAll(".rep-phase-a")).toHaveLength(1);
    expect(container.querySelectorAll(".rep-phase-b")).toHaveLength(1);

    // Both positions are described, so a screen reader gets the same
    // information the animation carries.
    expect(screen.getByAltText(`${ex.title} — start position`)).toBeInTheDocument();
    expect(screen.getByAltText(`${ex.title} — finish position`)).toBeInTheDocument();
  });

  it("stops when the athlete pauses it", () => {
    const { container } = render(<IllustrationPlayer ex={ex} />);

    fireEvent.click(screen.getByLabelText("Pause the movement"));

    expect(container.querySelectorAll(".rep-phase-a")).toHaveLength(0);
    expect(container.querySelectorAll(".rep-phase-b")).toHaveLength(0);
    // Paused rests on the start position rather than a half-faded blend.
    expect(screen.getByText("Start position")).toBeInTheDocument();
    expect(screen.getByLabelText("Play the movement")).toBeInTheDocument();
  });

  it("does not animate off screen", () => {
    stubIntersectionObserver(false);
    const { container } = render(<IllustrationPlayer ex={ex} />);
    expect(container.querySelectorAll(".rep-phase-a")).toHaveLength(0);
  });

  it("falls back to the static Start/Finish pair under reduced motion", () => {
    stubReducedMotion(true);
    const { container } = render(<IllustrationPlayer ex={ex} />);

    expect(container.querySelectorAll(".rep-phase-a")).toHaveLength(0);
    // Nothing is hidden from them — both positions and the labels remain.
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Finish")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pause the movement")).not.toBeInTheDocument();
  });
});
