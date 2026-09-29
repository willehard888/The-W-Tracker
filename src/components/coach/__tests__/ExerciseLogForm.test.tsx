import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mutateAsync = vi.fn();
const daySets = vi.fn();
const history = vi.fn();
vi.mock("@/hooks/use-workout-log", () => ({
  useDaySets: () => ({ data: daySets() }),
  useExerciseHistory: () => ({ data: history() }),
  useLogSet: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/lib/haptics", () => ({ hapticImpact: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-commit-pop", () => ({ useCommitPop: () => false }));

import { ExerciseLogForm } from "@/components/coach/ExerciseLogForm";

const block = { slug: "Barbell_Squat", name: "Barbell Squat", sets: 4, reps: "5-8", rpe: 8, rest_sec: 150 };
const row = (set_index: number, weight: number, reps: number, over: Record<string, unknown> = {}) => ({
  id: `r${set_index}`, program_id: "p", week: 1, day_index: 0, exercise_slug: "Barbell_Squat", exercise_name: "Barbell Squat",
  weight, reps, rpe: 8, set_index, logged_on: "2026-09-29", ...over,
});

beforeEach(() => { mutateAsync.mockReset().mockResolvedValue({}); daySets.mockReturnValue({}); history.mockReturnValue([]); });

describe("Lock your sets — the program page logs per set", () => {
  it("renders one row per prescribed set and locks set 1 with its index", async () => {
    render(<ExerciseLogForm block={block} programId="p" week={1} dayIndex={0} />);
    expect(screen.getByText("Lock your sets")).toBeInTheDocument();
    expect(screen.getByText("4 sets of 5–8 reps, leaving about 2 reps in reserve. Rest 2:30 between sets.")).toBeInTheDocument();
    // Only the set on stage is open; the rest are numbers.
    expect(screen.getByLabelText("Set 1 weight in kilograms")).toBeInTheDocument();
    expect(screen.queryByLabelText("Set 2 weight in kilograms")).toBeNull();
    fireEvent.change(screen.getByLabelText("Set 1 weight in kilograms"), { target: { value: "130" } });
    fireEvent.change(screen.getByLabelText("Set 1 reps"), { target: { value: "6" } });
    fireEvent.click(screen.getByText("Lock"));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ setIndex: 1, weight: 130, reps: 6, rpe: 8, slug: "Barbell_Squat" }));
  });

  it("puts set 2 on stage once set 1 is locked, and counts what is locked", () => {
    daySets.mockReturnValue({ Barbell_Squat: [row(1, 130, 6)] });
    render(<ExerciseLogForm block={block} programId="p" week={1} dayIndex={0} />);
    expect(screen.getByText("· 1/4")).toBeInTheDocument();
    expect(screen.getByLabelText("Set 2 weight in kilograms")).toBeInTheDocument();
    // Set 2 is seeded from set 1 today — straight sets are the default.
    expect((screen.getByLabelText("Set 2 weight in kilograms") as HTMLInputElement).value).toBe("130");
  });

  it("the quick-fill puts last time's weight on every open set, and felt RPE rides every lock", async () => {
    history.mockReturnValue([row(1, 120, 8, { week: 0, logged_on: "2026-09-22" })]);
    render(<ExerciseLogForm block={block} programId="p" week={1} dayIndex={0} />);
    expect(screen.getByText(/Last: 120 kg × 8/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("+2.5 kg"));
    expect((screen.getByLabelText("Set 1 weight in kilograms") as HTMLInputElement).value).toBe("122.5");
    fireEvent.change(screen.getByLabelText("Felt RPE, 1 to 10"), { target: { value: "9" } });
    fireEvent.click(screen.getByText("Lock"));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ setIndex: 1, weight: 122.5, reps: 8, rpe: 9 })));
  });
});
