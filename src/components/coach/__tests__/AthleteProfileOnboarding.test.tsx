import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AthleteProfileOnboarding, { EXPERIENCE } from "@/components/coach/AthleteProfileOnboarding";

/**
 * The experience question is the one answer the wizard may not guess: a null
 * reads as "experienced" downstream and puts a first-timer under a barbell.
 * The redesign changed every option into a row; the gate must still hold.
 */

vi.mock("@/hooks/use-athlete-profile", () => ({
  useAthleteProfile: () => ({ profile: null, upsert: vi.fn(), isSaving: false }),
}));

// The step transition is a 200 ms exit-then-enter; under a loaded suite jsdom
// takes seconds to play it. The gate is what is under test, not the slide.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
}));

describe("AthleteProfileOnboarding", () => {
  beforeEach(() => localStorage.clear());

  it("holds Next on the experience step until an answer is chosen", () => {
    render(<AthleteProfileOnboarding onDone={() => {}} />);

    expect(screen.getByText("1/6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(screen.getByRole("heading", { name: "Have you trained before?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();

    const first = screen.getByRole("button", { name: new RegExp(EXPERIENCE[0].label) });
    fireEvent.click(first);

    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();
    expect(JSON.parse(localStorage.getItem("w_coach_onboarding_draft_v2")!).training_experience).toBe("never_trained");
  });
});
