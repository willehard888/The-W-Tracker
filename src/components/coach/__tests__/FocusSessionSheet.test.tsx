import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";

/**
 * A built day is a list of names, and a beginner does not know the names.
 * Each row opens the movement full size (the demonstration, the steps, the
 * cues) and the swap stays its own control beside it — two sibling buttons,
 * never one inside the other.
 */
const build = vi.fn();
const swap = vi.fn();
vi.mock("@/hooks/use-focus-session", () => ({
  sessionMinutes: () => 45,
  useBuildFocusSession: () => ({ mutateAsync: build }),
  useSwapExercise: () => ({ mutateAsync: swap }),
  useMuscleBalance: () => [],
}));
vi.mock("@/hooks/use-athlete-profile", () => ({ useAthleteProfile: () => ({ profile: null }) }));
vi.mock("@/hooks/use-workout-log", () => ({ useRecentWorkoutLogs: () => ({ data: [{ exercise_slug: "Barbell_Deadlift", weight: 100, reps: 6, logged_on: "2026-09-29" }] }) }));
vi.mock("@/lib/haptics", () => ({ hapticImpact: vi.fn(), hapticNotification: vi.fn(), hapticSelection: vi.fn() }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), track: vi.fn() }));
vi.mock("@/components/ui/sheet-bottom", () => ({
  BottomSheet: ({ open, title, subtitle, children }: { open: boolean; title: string; subtitle?: string; children: React.ReactNode }) =>
    open ? <section aria-label={title}><h2>{title}</h2><p>{subtitle}</p>{children}</section> : null,
}));

import FocusSessionSheet from "@/components/coach/FocusSessionSheet";

const drawn = ILLUSTRATED_EXERCISES.find((e) => /deadlift/i.test(e.title)) ?? ILLUSTRATED_EXERCISES[0];
const day = {
  focus: "Back & Biceps", duration_min: 45,
  blocks: [
    { slug: "Barbell_Deadlift", name: drawn.title, sets: 5, reps: "8-10", rpe: 8, rest_sec: 90 },
    { slug: "Pullups", name: "Pullups", sets: 5, reps: "10-12", rpe: 8, rest_sec: 60 },
  ],
};

beforeEach(() => {
  build.mockReset().mockResolvedValue({ day, dayIndex: 0 });
  swap.mockReset().mockResolvedValue({ block: { slug: "Romanian_Deadlift", name: "Romanian Deadlift", sets: 5, reps: "8-10", rpe: 8, rest_sec: 90 }, dayIndex: 0 });
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => {});
});

const buildIt = async () => {
  render(<MemoryRouter><FocusSessionSheet open onClose={() => {}} title="Build this day" /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.click(screen.getByRole("button", { name: "Build my session" }));
  await screen.findByText(drawn.title);
};

describe("FocusSessionSheet — the built rows", () => {
  it("teaches the tap in the subtitle, and each row is a 44 pt button beside its own swap button", async () => {
    await buildIt();
    expect(screen.getByText("Tap any movement to see how it's done.")).toBeInTheDocument();
    const see = screen.getByRole("button", { name: `See ${drawn.title}` });
    const swapBtn = screen.getByRole("button", { name: `Swap ${drawn.title}` });
    expect(see.className.split(" ")).toEqual(expect.arrayContaining(["press-row", "min-h-11"]));
    expect(see.querySelector("button")).toBeNull();
    expect(see.parentElement).toBe(swapBtn.parentElement);
    expect(see).toHaveTextContent("Last 100 kg × 6");
  });

  it("opens the movement full size from the row, with the steps and its own swap", async () => {
    await buildIt();
    fireEvent.click(screen.getByRole("button", { name: `See ${drawn.title}` }));
    const sheet = await screen.findByLabelText(drawn.title, {}, { timeout: 4000 });
    expect(within(sheet).getByText("How to perform")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /^Swap/ }));
    await waitFor(() => expect(swap).toHaveBeenCalledWith(expect.objectContaining({ slug: "Barbell_Deadlift" })));
    expect(await screen.findByText("Romanian Deadlift")).toBeInTheDocument();
  });
});
