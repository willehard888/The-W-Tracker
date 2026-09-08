import { describe, expect, it, vi } from "vitest";
import { backOr, pageKey } from "../nav";

describe("backOr", () => {
  it("goes back when the router has history", () => {
    window.history.replaceState({ idx: 2 }, "");
    const navigate = vi.fn();
    backOr(navigate, "/coach");
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it("lands on the fallback from a cold start or deep link", () => {
    window.history.replaceState({ idx: 0 }, "");
    const navigate = vi.fn();
    backOr(navigate, "/coach");
    expect(navigate).toHaveBeenCalledWith("/coach", { replace: true });
    window.history.replaceState(null, "");
    backOr(navigate);
    expect(navigate).toHaveBeenLastCalledWith("/", { replace: true });
  });
});

describe("pageKey", () => {
  it("folds a library detail into its list page and leaves other paths alone", () => {
    expect(pageKey("/exercises/barbell-squat")).toBe("/exercises");
    expect(pageKey("/recipes/r-12")).toBe("/recipes");
    expect(pageKey("/exercises")).toBe("/exercises");
    expect(pageKey("/nutrition/recipes/abc")).toBe("/nutrition/recipes/abc");
    expect(pageKey("/tribes/x")).toBe("/tribes/x");
  });
});
