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
  onOpenDiary: vi.fn(),
  onOpenTargets: vi.fn(),
  onLog: vi.fn(),
  onPhoto: vi.fn(),
};

describe("FuelZone", () => {
  it("shows consumed / target for kcal and protein and opens the diary from the row", () => {
    render(<FuelZone {...base} />);
    expect(screen.getByText(/^1\s240$/)).toBeInTheDocument(); // NBSP-grouped like the diary (the matcher normalises whitespace)
    expect(screen.getByText(/\/ 2400/)).toBeInTheDocument();
    expect(screen.getByText(/\/ 160/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open your food diary" }));
    expect(base.onOpenDiary).toHaveBeenCalled();
  });

  it("renders the four quiet states without changing structure", () => {
    const { rerender } = render(<FuelZone {...base} loading />);
    expect(screen.getByText("—")).toBeInTheDocument();
    rerender(<FuelZone {...base} state="no_targets" targets={null} totals={{ calories: 300, protein: 20, carbs: 30, fat: 10 }} />);
    expect(screen.getByText("Set targets")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set your nutrition targets" }));
    expect(base.onOpenTargets).toHaveBeenCalled();
    rerender(<FuelZone {...base} state="empty" totals={{ calories: 0, protein: 0, carbs: 0, fat: 0 }} />);
    expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument();
    rerender(<FuelZone {...base} state="complete" totals={{ calories: 2410, protein: 165, carbs: 250, fat: 80 }} />);
    expect(screen.getByText("Fueled.")).toBeInTheDocument();
    // The row's actions are always present so the cascade never shifts.
    expect(screen.getByRole("button", { name: "Log" })).toBeInTheDocument();
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
    expect(click).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("wf.scan_tip_seen")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Scan a meal photo" }));
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
});

describe("MacroBars", () => {
  it("renders meters against targets and plain figures without", () => {
    const { rerender } = render(<MacroBars consumed={{ calories: 0, protein: 92, carbs: 130, fat: 40 }} targets={{ calories: 2400, protein: 160, carbs: 260, fat: 80 }} />);
    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(3);
    expect(meters[0]).toHaveAttribute("aria-valuenow", "92");
    expect(meters[0]).toHaveAttribute("aria-valuemax", "160");
    rerender(<MacroBars consumed={{ calories: 0, protein: 92, carbs: 130, fat: 40 }} targets={null} />);
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.getByText("92")).toBeInTheDocument();
  });
});
