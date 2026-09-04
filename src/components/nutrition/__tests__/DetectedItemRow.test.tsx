import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DetectedItemRow from "@/components/nutrition/DetectedItemRow";
import type { ScanItem } from "@/lib/nutrition/scan-types";

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));

const item = (over: Partial<ScanItem> = {}): ScanItem => ({
  id: "i1",
  name: "grilled chicken breast",
  category: "protein",
  preparation: "grilled",
  grams: 150,
  grams_low: 100,
  grams_high: 200,
  count: null,
  is_liquid: false,
  identification_confidence: 0.9,
  portion_confidence: 0.6,
  needs_user_choice: false,
  selected_food_id: "f1",
  candidates: [
    { food_id: "f1", name: "Chicken breast, cooked", brand: null, similarity: 0.82, per_100g: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 } },
    { food_id: "f2", name: "Chicken thigh, cooked", brand: null, similarity: 0.61, per_100g: { kcal: 209, protein_g: 26, carbs_g: 0, fat_g: 11 } },
  ],
  preview: { kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
  ...over,
});

const noop = () => {};

describe("DetectedItemRow", () => {
  it("shows the chosen database food, the gram range and the preview from that record", () => {
    render(<DetectedItemRow item={item()} onGramsChange={noop} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    expect(screen.getByText("Chicken breast, cooked")).toBeInTheDocument();
    expect(screen.getByText(/≈ 150 g \(100–200 g\)/)).toBeInTheDocument();
    expect(screen.getByText(/248 kcal/)).toBeInTheDocument();
    expect(screen.queryByText("Estimated")).toBeNull();
  });

  it("labels mid confidence as Estimated and low confidence as Check this", () => {
    const { unmount } = render(<DetectedItemRow item={item({ identification_confidence: 0.6 })} onGramsChange={noop} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    unmount();
    render(<DetectedItemRow item={item({ identification_confidence: 0.3 })} onGramsChange={noop} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    expect(screen.getByText("Check this")).toBeInTheDocument();
  });

  it("opens the candidate list automatically when the match is ambiguous and reports the pick", () => {
    const onPick = vi.fn();
    render(<DetectedItemRow item={item({ needs_user_choice: true, selected_food_id: null, preview: null })} onGramsChange={noop} onPickCandidate={onPick} onReplace={noop} onRemove={noop} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Chicken thigh/ }));
    expect(onPick).toHaveBeenCalledWith("i1", "f2");
  });

  it("routes gram edits and quick picks through the callback, ignoring garbage", () => {
    const onGrams = vi.fn();
    render(<DetectedItemRow item={item()} onGramsChange={onGrams} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "200" }));
    expect(onGrams).toHaveBeenLastCalledWith("i1", 200);
    fireEvent.change(screen.getByLabelText(/Grams for/), { target: { value: "abc" } });
    expect(onGrams).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(/Grams for/), { target: { value: "120" } });
    expect(onGrams).toHaveBeenLastCalledWith("i1", 120);
  });

  it("offers search and remove, and says plainly when nothing matched", () => {
    const onReplace = vi.fn();
    const onRemove = vi.fn();
    render(<DetectedItemRow item={item({ candidates: [], selected_food_id: null, needs_user_choice: true, preview: null })} onGramsChange={noop} onPickCandidate={noop} onReplace={onReplace} onRemove={onRemove} />);
    expect(screen.getByText(/Not in the database yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Search instead/ }));
    expect(onReplace).toHaveBeenCalledWith("i1");
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalledWith("i1");
  });
});
