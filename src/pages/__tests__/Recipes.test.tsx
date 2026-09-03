import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Recipes from "@/pages/Recipes";
import { RECIPES } from "@/data/recipes";

/**
 * These cover the two things the recipe screen used to hold in its data and
 * never put on screen: the cooking method, and the ingredient list at 1×.
 *
 * Worth a test rather than a look-and-see: both were populated for every
 * recipe the whole time, so nothing about the data would have told you they
 * were missing — only the rendered output does.
 */

const openFirstRecipe = () => {
  render(
    <MemoryRouter>
      <Recipes />
    </MemoryRouter>,
  );
  const first = RECIPES[0];
  fireEvent.click(screen.getByText(first.title));
  return first;
};

describe("Recipes screen", () => {
  it("renders every method step as text, not just the poster image", () => {
    const recipe = openFirstRecipe();

    expect(screen.getByText("Method")).toBeInTheDocument();

    for (const phase of recipe.method) {
      expect(screen.getByText(phase.title)).toBeInTheDocument();
      for (const step of phase.steps) {
        expect(screen.getByText(step)).toBeInTheDocument();
      }
    }
  });

  it("shows the shopping list at 1x, without touching the batch scaler", () => {
    const recipe = openFirstRecipe();

    // Previously gated behind `batch > 1`, so a user who never tapped the
    // scaler never discovered the list existed.
    expect(screen.getByText("Shopping list")).toBeInTheDocument();

    for (const group of recipe.groups) {
      expect(screen.getByText(group.title)).toBeInTheDocument();
    }
  });

  it("lists dietary tags on the browse cards", () => {
    render(
      <MemoryRouter>
        <Recipes />
      </MemoryRouter>,
    );

    // `tags` was populated on all 15 recipes and rendered nowhere.
    const tagged = RECIPES.find((r) => r.tags.length > 0)!;
    const card = screen.getByText(tagged.title).closest("button")!;
    for (const tag of tagged.tags) {
      expect(within(card).getByText(tag)).toBeInTheDocument();
    }
  });
});
