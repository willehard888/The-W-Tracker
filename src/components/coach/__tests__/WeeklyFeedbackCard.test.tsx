import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const review = vi.fn();
const navigate = vi.fn();
vi.mock("@/hooks/use-performance-snapshots", async () => {
  const real = await vi.importActual<typeof import("@/hooks/use-performance-snapshots")>("@/hooks/use-performance-snapshots");
  return { useAutoWeeklyReview: () => ({ data: review() }), reviewQuestions: real.reviewQuestions, weekStartsOnKey: real.weekStartsOnKey };
});
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

import WeeklyFeedbackCard from "@/components/coach/WeeklyFeedbackCard";
import { weekStartsOnKey } from "@/hooks/use-performance-snapshots";

const row = {
  id: "r1", user_id: "u", week_starts_on: weekStartsOnKey(), performance_score: 71, driver_of_week: "Sleep held at 7.6 h",
  wins: [], frictions: [], next_week_focus: "Keep the three sessions.", program_tweak: null, generated_with: "x", seen_at: null, created_at: "",
  lifts: [], lifts_note: "Squat earned its plate.", suggested_questions: ["Why did my sleep hold at 7.6 h?", "Is 2.5 kg on the squat safe this week?"],
};

/** The weekday the card is rendered on: Monday = 0. */
const onWeekday = (weekday: number) => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekday);
  d.setHours(12, 0, 0, 0);
  vi.useFakeTimers({ now: d, toFake: ["Date"] });
};
afterEach(() => vi.useRealTimers());

describe("WeeklyFeedbackCard", () => {
  it("on Monday to Wednesday shows this week's verdict, its questions as rows and the door to the review", () => {
    onWeekday(1);
    review.mockReturnValue({ ...row, week_starts_on: weekStartsOnKey() });
    const onAsk = vi.fn();
    render(<WeeklyFeedbackCard onAsk={onAsk} />);
    const card = screen.getByLabelText("Week in review");
    expect(card).toHaveTextContent("Sleep held at 7.6 h");
    expect(card).toHaveTextContent("Squat earned its plate.");
    const rows = within(screen.getByLabelText("Ask about this week")).getAllByRole("button");
    expect(rows).toHaveLength(2);
    rows[1].click();
    expect(onAsk).toHaveBeenCalledWith("Is 2.5 kg on the squat safe this week?", 1);
    screen.getByRole("button", { name: "Open review" }).click();
    expect(navigate).toHaveBeenCalledWith("/coach/progress");
  });

  it("stays away from Thursday on, and for a review of an older week", () => {
    onWeekday(3);
    review.mockReturnValue({ ...row, week_starts_on: weekStartsOnKey() });
    const { unmount } = render(<WeeklyFeedbackCard onAsk={vi.fn()} />);
    expect(screen.queryByLabelText("Week in review")).toBeNull();
    unmount();
    onWeekday(0);
    review.mockReturnValue({ ...row, week_starts_on: "2020-01-06" });
    render(<WeeklyFeedbackCard onAsk={vi.fn()} />);
    expect(screen.queryByLabelText("Week in review")).toBeNull();
  });
});
