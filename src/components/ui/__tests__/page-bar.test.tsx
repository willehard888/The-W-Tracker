import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PageBar from "../page-bar";

// The one sub-page bar: a 44 pt back target with the 20 px arrow, the
// screen's name in the bar-title voice, at most one action.
describe("PageBar", () => {
  it("back is the house icon button with a 20 px arrow; the title is .h-card", () => {
    const onBack = vi.fn();
    render(<PageBar title="Notifications" onBack={onBack} />);
    const back = screen.getByRole("button", { name: "Back" });
    expect(back.querySelector("svg")!.getAttribute("width")).toBe("20");
    back.click();
    expect(onBack).toHaveBeenCalled();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className.split(" ")).toContain("h-card");
    expect(h1).toHaveTextContent("Notifications");
  });
  it("sticks to the top and owns the safe area", () => {
    const { container } = render(<PageBar title="X" />);
    const header = container.querySelector("header")!;
    for (const c of ["sticky", "top-0", "safe-top", "chrome-top-elevated"]) expect(header.className.split(" ")).toContain(c);
  });
});
