import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const recent = vi.fn();
const history = vi.fn();
vi.mock("@/hooks/use-workout-log", () => ({
  useRecentWorkoutLogs: () => ({ data: recent(), isLoading: false }),
  useExerciseHistory: () => ({ data: history(), isLoading: false }),
}));
vi.mock("@/lib/haptics", () => ({ hapticImpact: vi.fn(), hapticNotification: vi.fn(), hapticSelection: vi.fn() }));
vi.mock("@/lib/date", () => ({ localDateKey: () => "2026-10-01" }));

import { LiftsList } from "@/components/coach/LiftsList";

const top = (slug: string | null, name: string, logged_on: string, weight: number | null, reps: number | null) =>
  ({ id: `${slug}-${logged_on}`, program_id: null, week: null, day_index: null, exercise_slug: slug, exercise_name: name, weight, reps, rpe: 8, set_index: 1, logged_on });

beforeEach(() => {
  recent.mockReturnValue([
    top("Barbell_Squat", "Barbell Squat", "2026-09-29", 105, 5),
    top("Barbell_Squat", "Barbell Squat", "2026-09-22", 100, 5),
    top("Pullups", "Pull-up", "2026-09-30", null, 9),
    top(null, "Face pull", "2026-09-01", 20, 15),
  ]);
  history.mockReturnValue([
    top("Barbell_Squat", "Barbell Squat", "2026-09-29", 105, 5),
    { ...top("Barbell_Squat", "Barbell Squat", "2026-09-29", 105, 4), id: "s2", set_index: 2 },
    top("Barbell_Squat", "Barbell Squat", "2026-09-22", 100, 5),
  ]);
});

describe("LiftsList — every logged movement, most recent first", () => {
  it("lists the lifts with their last set, the days and the climb; a row without a slug cannot open", () => {
    render(<LiftsList />);
    const list = within(screen.getByLabelText("Lifts"));
    const rows = list.getAllByRole("button");
    // fmtKg joins with a no-break space; compare in plain spaces.
    expect(rows.map((r) => r.getAttribute("aria-label")?.replace(/\u00a0/g, " "))).toEqual([
      "Pull-up: 1 session, last 9 reps yesterday",
      "Barbell Squat: 2 sessions, last 105 kg × 5 2d ago, up 5 kg",
      "Face pull: 1 session, last 20 kg × 15 30d ago",
    ]);
    expect(rows[2]).toBeDisabled();
    expect(list.getByText("3 movements")).toBeInTheDocument();
  });

  it("a row opens the movement's full progression", () => {
    render(<LiftsList />);
    fireEvent.click(screen.getByRole("button", { name: /Barbell Squat:/ }));
    const sheet = screen.getByRole("dialog", { name: "Barbell Squat" });
    expect(sheet).toHaveTextContent("2 sessions · last 2d ago");
    expect(within(sheet).getByTestId("curve-weight")).toBeInTheDocument();
    expect(within(sheet).getByLabelText("Sets on Sep 29").textContent?.replace(/\u00a0/g, " ")).toContain("Set 1105 kg × 5");
  });

  it("says where the lifts will come from when nothing is logged", () => {
    recent.mockReturnValue([]);
    render(<LiftsList />);
    expect(screen.getByText("Lock your first sets")).toBeInTheDocument();
  });
});
