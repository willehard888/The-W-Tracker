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
  ml: null,
  density_g_per_ml: null,
  unit_g: null,
  box: null,
  identification_confidence: 0.9,
  portion_confidence: 0.6,
  needs_user_choice: false,
  selected_food_id: "f1",
  candidates: [
    { food_id: "f1", name: "Chicken breast, cooked", brand: null, similarity: 0.82, rank: 0.82, default_serving_grams: null, default_serving_label: null, per_100g: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 } },
    { food_id: "f2", name: "Chicken thigh, cooked", brand: null, similarity: 0.61, rank: 0.61, default_serving_grams: null, default_serving_label: null, per_100g: { kcal: 209, protein_g: 26, carbs_g: 0, fat_g: 11 } },
  ],
  online_lookup: "skipped",
  pass2: false,
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

  it("opens the candidate list automatically when the match is ambiguous, shows the match %, and reports the pick", () => {
    const onPick = vi.fn();
    render(<DetectedItemRow item={item({ needs_user_choice: true, selected_food_id: null, preview: null })} onGramsChange={noop} onPickCandidate={onPick} onReplace={noop} onRemove={noop} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByText("82 % match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Chicken thigh/ }));
    expect(onPick).toHaveBeenCalledWith("i1", "f2");
  });

  it("offers chips from the range and the default serving, and routes edits through the callback, ignoring garbage", () => {
    const onGrams = vi.fn();
    const withServing = item({ candidates: [{ ...item().candidates[0], default_serving_grams: 120 }, item().candidates[1]] });
    render(<DetectedItemRow item={withServing} onGramsChange={onGrams} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    expect(screen.getAllByRole("button", { pressed: false }).map((b) => b.textContent)).toEqual(expect.arrayContaining(["100", "120", "200"]));
    expect(screen.getByRole("button", { name: "150" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "200" }));
    expect(onGrams).toHaveBeenLastCalledWith("i1", 200);
    fireEvent.change(screen.getByLabelText(/Grams for/), { target: { value: "abc" } });
    expect(onGrams).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(/Grams for/), { target: { value: "120" } });
    expect(onGrams).toHaveBeenLastCalledWith("i1", 120);
  });

  it("edits liquids in millilitres and derives grams through the density", () => {
    const onGrams = vi.fn();
    render(<DetectedItemRow item={item({ name: "milk", ml: 200, density_g_per_ml: 1.03, grams: 206, grams_low: 155, grams_high: 258 })} onGramsChange={onGrams} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    expect(screen.getByLabelText(/Millilitres for/)).toHaveValue("200");
    expect(screen.getByText("ml")).toBeInTheDocument();
    expect(screen.getByText(/≈ 200 ml \(150–250 ml\)/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quick millilitres" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Millilitres for/), { target: { value: "250" } });
    expect(onGrams).toHaveBeenLastCalledWith("i1", 258);
    fireEvent.click(screen.getByRole("button", { name: "150" }));
    expect(onGrams).toHaveBeenLastCalledWith("i1", 155);
  });

  it("steps countable items in pieces and re-derives grams from the piece weight", () => {
    const onGrams = vi.fn();
    const onCount = vi.fn();
    render(<DetectedItemRow item={item({ name: "eggs", count: 3, unit_g: 55, grams: 165 })} onGramsChange={onGrams} onCountChange={onCount} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    expect(screen.getByText("3 pcs")).toBeInTheDocument();
    expect(screen.getByText(/55 g each/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "One piece more" }));
    expect(onCount).toHaveBeenCalledWith("i1", 4);
    expect(onGrams).toHaveBeenCalledWith("i1", 220);
    fireEvent.click(screen.getByRole("button", { name: "One piece fewer" }));
    expect(onCount).toHaveBeenLastCalledWith("i1", 2);
    expect(onGrams).toHaveBeenLastCalledWith("i1", 110);
  });

  it("offers search and remove, and says plainly when nothing matched — online or not", () => {
    const onReplace = vi.fn();
    const onRemove = vi.fn();
    const { unmount } = render(<DetectedItemRow item={item({ candidates: [], selected_food_id: null, needs_user_choice: true, preview: null })} onGramsChange={noop} onPickCandidate={noop} onReplace={onReplace} onRemove={onRemove} />);
    expect(screen.getByText(/Not in the database yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Search instead/ }));
    expect(onReplace).toHaveBeenCalledWith("i1");
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalledWith("i1");
    unmount();
    render(<DetectedItemRow item={item({ candidates: [], selected_food_id: null, needs_user_choice: true, preview: null, online_lookup: "miss" })} onGramsChange={noop} onPickCandidate={noop} onReplace={noop} onRemove={noop} />);
    expect(screen.getByText(/Not found online either/)).toBeInTheDocument();
  });
});
