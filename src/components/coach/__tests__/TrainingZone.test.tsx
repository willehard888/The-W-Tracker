import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TrainingZone from "@/components/coach/TrainingZone";

/**
 * The home screen's training row is, for most members, the first time the
 * training program is mentioned anywhere they look. Each of its states has to
 * say something true and offer the right action — and crucially, a rest day
 * must NOT offer "Start", which would be asking for exactly the wrong thing.
 */

const mockProgram = vi.fn();
vi.mock("@/hooks/use-coach-program", () => ({
  useCoachProgram: () => mockProgram(),
}));

const day = (focus: string, blocks: number, duration = 45) => ({
  day: "Mon",
  focus,
  duration_min: duration,
  blocks: Array.from({ length: blocks }, () => ({})),
  conditioning: "",
});

const withProgram = (days: unknown[], logs: unknown[] = []) => ({
  isLoading: false,
  program: {
    id: "p1",
    goal: "hypertrophy",
    weeks: 4,
    plan_json: { weeks: [{ week: 1, theme: "Base", days }] },
  },
  logs,
  currentWeek: 1,
  todayDayIndex: 0,
});

const renderZone = () =>
  render(
    <MemoryRouter>
      <TrainingZone />
    </MemoryRouter>,
  );

describe("TrainingZone", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a skeleton while the program is loading, not the empty state", () => {
    // Rendering "No program yet" mid-fetch tells members who HAVE a program
    // that they do not.
    mockProgram.mockReturnValue({ isLoading: true, program: null, logs: [], currentWeek: 1, todayDayIndex: 0 });
    renderZone();
    expect(screen.queryByText("No program yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Build/ })).not.toBeInTheDocument();
  });

  it("invites a member with no program to build one", () => {
    mockProgram.mockReturnValue({ isLoading: false, program: null, logs: [], currentWeek: 1, todayDayIndex: 0 });
    renderZone();
    expect(screen.getByText("No program yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build" })).toBeInTheDocument();
  });

  it("names today's session and offers to start it", () => {
    mockProgram.mockReturnValue(withProgram([day("Upper Body A", 5, 52)]));
    renderZone();
    expect(screen.getByText("Upper Body A")).toBeInTheDocument();
    expect(screen.getByText("52 min · 5 exercises")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("does not offer Start on a rest day", () => {
    mockProgram.mockReturnValue(withProgram([day("Rest", 0, 0)]));
    renderZone();
    expect(screen.getByText("Rest day")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
  });

  it("does not offer Start once the session is logged", () => {
    mockProgram.mockReturnValue(
      withProgram([day("Upper Body A", 5)], [{ week: 1, day_index: 0, completed: true }]),
    );
    renderZone();
    expect(screen.getByText("Logged today")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
  });

  it("does not offer Start when the day has a name but no exercises", () => {
    // A truncated generation. Sending someone to the gym for an empty day is
    // worse than saying nothing.
    mockProgram.mockReturnValue(withProgram([day("Upper Body A", 0)]));
    renderZone();
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
  });

  it("stays legible when today's slot is missing from the plan", () => {
    mockProgram.mockReturnValue(withProgram([]));
    renderZone();
    expect(screen.getByText("Your week is ready")).toBeInTheDocument();
  });
});
