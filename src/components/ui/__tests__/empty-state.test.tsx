import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { EmptyState } from "../empty-state";

// One empty: the quiet dashed card (or nothing, compact) · a gold mark on the
// icon scale · the title in the foreground tone · the line at the floor.
describe("EmptyState", () => {
  it("default sits on the surface vocabulary with a 20 px mark", () => {
    const { container } = render(<EmptyState icon={Search} title="No results" description="Try another word." />);
    const shell = container.firstElementChild as HTMLElement;
    for (const c of ["surface-card", "surface-card-quiet", "border-dashed"]) expect(shell.className.split(" ")).toContain(c);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.classList.contains("text-gold")).toBe(true);
    expect(screen.getByText("No results").className).toContain("text-foreground");
    expect(screen.getByText("Try another word.").className).toContain("text-muted-foreground/75");
  });
  it("compact drops the card and uses the 16 px mark", () => {
    const { container } = render(<EmptyState size="compact" icon={Search} title="Nothing matches" />);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).not.toContain("surface-card");
    expect(container.querySelector("svg")!.getAttribute("width")).toBe("16");
  });
});
