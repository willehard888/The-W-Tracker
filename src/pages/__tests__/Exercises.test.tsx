import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Exercises from "@/pages/Exercises";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";

/**
 * The library's back arrow used to bounce between list and detail: the
 * detail's Back was a push to /exercises while the list's Back was a pop, so
 * every tap grew the stack. Now the list stays mounted under the detail and
 * both Backs go through backOr, so the search and the rows survive the hop.
 */
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/exercises/:slug?" element={<Exercises />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Exercise library", () => {
  it("keeps the search and the list alive across a detail and back", () => {
    renderAt("/exercises");
    const ex = ILLUSTRATED_EXERCISES[0];
    fireEvent.change(screen.getByLabelText("Search exercises"), { target: { value: ex.title } });
    const row = screen.getAllByRole("button").find((b) => b.textContent?.startsWith(ex.title));
    expect(row).toBeDefined();
    fireEvent.click(row!);

    expect(screen.getByRole("heading", { level: 1, name: ex.title })).toBeInTheDocument();
    // The list is under the detail, hidden — not gone.
    expect(screen.getByLabelText("Search exercises")).not.toBeVisible();

    // One Back closes the detail (a MemoryRouter has no window history, so
    // backOr takes its fallback) and the list comes back as it was.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("heading", { level: 1, name: ex.title })).toBeNull();
    const input = screen.getByLabelText("Search exercises") as HTMLInputElement;
    expect(input).toBeVisible();
    expect(input.value).toBe(ex.title);
    expect(screen.getAllByRole("button").some((b) => b.textContent?.startsWith(ex.title))).toBe(true);
  });

  it("offers a way back from a slug that no longer exists", () => {
    renderAt("/exercises/not-a-movement");
    expect(screen.getByText("This movement isn’t in the library")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse the library" }));
    expect(screen.getByLabelText("Search exercises")).toBeVisible();
  });
});
