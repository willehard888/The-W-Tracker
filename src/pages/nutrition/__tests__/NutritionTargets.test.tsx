import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NutritionTargets from "@/pages/nutrition/NutritionTargets";

vi.mock("@/lib/haptics", () => ({ hapticSelection: vi.fn(), hapticImpact: vi.fn(), hapticNotification: vi.fn() }));
vi.mock("@/lib/platform", () => ({ isNativePlatform: () => false, getPlatform: () => "web" }));
vi.mock("@/lib/health/meal-write", () => ({ hasMealWriteConsent: () => false, enableMealWrite: vi.fn(), disableMealWrite: vi.fn() }));

const profile = { age: 34, sex: "male", height_cm: 182, weight_kg: 78, body_fat_pct: null, primary_goal: "fat_loss" };
const athlete = vi.hoisted(() => ({ profile: null as Record<string, unknown> | null, isLoading: false }));
const targetsState = vi.hoisted(() => ({ targets: null as Record<string, unknown> | null, isLoading: false, save: vi.fn(async (_patch: Record<string, unknown>) => ({})), saving: false }));
vi.mock("@/hooks/use-athlete-profile", () => ({ useAthleteProfile: () => athlete }));
vi.mock("@/hooks/use-nutrition-targets", () => ({ useNutritionTargets: () => targetsState }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/nutrition/targets"]}>
        <NutritionTargets />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("NutritionTargets", () => {
  beforeEach(() => {
    athlete.profile = profile;
    targetsState.targets = null;
    targetsState.save.mockClear();
  });

  it("proposes targets from the profile and shows the quiet profile row", () => {
    renderPage();
    expect(screen.getByText(/78 kg · 182 cm · 34 · Fat loss/)).toBeInTheDocument();
    expect(screen.getByText("Set what a good day looks like.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use these targets" })).toBeInTheDocument();
    // Mifflin: 10·78 + 6.25·182 − 5·34 + 5 = 1752.5 · 1.375 · 0.85 = 2048 → 2050
    expect(screen.getByText(/2 050|2,050/)).toBeInTheDocument();
  });

  it("saves the four proposed numbers with the method and activity", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Moderate" }));
    fireEvent.click(screen.getByRole("button", { name: "Use these targets" }));
    await waitFor(() => expect(targetsState.save).toHaveBeenCalledTimes(1));
    const patch = targetsState.save.mock.calls[0][0];
    expect(patch.method).toBe("mifflin");
    expect(patch.activity_level).toBe("moderate");
    for (const k of ["kcal", "protein_g", "carbs_g", "fat_g"]) expect(typeof patch[k]).toBe("number");
    expect(patch.protein_g).toBe(170); // 2.2 g/kg × 78 = 171.6 → 170
  });

  it("puts no numbers on a minor but still offers manual fields", () => {
    athlete.profile = { ...profile, age: 16 };
    renderPage();
    expect(screen.getByText(/aren't set for under-18s/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use these targets" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save targets" })).toBeInTheDocument();
  });

  it("validates the manual fields inline and reconciles kcal from macros", async () => {
    athlete.profile = null;
    renderPage();
    fireEvent.change(screen.getByLabelText(/Protein/), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/Carbs/), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText(/^Fat/), { target: { value: "70" } });
    expect(screen.getByText(/2 030 kcal from macros/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/kcal target/);
    expect(targetsState.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Calories/), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    await waitFor(() => expect(targetsState.save).toHaveBeenCalledWith({ kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 70, method: "manual", activity_level: "light" }));
  });
});
