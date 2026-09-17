import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CoachProgramDetail from "@/pages/CoachProgramDetail";

/**
 * With no program the page is three doors, and today is the default: the
 * ember opens the day builder, the week and a week of your own sit under it.
 * A test account always has a program, so this state is held here.
 */

const create = vi.fn();
const access = vi.fn(() => ({ hasAccess: true }));
vi.mock("@/hooks/use-trial-access", () => ({ useTrialAccess: () => access() }));
vi.mock("@/hooks/use-coach-program", () => ({
  useCoachProgram: () => ({
    isLoading: false, program: null, logs: [], currentWeek: 1, todayDayIndex: 0, refetch: vi.fn(),
    weekState: { currentWeek: 1, weeksBehind: 0, readyForNext: false, sessionsDone: 0 },
  }),
}));
vi.mock("@/hooks/use-focus-session", () => ({ useCreateProgram: () => ({ mutate: create, isPending: false }) }));
vi.mock("@/components/coach/FocusSessionSheet", () => ({ default: () => <div>day builder</div> }));
vi.mock("@/components/coach/ProgramOnboarding", () => ({ default: () => <div>week wizard</div> }));
vi.mock("@/components/onboarding/onboarding-context", () => ({
  useOnboardingTrigger: () => {},
  useSpotlightTarget: () => ({ current: null }),
}));
vi.mock("@/lib/exercise-library", () => ({ loadExerciseLibrary: vi.fn() }));

const renderPage = () => render(<MemoryRouter><CoachProgramDetail /></MemoryRouter>);

describe("CoachProgramDetail with no program", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leads with today and offers the week and a week of your own", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Train today/ }));
    expect(screen.getByText("day builder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Build my own/ }));
    expect(create).toHaveBeenCalledWith({ kind: "manual" }, expect.anything());

    fireEvent.click(screen.getByRole("button", { name: /Build my week/ }));
    expect(screen.getByText("week wizard")).toBeInTheDocument();
  });

  it("shows only the paywall door without access", () => {
    access.mockReturnValueOnce({ hasAccess: false });
    renderPage();
    expect(screen.queryByRole("button", { name: /Train today/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Premium/ })).toBeInTheDocument();
  });
});
