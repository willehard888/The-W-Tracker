import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FuelZone, { type FuelZoneProps } from "@/components/nutrition/FuelZone";
import MacroBars from "@/components/nutrition/MacroBars";

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("@/components/AnimatedNumber", () => ({ default: ({ value, format }: { value: number; format?: (n: number) => string }) => <span>{format ? format(value) : value}</span> }));

const base: FuelZoneProps = {
  loading: false,
  totals: { calories: 1240, protein: 92, carbs: 130, fat: 40 },
  targets: { calories: 2400, protein: 160, carbs: 260, fat: 80 },
  state: "in_progress",
  mealCount: 2,
  onOpenDiary: vi.fn(),
  onOpenTargets: vi.fn(),
  onLog: vi.fn(),
  onPhoto: vi.fn(),
};

describe("FuelZone", () => {
  it("leads with what is left, and shows the macros behind it", () => {
    render(<FuelZone {...base} />);
    expect(screen.getByText(/^1\s160$/)).toBeInTheDocument(); // 2400 − 1240, NBSP-grouped
    expect(screen.getByText("kcal left")).toBeInTheDocument();
    expect(screen.getByText("2 meals")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: /1\s240 of 2\s400 kcal/ })).toBeInTheDocument();
    expect(screen.getByText(/Protein/)).toBeInTheDocument();
  });

  it("sends the tap where the day's next act is", () => {
    const { rerender } = render(<FuelZone {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Open your food diary" }));
    expect(base.onOpenDiary).toHaveBeenCalled();

    rerender(<FuelZone {...base} state="empty" totals={{ calories: 0, protein: 0, carbs: 0, fat: 0 }} mealCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Log your first meal today" }));
    expect(base.onLog).toHaveBeenCalled();

    rerender(<FuelZone {...base} state="no_targets" targets={null} totals={{ calories: 300, protein: 20, carbs: 30, fat: 10 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Set your nutrition targets" }));
    expect(base.onOpenTargets).toHaveBeenCalled();
  });

  it("renders every state without inventing a number it does not have", () => {
    const { rerender } = render(<FuelZone {...base} loading />);
    expect(screen.getByText("—")).toBeInTheDocument();

    // No targets: no remaining number, no rail — a bar against nothing is a lie.
    rerender(<FuelZone {...base} state="no_targets" targets={null} totals={{ calories: 300, protein: 20, carbs: 30, fat: 10 }} />);
    expect(screen.getByText("Set your targets.")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();

    rerender(<FuelZone {...base} state="empty" totals={{ calories: 0, protein: 0, carbs: 0, fat: 0 }} mealCount={0} />);
    expect(screen.getByText(/^2\s400$/)).toBeInTheDocument();
    expect(screen.getByText("Nothing logged yet.")).toBeInTheDocument();

    rerender(<FuelZone {...base} state="complete" totals={{ calories: 2410, protein: 165, carbs: 250, fat: 80 }} />);
    expect(screen.getByText("Fueled.")).toBeInTheDocument();

    // Over target says so, instead of the old silence.
    rerender(<FuelZone {...base} state="over" totals={{ calories: 2600, protein: 170, carbs: 280, fat: 90 }} />);
    expect(screen.getByText("kcal over")).toBeInTheDocument();

    // The camera is the one visible control in every state.
    expect(screen.getByRole("button", { name: "Scan a meal photo" })).toBeInTheDocument();
  });

  it("renders nothing when the day is unavailable", () => {
    const { container } = render(<FuelZone {...base} unavailable />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hands a picked photo to the caller and clears the input", () => {
    render(<FuelZone {...base} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "plate.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(base.onPhoto).toHaveBeenCalledWith(file);
  });

  it("shows the framing tip once before the first scan, then opens the picker straight away", () => {
    localStorage.removeItem("wf.scan_tip_seen");
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<FuelZone {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Scan a meal photo" }));
    expect(screen.getByText(/Put a fork or your hand next to the plate/)).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(click).toHaveBeenCalled();
    expect(localStorage.getItem("wf.scan_tip_seen")).toBe("1");
    click.mockRestore();
  });
});

describe("MacroBars", () => {
  it("meters each macro against its target", () => {
    render(<MacroBars consumed={{ calories: 1240, protein: 92, carbs: 130, fat: 40 }} targets={{ calories: 2400, protein: 160, carbs: 260, fat: 80 }} />);
    expect(screen.getByRole("meter", { name: /Protein 92 of 160 grams/ })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: /Carbs 130 of 260 grams/ })).toBeInTheDocument();
  });

  it("omits the bars when there is nothing to measure against", () => {
    render(<MacroBars consumed={{ calories: 300, protein: 20, carbs: 30, fat: 10 }} targets={null} />);
    expect(screen.queryByRole("meter")).toBeNull();
  });
});
