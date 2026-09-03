import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Recipes from "@/pages/Recipes";
import { RECIPES } from "@/data/recipes";

/**
 * These cover what the recipe screen used to hold in its data and never put on
 * screen: the cooking method, the ingredient list, and the dietary tags. All
 * three were populated for every recipe the whole time, so nothing about the
 * data would have told you they were missing — only the rendered output does.
 */

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/:id" element={<Recipes />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Recipe list", () => {
  it("lists every recipe with its dietary tags available as filters", () => {
    renderAt("/recipes");

    expect(screen.getByText(`${RECIPES.length} recipes`)).toBeInTheDocument();

    // Tags drive the filter row, so every tag present in data must be offered.
    // Collected in ONE pass: a getByRole per tag re-scans the whole tree each
    // time, which pushed this past the 5s timeout once the suite ran together.
    const labels = new Set(
      screen.getAllByRole("button").map((b) => b.textContent?.trim()),
    );
    for (const tag of new Set(RECIPES.flatMap((r) => r.tags))) {
      expect(labels, `filter chip for "${tag}"`).toContain(tag);
    }
  });

  it("searches ingredients, not just titles", () => {
    renderAt("/recipes");

    // Pick a real ingredient that isn't in the title it belongs to.
    const target = RECIPES.find((r) =>
      r.groups.some((g) =>
        g.items.some((it) => !r.title.toLowerCase().includes(it.item.toLowerCase())),
      ),
    )!;
    const ingredient = target.groups
      .flatMap((g) => g.items)
      .find((it) => !target.title.toLowerCase().includes(it.item.toLowerCase()))!;

    fireEvent.change(screen.getByLabelText("Search recipes or ingredients"), {
      target: { value: ingredient.item },
    });

    expect(screen.getByText(target.title)).toBeInTheDocument();
  });

  it("says so plainly when nothing matches", () => {
    renderAt("/recipes");
    fireEvent.change(screen.getByLabelText("Search recipes or ingredients"), {
      target: { value: "zzzzzzz" },
    });
    expect(screen.getByText("Nothing matches that")).toBeInTheDocument();
  });
});

describe("Recipe detail", () => {
  const recipe = RECIPES[0];

  it("renders every method step as text, not baked into an image", () => {
    renderAt(`/recipes/${recipe.id}`);

    expect(screen.getByText("Method")).toBeInTheDocument();
    for (const phase of recipe.method) {
      expect(screen.getByText(phase.title)).toBeInTheDocument();
      for (const step of phase.steps) {
        expect(screen.getByText(step)).toBeInTheDocument();
      }
    }
  });

  it("shows the ingredient list at 1x, without touching the batch scaler", () => {
    renderAt(`/recipes/${recipe.id}`);

    expect(screen.getByText("Ingredients")).toBeInTheDocument();
    for (const group of recipe.groups) {
      expect(screen.getByText(group.title)).toBeInTheDocument();
    }
  });

  it("scales quantities when a batch is chosen", () => {
    renderAt(`/recipes/${recipe.id}`);

    const scalable = recipe.groups.flatMap((g) => g.items).find((it) => it.qty != null)!;
    const list = screen.getByText("Ingredients").parentElement!;
    expect(within(list).getByText(new RegExp(`\\b${scalable.qty}\\b`))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3×" }));
    expect(within(list).getByText(new RegExp(`\\b${scalable.qty! * 3}\\b`))).toBeInTheDocument();
  });

  it("falls back to the list for an unknown recipe id", () => {
    renderAt("/recipes/not-a-real-recipe");
    expect(screen.getByLabelText("Search recipes or ingredients")).toBeInTheDocument();
  });
});
