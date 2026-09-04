import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NutritionPhotoReview from "@/pages/nutrition/NutritionPhotoReview";
import type { ScanItem, ScanResponse } from "@/lib/nutrition/scan-types";

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-log-meal", () => ({ useLogMeal: () => ({ logMeal: vi.fn(), pending: false }) }));
vi.mock("@/hooks/use-food-search", () => ({ useFoodSearch: () => ({ results: [], localResults: [], isSearching: false, isFetching: false }) }));
vi.mock("@/hooks/use-food-favorites", () => ({ useFoodFavorites: () => ({ ids: new Set(), toggle: vi.fn(), isLoading: false }) }));
vi.mock("@/lib/nutrition/pending-photo", () => ({ takePendingPhoto: () => new File(["x"], "plate.jpg", { type: "image/jpeg" }) }));

const scanState = vi.hoisted(() => ({
  status: "idle" as string,
  result: null as ScanResponse | null,
  failure: null as { reason: string; retryable: boolean } | null,
  scan: vi.fn(),
  cancel: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("@/hooks/use-nutrition-scan", () => ({ useNutritionScan: () => scanState }));

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
  candidates: [{ food_id: "f1", name: "Chicken breast, cooked", brand: null, similarity: 0.82, per_100g: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 } }],
  preview: { kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
  ...over,
});
const response = (over: Partial<ScanResponse> = {}): ScanResponse => ({
  estimated: true,
  overall_confidence: 0.72,
  low_confidence: false,
  not_food: false,
  scene_notes: "",
  model: "test",
  cache_hit: false,
  latency_ms: 1,
  items: [item()],
  ...over,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/nutrition/photo?date=2026-09-04&slot=lunch"]}>
        <NutritionPhotoReview />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("NutritionPhotoReview", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:plate");
    URL.revokeObjectURL = vi.fn();
    scanState.status = "idle";
    scanState.result = null;
    scanState.failure = null;
  });

  it("offers a hint before scanning and sends it with the photo", () => {
    renderPage();
    const hint = screen.getByLabelText("Hint for the scanner");
    expect(hint).toBeInTheDocument();
    screen.getByRole("button", { name: "Scan this meal" }).click();
    expect(scanState.scan).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ hint: undefined }));
  });

  it("renders the review with every detected item and the confidence pill", () => {
    scanState.status = "done";
    scanState.result = response();
    renderPage();
    expect(screen.getByText("Estimated · 72 % confident")).toBeInTheDocument();
    expect(screen.getByText("Chicken breast, cooked")).toBeInTheDocument();
    expect(screen.getByText(/248 kcal/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to diary" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute("aria-pressed", "true");
  });

  it("disables saving while an item has no chosen food", () => {
    scanState.status = "done";
    scanState.result = response({ low_confidence: true, items: [item(), item({ id: "i2", name: "rice", selected_food_id: null, needs_user_choice: true, candidates: [], preview: null })] });
    renderPage();
    expect(screen.getByRole("button", { name: "Add to diary" })).toBeDisabled();
    expect(screen.getByText(/1 item needs a match/)).toBeInTheDocument();
    expect(screen.getByText(/Some of this is a guess/)).toBeInTheDocument();
  });

  it("says plainly when no food was found and invents nothing", () => {
    scanState.status = "done";
    scanState.result = response({ not_food: true, items: [] });
    renderPage();
    expect(screen.getByText("No food found in this photo.")).toBeInTheDocument();
    expect(screen.getByText("Nothing was invented.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to diary" })).toBeNull();
  });

  it("offers Try again only for retryable failures, and Log manually always", () => {
    scanState.status = "error";
    scanState.failure = { reason: "timeout", retryable: true };
    const { unmount } = renderPage();
    expect(screen.getByText("Couldn't read this meal.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log manually" })).toBeInTheDocument();
    unmount();
    scanState.failure = { reason: "scan_limit", retryable: false };
    renderPage();
    expect(screen.getByText("Daily scan limit reached")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Log manually" })).toBeInTheDocument();
  });
});
