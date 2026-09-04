import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ExerciseCoachingBlock,
  ExerciseCoachingCompact,
} from "@/components/coach/ExerciseCoachingBlock";
import { EXERCISE_COACHING } from "@/data/exercise-coaching";

const [slug, coaching] = Object.entries(EXERCISE_COACHING)[0];

describe("ExerciseCoachingBlock", () => {
  it("shows the whole block where the movement is being learned", () => {
    render(<ExerciseCoachingBlock slug={slug} />);

    expect(screen.getByText(coaching.tempo)).toBeInTheDocument();
    expect(screen.getByText(coaching.breathing)).toBeInTheDocument();
    expect(screen.getByText(coaching.feelIt)).toBeInTheDocument();
    expect(screen.getByText(coaching.easier)).toBeInTheDocument();
    expect(screen.getByText(coaching.harder)).toBeInTheDocument();
    // Every mistake arrives with its fix.
    for (const m of coaching.mistakes) {
      expect(screen.getByText(m.error)).toBeInTheDocument();
      expect(screen.getByText(m.fix)).toBeInTheDocument();
    }
  });

  it("trims to the rhythm, the top cue and one mistake mid-workout", () => {
    render(<ExerciseCoachingCompact slug={slug} />);

    expect(screen.getByText(coaching.tempo)).toBeInTheDocument();
    expect(screen.getByText(coaching.cues[0])).toBeInTheDocument();
    expect(screen.getByText(coaching.mistakes[0].fix)).toBeInTheDocument();

    // The long-form fields stay in the library.
    expect(screen.queryByText(coaching.breathing)).not.toBeInTheDocument();
    expect(screen.queryByText(coaching.harder)).not.toBeInTheDocument();
  });

  it("renders nothing at all for the 229 exercises without coaching", () => {
    // Not an empty "Coaching" heading — nothing.
    const { container } = render(<ExerciseCoachingBlock slug="no-coaching-here" />);
    expect(container).toBeEmptyDOMElement();
    const compact = render(<ExerciseCoachingCompact slug={undefined} />);
    expect(compact.container).toBeEmptyDOMElement();
  });
});
