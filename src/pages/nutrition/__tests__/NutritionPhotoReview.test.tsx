import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NutritionPhotoReview from "@/pages/nutrition/NutritionPhotoReview";
import type { ScanItem, ScanResponse } from "@/lib/nutrition/scan-types";

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: null, refreshProfile: vi.fn() }) }));
vi.mock("@/hooks/use-food-search", () => ({ useFoodSearch: () => ({ results: [], localResults: [], isSearching: false, isFetching: false }) }));
vi.mock("@/hooks/use-food-favorites", () => ({ useFoodFavorites: () => ({ ids: new Set(), toggle: vi.fn(), isLoading: false }) }));
vi.mock("@/lib/nutrition/pending-photo", () => ({ takePendingPhoto: () => new File(["x"], "plate.jpg", { type: "image/jpeg" }) }));

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const db = vi.hoisted(() => ({ storage: { from: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: db }));

const meals = vi.hoisted(() => ({ logMeal: vi.fn(async () => undefined), pending: false }));
vi.mock("@/hooks/use-log-meal", () => ({ useLogMeal: () => meals }));

const queries = vi.hoisted(() => ({
  fetchFood: vi.fn(async () => null),
  searchOnline: vi.fn(async () => ({ status: "miss", rows: [] })),
  lookupBarcode: vi.fn(async (): Promise<{ status: string; row: { id: string; name: string } | null }> => ({ status: "miss", row: null })),
  recordScanReview: vi.fn(async () => 1),
}));
vi.mock("@/lib/nutrition/queries", () => queries);

const scanState = vi.hoisted(() => ({
  status: "idle" as string,
  result: null as ScanResponse | null,
  failure: null as { reason: string; retryable: boolean } | null,
  scan: vi.fn(),
  cancel: vi.fn(),
  reset: vi.fn(),
  encoded: { current: null as File | null },
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
  ml: null,
  density_g_per_ml: null,
  unit_g: null,
  box: null,
  identification_confidence: 0.9,
  portion_confidence: 0.6,
  needs_user_choice: false,
  selected_food_id: "f1",
  candidates: [{ food_id: "f1", name: "Chicken breast, cooked", brand: null, similarity: 0.82, rank: 0.82, default_serving_grams: null, default_serving_label: null, per_100g: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 } }],
  online_lookup: "skipped",
  pass2: false,
  preview: { kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
  ...over,
});
const response = (over: Partial<ScanResponse> = {}): ScanResponse => ({
  estimated: true,
  scan_id: "s1",
  scene: "meal",
  scene_type: "meal",
  overall_confidence: 0.72,
  low_confidence: false,
  not_food: false,
  scene_notes: "",
  references_seen: [],
  scale_confidence: 0.5,
  barcode_seen: "",
  label: null,
  model: "test",
  cache_hit: false,
  latency_ms: 1,
  items: [item()],
  ...over,
});
const label = (over: Partial<NonNullable<ScanResponse["label"]>> = {}): NonNullable<ScanResponse["label"]> => ({
  product_name: "Ruisleipä",
  brand: "Fazer",
  per_basis: "100g",
  serving_g: 30,
  serving_label: "1 slice",
  values: { kcal: 250, protein_g: 8, carbs_g: 45, fat_g: 3 },
  kcal_mismatch: false,
  barcode_seen: "",
  read_confidence: 0.9,
  ...over,
});

const Probe = () => {
  const loc = useLocation();
  return <p>at {loc.pathname + loc.search}</p>;
};
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/nutrition/photo?date=2026-09-04&slot=lunch"]}>
        <Routes>
          <Route path="/nutrition/photo" element={<NutritionPhotoReview />} />
          <Route path="/nutrition/foods/new" element={<Probe />} />
          <Route path="/nutrition" element={<Probe />} />
        </Routes>
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
    scanState.encoded.current = null;
    scanState.scan.mockClear();
    meals.logMeal.mockClear();
    queries.recordScanReview.mockClear();
    queries.lookupBarcode.mockClear();
    db.storage.from.mockClear();
    toastMock.mockClear();
  });

  it("offers a hint before scanning and sends it with the slot and plate", () => {
    renderPage();
    const hint = screen.getByLabelText("Hint for the scanner");
    expect(hint).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Standard 26" })).toHaveAttribute("aria-pressed", "true");
    screen.getByRole("button", { name: "Scan this meal" }).click();
    expect(scanState.scan).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ hint: undefined, slot: "lunch", plateCm: 26, sidePhoto: undefined }));
  });

  it("passes a side photo and the chosen plate size to the scan", () => {
    renderPage();
    const side = new File(["y"], "side.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/Add a side photo/), { target: { files: [side] } });
    expect(screen.getByAltText("Side photo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Large 30" }));
    screen.getByRole("button", { name: "Scan this meal" }).click();
    expect(scanState.scan).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ sidePhoto: side, plateCm: 30 }));
  });

  it("renders the review with every detected item, the confidence pill and the scene note", () => {
    scanState.status = "done";
    scanState.result = response({ scene_notes: "Fork used as reference." });
    renderPage();
    expect(screen.getByText("Estimated · 72 % confident")).toBeInTheDocument();
    expect(screen.getByText("Chicken breast, cooked")).toBeInTheDocument();
    expect(screen.getByText("Fork used as reference.")).toBeInTheDocument();
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

  it("records what the user changed after the meal is saved", async () => {
    scanState.status = "done";
    scanState.result = response({ items: [item(), item({ id: "i2", name: "rice", selected_food_id: "f2", candidates: [{ ...item().candidates[0], food_id: "f2", name: "Rice, boiled" }] })] });
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /^Remove/ })[1]);
    fireEvent.click(screen.getByRole("button", { name: "200" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to diary" }));
    await waitFor(() => expect(meals.logMeal).toHaveBeenCalled());
    expect(meals.logMeal).toHaveBeenCalledWith(expect.objectContaining({ source: "scan", photoPath: null }));
    await waitFor(() => expect(queries.recordScanReview).toHaveBeenCalledWith(db, "s1", [
      expect.objectContaining({ item_index: 0, action: "grams_edited", model_grams: 150, final_grams: 200 }),
      expect.objectContaining({ item_index: 1, action: "removed" }),
    ]));
    expect(await screen.findByText("at /nutrition?date=2026-09-04")).toBeInTheDocument();
  });

  it("skips the photo upload when the encoded image is not a JPEG, and still saves the meal", async () => {
    scanState.status = "done";
    scanState.result = response();
    scanState.encoded.current = new File(["p"], "plate.png", { type: "image/png" });
    renderPage();
    fireEvent.click(screen.getByRole("switch", { name: "Keep the photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to diary" }));
    await waitFor(() => expect(meals.logMeal).toHaveBeenCalledWith(expect.objectContaining({ photoPath: null })));
    expect(db.storage.from).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith("Photo not saved", expect.anything());
  });

  it("says plainly when no food was found and invents nothing", () => {
    scanState.status = "done";
    scanState.result = response({ not_food: true, items: [] });
    renderPage();
    expect(screen.getByText("No food found in this photo.")).toBeInTheDocument();
    expect(screen.getByText("Nothing was invented.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to diary" })).toBeNull();
  });

  it("shows a label read as-is, saves nothing, and hands it to the food editor", async () => {
    scanState.status = "done";
    scanState.result = response({ scene: "label", scene_type: "nutrition_label", label: label(), items: [], overall_confidence: 0, low_confidence: true });
    renderPage();
    expect(screen.getByText("Read from the label — nothing saved yet.")).toBeInTheDocument();
    expect(screen.getByText("Ruisleipä · Fazer")).toBeInTheDocument();
    expect(screen.getByText("Per 100 g")).toBeInTheDocument();
    expect(screen.getByText("250 kcal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to diary" })).toBeNull();
    expect(queries.lookupBarcode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Check and save as my food" }));
    const at = await screen.findByText(/^at \/nutrition\/foods\/new/);
    const q = new URLSearchParams(at.textContent!.replace(/^at \/nutrition\/foods\/new\?/, ""));
    expect(Object.fromEntries(q)).toMatchObject({ date: "2026-09-04", slot: "lunch", from: "label", name: "Ruisleipä", brand: "Fazer", kcal: "250", protein_g: "8", carbs_g: "45", fat_g: "3", serving_g: "30", serving_label: "1 slice" });
    expect(q.has("sugar_g")).toBe(false);
  });

  it("looks a seen barcode up first and opens the diary on a catalog hit", async () => {
    queries.lookupBarcode.mockResolvedValueOnce({ status: "hit", row: { id: "f9", name: "Ruisleipä" } });
    scanState.status = "done";
    scanState.result = response({ scene: "label", label: label({ barcode_seen: "6410405123457" }), barcode_seen: "6410405123457", items: [] });
    renderPage();
    expect(queries.lookupBarcode).toHaveBeenCalledWith(db, expect.objectContaining({ code: "6410405123457" }));
    expect(await screen.findByText("at /nutrition?date=2026-09-04&slot=lunch&add=f9")).toBeInTheDocument();
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
