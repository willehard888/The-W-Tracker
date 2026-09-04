import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ServingPicker, { type PortionState } from "@/components/nutrition/ServingPicker";
import type { Food } from "@/lib/nutrition/types";

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));

const solid: Food = {
  id: "f1",
  name: "Chicken breast, cooked",
  source: "fineli",
  per100g: { kcal: 165, protein_g: 31 },
  servings: [{ id: "s1", unit: "piece", label: "1 fillet (150 g)", grams: 150 }],
};

const liquid: Food = {
  id: "f2",
  name: "Milk 1.5%",
  source: "fineli",
  per100g: { kcal: 46, protein_g: 3.4 },
  density_g_per_ml: 1.03,
  servings: [{ id: "s2", unit: "serving", label: "1 glass (2 dl)", grams: 206 }],
};

const base: PortionState = { qty: "100", unit: "g", servingId: null, customGrams: "" };

describe("ServingPicker", () => {
  it("offers only units the engine can resolve — no ml for a solid, ml for a liquid", () => {
    const { unmount } = render(<ServingPicker food={solid} value={base} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "ml" })).toBeNull();
    expect(screen.getByRole("button", { name: "1 fillet (150 g)" })).toBeInTheDocument();
    unmount();
    render(<ServingPicker food={liquid} value={base} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "ml" })).toBeInTheDocument();
  });

  it("resets the amount when switching unit families and keeps it within one", () => {
    const onChange = vi.fn();
    render(<ServingPicker food={liquid} value={{ ...base, qty: "250" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "ml" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ unit: "ml", qty: "250" }));
    fireEvent.click(screen.getByRole("button", { name: "1 glass (2 dl)" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ unit: "serving", servingId: "s2", qty: "1" }));
  });

  it("shows gram quick picks for mass units and fractional picks for servings", () => {
    const { unmount } = render(<ServingPicker food={solid} value={base} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /^150/ })).toBeInTheDocument();
    unmount();
    render(<ServingPicker food={solid} value={{ ...base, unit: "piece", servingId: "s1", qty: "1" }} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "½×" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute("aria-pressed", "true");
  });

  it("flags an unparseable amount instead of hiding the field", () => {
    render(<ServingPicker food={solid} value={{ ...base, qty: "abc" }} onChange={() => {}} />);
    expect(screen.getByLabelText("Amount")).toHaveAttribute("aria-invalid", "true");
  });

  it("reveals grams-per-unit only for the custom unit", () => {
    const { unmount } = render(<ServingPicker food={solid} value={base} onChange={() => {}} />);
    expect(screen.queryByLabelText("Grams per unit")).toBeNull();
    unmount();
    render(<ServingPicker food={solid} value={{ ...base, unit: "custom", qty: "2", customGrams: "40" }} onChange={() => {}} />);
    expect(screen.getByLabelText("Grams per unit")).toHaveValue("40");
  });
});
