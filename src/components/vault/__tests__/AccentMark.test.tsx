import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AccentMark from "../AccentMark";

// The Vault's one progress circle: five hand-rolled markers used to say the
// same thing five ways.
describe("AccentMark", () => {
  const accent = "rgb(10, 20, 30)";

  it("done is filled in the accent with a check, or the number on the fill", () => {
    const { container, rerender } = render(<AccentMark accent={accent} state="done" />);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(mark.style.background).toBe(accent);
    expect(mark.style.borderColor).toBe(accent);
    expect(mark.querySelector("svg.lucide-check")).not.toBeNull();
    rerender(<AccentMark accent={accent} state="done">3</AccentMark>);
    expect(container.textContent).toBe("3");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("current is a ring in the accent, idle waits in the border colour, and every state is a 20 px circle", () => {
    const { container, rerender } = render(<AccentMark accent={accent} state="current">2</AccentMark>);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.style.borderColor).toBe(accent);
    expect(mark.style.background).toBe("");
    expect(mark.textContent).toBe("2");
    rerender(<AccentMark accent={accent} state="idle">4</AccentMark>);
    const idle = container.firstElementChild as HTMLElement;
    expect(idle.getAttribute("style") ?? "").toBe("");
    expect(idle.className.split(" ")).toEqual(expect.arrayContaining(["h-5", "w-5", "rounded-full", "border-border/60", "text-muted-foreground"]));
  });
});
