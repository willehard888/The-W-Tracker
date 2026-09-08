import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

/**
 * The active pill used to be a framer layoutId span per tab, which measured
 * both pills during the commit — a forced synchronous layout of the incoming
 * page on every tab tap. It is now one CSS-transitioned indicator.
 */
const at = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><BottomNav /></MemoryRouter>).container;
const indicators = (root: HTMLElement) => root.querySelectorAll<HTMLElement>("[data-nav-indicator]");

describe("BottomNav", () => {
  it("slides one indicator to the active tab's column", () => {
    const root = at("/leaderboard");
    const ind = indicators(root);
    expect(ind).toHaveLength(1);
    expect(ind[0].style.transform).toBe("translateX(200%)");
    expect(ind[0].style.opacity).toBe("1");
    expect(root.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("Ranks");
  });

  it("lights the parent tab for a pushed page and hides the indicator off the tabs", () => {
    expect(indicators(at("/tribes/abc"))[0].style.transform).toBe("translateX(100%)");
    expect(indicators(at("/reset-password"))[0].style.opacity).toBe("0");
  });

  it("leaves the workout and a chat thread alone", () => {
    expect(at("/coach/session/x").querySelector("nav")).toBeNull();
    expect(at("/chat/abc").querySelector("nav")).toBeNull();
  });
});
