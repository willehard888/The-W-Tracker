// cn() = clsx + tailwind-merge. The dangerous part is tailwind-merge's
// conflict groups: `absolute` and `relative` share one, so a late `relative`
// SILENTLY DELETES an earlier `absolute` — this exact behavior broke the
// dialog/sheet close buttons once. Locked here so the footgun stays visible.
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conditionals and drops falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("later utility wins within a conflict group", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("REGRESSION LOCK: absolute/relative share a conflict group — last wins", () => {
    // A component that passes `relative` via className will strip a base
    // `absolute`. If you need both contexts, don't route them through cn.
    expect(cn("absolute", "relative")).toBe("relative");
    expect(cn("relative", "absolute")).toBe("absolute");
  });

  it("keeps non-conflicting utilities from both sides", () => {
    expect(cn("rounded-xl border", "bg-black/50")).toBe("rounded-xl border bg-black/50");
  });
});
