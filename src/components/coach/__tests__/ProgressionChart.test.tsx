import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const hapticSelection = vi.fn();
vi.mock("@/lib/haptics", () => ({ hapticSelection: () => hapticSelection(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));

import { ProgressionChart } from "@/components/coach/ProgressionChart";
import { sessionsFor } from "@/lib/training/progression";

const row = (logged_on: string, set_index: number, weight: number | null, reps: number | null) => ({ logged_on, set_index, weight, reps, rpe: 8 });
const points = sessionsFor([
  row("2026-09-01", 1, 100, 5), row("2026-09-01", 2, 100, 5),
  row("2026-09-08", 1, 102.5, 5), row("2026-09-08", 2, 102.5, 4),
  row("2026-09-15", 1, 105, 5), row("2026-09-15", 2, 105, 5), row("2026-09-15", 3, 105, 4),
  row("2026-09-29", 1, 100, 8), row("2026-09-29", 2, 100, 8),
]);
const TODAY = "2026-09-30";

// jsdom has no layout and no PointerEvent: without the class, fireEvent falls
// back to a plain Event and clientX is lost (every scrub lands on point 0).
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; }
}
beforeEach(() => {
  hapticSelection.mockReset();
  (window as unknown as { PointerEvent: typeof FakePointerEvent }).PointerEvent = FakePointerEvent;
  (SVGElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
});

describe("ProgressionChart — the movement's weight curve and session results", () => {
  it("shows the all-time tiles, both curves, PR rings and the latest session by default", () => {
    render(<ProgressionChart points={points} name="Barbell Squat" today={TODAY} />);
    const tiles = screen.getByLabelText("Barbell Squat all time");
    expect(within(tiles).getByText("4")).toBeInTheDocument(); // sessions
    expect(within(tiles).getByText("9")).toBeInTheDocument(); // sets
    expect(within(tiles).getByText("105 kg")).toBeInTheDocument(); // best
    expect(within(tiles).getByText("1 d")).toBeInTheDocument(); // last
    expect(screen.getByTestId("curve-weight")).toBeInTheDocument();
    expect(screen.getByTestId("curve-reps")).toBeInTheDocument();
    expect(within(screen.getByTestId("curve-weight")).getAllByTestId("pr-point")).toHaveLength(2); // 102.5 and 105
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText(/Top 100 kg × 8 · 2 sets · 1 600 kg/)).toBeInTheDocument();
    expect(screen.getByLabelText("Sets on Yesterday")).toHaveTextContent("Set 1100 kg × 8 · RPE 8Set 2100 kg × 8 · RPE 8");
    expect(screen.getByTestId("curve-weight")).toHaveAttribute("aria-label", expect.stringContaining("4 sessions, 100 to 100 kg"));
  });

  it("a finger across the chart selects the nearest session; the readout and the set list follow", () => {
    render(<ProgressionChart points={points} name="Barbell Squat" today={TODAY} />);
    const svg = screen.getByTestId("curve-weight");
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 160, right: 320, bottom: 160, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(svg, { clientX: 30, pointerId: 1 });
    // "Sep 1" is also the x-axis label; the readout is the bold day line.
    expect(screen.getByText("Sep 1", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sets on Sep 1")).toHaveTextContent("Set 1100 kg × 5");
    expect(hapticSelection).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(svg, { clientX: 30, pointerId: 1 });
    expect(hapticSelection).toHaveBeenCalledTimes(1); // same session, no second tick
    fireEvent.pointerMove(svg, { clientX: 300, pointerId: 1 });
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 30, pointerId: 1 });
    expect(screen.getByText("Yesterday")).toBeInTheDocument(); // not scrubbing after release
  });

  it("the range row windows the curve and says so when a range holds one session", () => {
    render(<ProgressionChart points={points} name="Barbell Squat" today={TODAY} />);
    fireEvent.click(screen.getByRole("tab", { name: "4 wk" }));
    expect(screen.getByText(/3 sessions in range/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "4 wk" })).toHaveAttribute("aria-selected", "true");
    const narrow = sessionsFor([row("2026-05-01", 1, 100, 5), row("2026-09-29", 1, 110, 5)]);
    render(<ProgressionChart points={narrow} name="Deadlift" today={TODAY} />);
    fireEvent.click(screen.getAllByRole("tab", { name: "10 wk" })[1]);
    expect(screen.getByText("No second session in this range")).toBeInTheDocument();
  });

  it("one session: tiles and sets, no curve, the empty line", () => {
    render(<ProgressionChart points={points.slice(0, 1)} name="Barbell Squat" today={TODAY} />);
    expect(screen.queryByTestId("curve-weight")).not.toBeInTheDocument();
    expect(screen.getByText("Lock one more session to see the curve")).toBeInTheDocument();
    expect(screen.getByLabelText("Sets on Sep 1")).toBeInTheDocument();
  });

  it("a bodyweight movement charts reps and names the best in reps", () => {
    const bw = sessionsFor([row("2026-09-01", 1, null, 6), row("2026-09-08", 1, null, 8), row("2026-09-15", 1, null, 9)]);
    render(<ProgressionChart points={bw} name="Pull-up" today={TODAY} />);
    expect(screen.getByTestId("curve-reps")).toBeInTheDocument();
    expect(screen.queryByTestId("curve-weight")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Pull-up all time")).getByText("9 reps")).toBeInTheDocument();
    expect(screen.getByText("best reps")).toBeInTheDocument();
  });

  it("renders nothing without sessions", () => {
    const { container } = render(<ProgressionChart points={[]} name="x" today={TODAY} />);
    expect(container).toBeEmptyDOMElement();
  });
});
