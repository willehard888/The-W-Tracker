import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const review = vi.fn();
const navigate = vi.fn();
vi.mock("@/hooks/use-performance-snapshots", async () => {
  const real = await vi.importActual<typeof import("@/hooks/use-performance-snapshots")>("@/hooks/use-performance-snapshots");
  return {
    usePerformanceSnapshots: () => ({ data: [], isLoading: false }),
    useAutoWeeklyReview: () => ({ data: review() }),
    reviewQuestions: real.reviewQuestions,
  };
});
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({ data: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("framer-motion", () => ({ m: { div: (p: Record<string, unknown>) => <div {...(p as object)} /> } }));

import PerformanceOSDashboard, { reviewLifts } from "@/components/coach/PerformanceOSDashboard";

const base = {
  id: "r1", user_id: "u", week_starts_on: "2026-09-28", performance_score: 71, driver_of_week: "Sleep held at 7.6 h",
  wins: [], frictions: [], next_week_focus: "Keep the three sessions.", program_tweak: null, generated_with: "x", seen_at: null, created_at: "",
};

describe("weekly review — the week's lifts", () => {
  it("lists every lift with the rule's next load, marks a plate earned and a PR, and shows the verdict", () => {
    review.mockReturnValue({
      ...base,
      lifts: [
        { slug: "Barbell_Squat", name: "Barbell Squat", move: "up", weight: 102.5, reps: 6, step: 2.5, reason: "All 3 sets hit 10 at 100 kg — add 2.5 kg, back to 6.", last: { on: "2026-09-29", weight: 100, reps: 10 }, pr: true },
        { slug: "Bench_Press", name: "Bench Press", move: "hold", weight: 80, reps: 8, step: 0, reason: "1 of 3 sets hit 8 — same weight, finish the range.", last: null, pr: false },
      ],
      lifts_note: "Squat earned its plate; bench finishes the range first.",
    });
    render(<PerformanceOSDashboard />);
    const block = screen.getByLabelText("Lifts this week");
    expect(block).toHaveTextContent("1 plate earned");
    const rows = within(block).getAllByRole("listitem");
    expect(rows[0].textContent?.replace(/ /g, " ")).toContain("Barbell Squat · PR");
    expect(rows[0].textContent?.replace(/ /g, " ")).toContain("↑ 102.5 kg × 6 +2.5 kg");
    expect(rows[1].textContent?.replace(/ /g, " ")).toContain("80 kg × 8");
    expect(block).toHaveTextContent("Squat earned its plate; bench finishes the range first.");
  });

  it("renders nothing for a week without lifts, and tolerates a malformed column", () => {
    review.mockReturnValue({ ...base, lifts: [], lifts_note: null });
    render(<PerformanceOSDashboard />);
    expect(screen.queryByLabelText("Lifts this week")).not.toBeInTheDocument();
    expect(reviewLifts(null)).toEqual([]);
    expect(reviewLifts([{ nope: 1 }, { name: "x", move: "up" }])).toHaveLength(1);
  });

  it("renders the review's own questions as rows that open the chat with the question, and the button reads Refresh", () => {
    review.mockReturnValue({ ...base, lifts: [], lifts_note: null, suggested_questions: ["Why did my sleep hold at 7.6 h?", "What do three sessions look like next week?", 7] });
    render(<PerformanceOSDashboard />);
    const block = screen.getByLabelText("Ask about this week");
    const rows = within(block).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual(["Why did my sleep hold at 7.6 h?", "What do three sessions look like next week?"]);
    rows[0].click();
    expect(navigate).toHaveBeenCalledWith(`/coach?ask=${encodeURIComponent("Why did my sleep hold at 7.6 h?")}&src=review`);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
