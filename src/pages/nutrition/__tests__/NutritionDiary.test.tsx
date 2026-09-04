import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NutritionDiary from "@/pages/nutrition/NutritionDiary";
import type { DailyTotalsDay, MealLogItemRow, MealLogRow, NutritionTargetsRow } from "@/lib/nutrition/api-types";

/**
 * The diary composes tested hooks and panels; these tests pin what only the
 * page decides: which line opens the day, that every slot is a section, that
 * a row shows the snapshot (not a recomputation), that "+ Add" opens the
 * sheet, and that a barcode miss says so instead of inventing a food.
 */

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: null }) }));

const fx = vi.hoisted(() => ({
  day: { meals: [] as unknown[], items: [] as unknown[], itemsByMeal: new Map<string, unknown[]>(), pendingIds: new Set<string>(), isLoading: false, error: null, refetch: vi.fn() },
  totals: { day: null as unknown, isLoading: false, error: null },
  targets: { targets: null as unknown, isLoading: false, error: null, save: vi.fn(), saving: false },
  scan: vi.fn(),
  lookupBarcode: vi.fn(),
  logMeal: vi.fn(),
}));

vi.mock("@/hooks/use-nutrition-day", () => ({
  dayKey: (date: string, uid?: string) => ["nutrition-day", date, uid],
  useNutritionDay: () => fx.day,
}));
vi.mock("@/hooks/use-nutrition-totals", () => ({ useNutritionTotals: () => fx.totals }));
vi.mock("@/hooks/use-nutrition-targets", () => ({ useNutritionTargets: () => fx.targets }));
vi.mock("@/hooks/use-nutrient-definitions", () => ({ useNutrientDefinitions: () => ({ defs: [], byKey: new Map(), isLoading: false, error: null }) }));
vi.mock("@/hooks/use-food-search", () => ({
  useFoodSearch: () => ({ results: [], isFetching: false, isSearching: false, localResults: [], error: null }),
}));
vi.mock("@/hooks/use-food", () => ({ useFood: () => ({ food: null, isLoading: false, isPlaceholder: false, error: null }) }));
vi.mock("@/hooks/use-food-favorites", () => ({ useFoodFavorites: () => ({ ids: new Set<string>(), toggle: vi.fn(), isLoading: false }) }));
vi.mock("@/hooks/use-log-meal", () => ({
  useLogMeal: () => ({ logMeal: fx.logMeal, updateItem: vi.fn(), deleteItem: vi.fn(), deleteMeal: vi.fn(), duplicateMeal: vi.fn(), pending: false }),
}));
vi.mock("@/hooks/use-barcode-scan", () => ({ useBarcodeScan: () => ({ supported: true, scan: fx.scan, openSettings: vi.fn() }) }));
vi.mock("@/lib/nutrition/queries", () => ({
  fetchDay: vi.fn(),
  lookupBarcode: fx.lookupBarcode,
  recipePerServing: vi.fn(),
  searchOnline: vi.fn(),
}));

const targetsRow: NutritionTargetsRow = {
  id: "t1",
  user_id: "u1",
  effective_from: "2026-01-01",
  kcal: 2400,
  protein_g: 160,
  carbs_g: 260,
  fat_g: 80,
  fiber_g: 30,
  water_ml: null,
  micro_targets: {},
  method: "manual",
  activity_level: null,
  created_at: "",
};

const meal = (id: string, slot: MealLogRow["meal_slot"]): MealLogRow => ({
  id,
  user_id: "u1",
  log_date: "2026-09-04",
  tz_offset_minutes: 180,
  meal_slot: slot,
  logged_at: "2026-09-04T12:00:00Z",
  source: "manual",
  note: null,
  photo_path: null,
  kcal: 330,
  protein_g: 42,
  carbs_g: 10,
  fat_g: 12,
  created_at: "",
  updated_at: "",
});

const item = (id: string, mealId: string): MealLogItemRow => ({
  id,
  meal_log_id: mealId,
  user_id: "u1",
  kind: "food",
  food_id: "f1",
  recipe_id: null,
  grams: 200,
  serving_id: null,
  serving_qty: null,
  display_name: "Chicken breast, cooked",
  snapshot: { kcal: 330, protein_g: 42, carbs_g: 10, fat_g: 12 },
  snapshot_version: 1,
  sort_order: 0,
  created_at: "",
  updated_at: "",
});

