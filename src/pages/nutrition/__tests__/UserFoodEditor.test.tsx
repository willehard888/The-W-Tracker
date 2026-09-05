import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UserFoodEditor from "@/pages/nutrition/UserFoodEditor";

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-nutrient-definitions", () => ({ useNutrientDefinitions: () => ({ defs: [], byKey: new Map(), isLoading: false }) }));
vi.mock("@/hooks/use-food", () => ({ useFood: () => ({ food: null, isLoading: false, isPlaceholder: false, error: null }) }));
vi.mock("@/lib/nutrition/queries", async (orig) => ({ ...(await orig<typeof import("@/lib/nutrition/queries")>()), fetchFood: vi.fn(async () => null) }));

const foods = vi.hoisted(() => ({ foods: [], isLoading: false, save: vi.fn(async () => "food-1"), remove: vi.fn(), saving: false }));
vi.mock("@/hooks/use-user-foods", () => ({ useUserFoods: () => foods }));

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/nutrition/foods/new" element={<UserFoodEditor />} />
          <Route path="/nutrition" element={<p>diary {path}</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("UserFoodEditor", () => {
  beforeEach(() => foods.save.mockClear());

  it("prefills from the query string and warns when kcal disagrees with the macros", () => {
    renderAt("/nutrition/foods/new?name=Rye%20bread&barcode=6410405");
    expect(screen.getByLabelText("Food name")).toHaveValue("Rye bread");
    expect(screen.getByLabelText(/Barcode/)).toHaveValue("6410405");
    fill(/Calories/, "100");
    fill(/^Protein/, "50");
    fill(/^Carbs/, "50");
    fill(/^Fat/, "50");
    expect(screen.getByRole("status")).toHaveTextContent(/about 850 kcal/);
    fill(/Calories/, "850");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("prefills brand, nutrients and the serving from a label photo and says so", () => {
    renderAt("/nutrition/foods/new?from=label&name=Ruisleip%C3%A4&brand=Fazer&kcal=250&protein_g=8&carbs_g=45&fat_g=3&salt_g=1.1&serving_g=30&serving_label=1%20slice");
    expect(screen.getByText(/Read from a label photo/)).toBeInTheDocument();
    expect(screen.getByLabelText("Brand")).toHaveValue("Fazer");
    expect(screen.getByLabelText(/Calories/)).toHaveValue("250");
    expect(screen.getByLabelText(/^Protein/)).toHaveValue("8");
    expect(screen.getByLabelText("Serving label")).toHaveValue("1 slice");
    expect(screen.getByLabelText(/^Grams/)).toHaveValue("30");
    expect(screen.getByRole("button", { name: "Default serving" })).toHaveAttribute("aria-pressed", "true");
  });

  it("refuses to save without the required label and says so inline", () => {
    renderAt("/nutrition/foods/new");
    fireEvent.click(screen.getByRole("button", { name: "Save food" }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    expect(foods.save).not.toHaveBeenCalled();
  });

  it("saves the upsert_user_food payload and hands the new id to the diary", async () => {
    renderAt("/nutrition/foods/new?date=2026-09-04&slot=lunch");
    fill(/Food name/, "Rye bread");
    fill(/Calories/, "250");
    fill(/^Protein/, "8");
    fill(/^Carbs/, "45");
    fill(/^Fat/, "3");
    fill(/Fiber/, "8,5");
    fireEvent.click(screen.getByRole("button", { name: "Add serving" }));
    fill(/Serving label/, "1 slice");
    fill(/Grams/, "30");
    fireEvent.click(screen.getByRole("button", { name: "Make default serving" }));
    fireEvent.click(screen.getByRole("button", { name: "Save food" }));
    await waitFor(() => expect(foods.save).toHaveBeenCalledTimes(1));
    expect(foods.save).toHaveBeenCalledWith({
      id: undefined,
      name: "Rye bread",
      brand: null,
      barcode: null,
      nutrients: { kcal: 250, protein_g: 8, carbs_g: 45, fat_g: 3, fiber_g: 8.5 },
      servings: [{ label: "1 slice", grams: 30, is_default: true, sort_order: 0 }],
    });
    expect(await screen.findByText("diary /nutrition/foods/new?date=2026-09-04&slot=lunch")).toBeInTheDocument();
  });
});