const totalsDay = (kcal: number, protein = 42): DailyTotalsDay => ({
  log_date: "2026-09-04",
  totals: { kcal, protein_g: protein, carbs_g: 10, fat_g: 12 },
  by_slot: { lunch: { kcal, protein_g: protein } },
  meal_count: 1,
  item_count: 1,
  targets: targetsRow,
});

const renderDiary = (path = "/nutrition") => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/nutrition" element={<NutritionDiary />} />
          <Route path="/nutrition/targets" element={<p>targets screen</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  fx.day.meals = [];
  fx.day.items = [];
  fx.day.itemsByMeal = new Map();
  fx.day.pendingIds = new Set();
  fx.day.isLoading = false;
  fx.day.error = null;
  fx.totals.day = null;
  fx.totals.isLoading = false;
  fx.targets.targets = null;
  fx.scan.mockReset();
  fx.lookupBarcode.mockReset();
});

describe("NutritionDiary — opening beat", () => {
  it("counts down to the target when the day is in progress", () => {
    fx.totals.day = totalsDay(1240);
    fx.targets.targets = targetsRow;
    renderDiary();
    // 2400 − 1240 = 1160, grouped with the fi-FI no-break space (\s matches it).
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/1\s160 kcal to go\./);
  });

  it("asks for targets when there are none, and the line itself opens the targets screen", () => {
    renderDiary();
    const line = screen.getByRole("button", { name: "Set your targets." });
    expect(screen.getByRole("heading", { level: 1 })).toContainElement(line);
    fireEvent.click(line);
    expect(screen.getByText("targets screen")).toBeInTheDocument();
  });
});

describe("NutritionDiary — slots and rows", () => {
  it("renders the four meal slots as sections in diary order", () => {
    fx.targets.targets = targetsRow;
    renderDiary();
    const names = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(names).toEqual(["Breakfast", "Lunch", "Dinner", "Snack"]);
  });

  it("shows a logged item with the macros from its snapshot", () => {
    const m = meal("m1", "lunch");
    const it = item("i1", "m1");
    fx.day.meals = [m];
    fx.day.items = [it];
    fx.day.itemsByMeal = new Map([["m1", [it]]]);
    fx.totals.day = totalsDay(330);
    fx.targets.targets = targetsRow;
    renderDiary();
    const lunch = screen.getByRole("region", { name: "Lunch" });
    const row = within(lunch).getByRole("button", { name: /Chicken breast, cooked/ });
    expect(row).toHaveTextContent("330");
    expect(row).toHaveTextContent("P 42 · C 10 · F 12");
    expect(within(lunch).getByText("330 kcal")).toBeInTheDocument();
  });
});

describe("NutritionDiary — add sheet", () => {
  it("opens the search sheet for the slot from + Add", () => {
    fx.targets.targets = targetsRow;
    renderDiary();
    const breakfast = screen.getByRole("region", { name: "Breakfast" });
    fireEvent.click(within(breakfast).getByRole("button", { name: /Add/ }));
    const dialog = screen.getByRole("dialog", { name: "Add to Breakfast" });
    expect(within(dialog).getByLabelText("Search foods")).toBeInTheDocument();
  });

  it("opens straight into search from ?add=1&slot=dinner and strips the params", () => {
    fx.targets.targets = targetsRow;
    renderDiary("/nutrition?add=1&slot=dinner");
    expect(screen.getByRole("dialog", { name: "Add to Dinner" })).toBeInTheDocument();
  });

  it("says nothing was invented when a scanned barcode is unknown", async () => {
    fx.targets.targets = targetsRow;
    fx.scan.mockResolvedValue({ kind: "code", code: "6412345678901", raw: "6412345678901", format: "EAN_13" });
    fx.lookupBarcode.mockResolvedValue({ status: "miss", row: null });
    renderDiary("/nutrition?add=1");
    fireEvent.click(screen.getByRole("button", { name: "Scan a barcode" }));
    expect(await screen.findByText("Not found. Nothing was invented.")).toBeInTheDocument();
    expect(screen.getByText(/6412345678901/)).toBeInTheDocument();
    expect(fx.logMeal).not.toHaveBeenCalled();
  });
});
