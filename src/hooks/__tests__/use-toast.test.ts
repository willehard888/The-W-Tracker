// The toast reducer is pure and drives every in-app notification surface.
// TOAST_LIMIT = 1 is a deliberate product decision (one toast at a time on
// mobile) — locked here so a library re-sync doesn't silently restore a stack.
import { describe, it, expect } from "vitest";
import { reducer } from "@/hooks/use-toast";

type State = Parameters<typeof reducer>[0];
type Action = Parameters<typeof reducer>[1];
const t = (id: string, over: Record<string, unknown> = {}) => ({ id, open: true, ...over }) as State["toasts"][number];

describe("toast reducer", () => {
  it("ADD_TOAST prepends and enforces the single-toast limit", () => {
    const s1 = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: t("1") } as Action);
    const s2 = reducer(s1, { type: "ADD_TOAST", toast: t("2") } as Action);
    expect(s2.toasts).toHaveLength(1);
    expect(s2.toasts[0].id).toBe("2"); // newest wins
  });

  it("UPDATE_TOAST merges by id and leaves others alone", () => {
    const s = reducer(
      { toasts: [t("1", { title: "a" })] },
      { type: "UPDATE_TOAST", toast: { id: "1", title: "b" } } as Action,
    );
    expect(s.toasts[0].title).toBe("b");
    const untouched = reducer(
      { toasts: [t("1", { title: "a" })] },
      { type: "UPDATE_TOAST", toast: { id: "nope", title: "b" } } as Action,
    );
    expect(untouched.toasts[0].title).toBe("a");
  });

  it("DISMISS_TOAST closes the target (or all when no id) without removing", () => {
    const s = reducer({ toasts: [t("1")] }, { type: "DISMISS_TOAST", toastId: "1" } as Action);
    expect(s.toasts[0].open).toBe(false);
    expect(s.toasts).toHaveLength(1);
    const all = reducer({ toasts: [t("1")] }, { type: "DISMISS_TOAST" } as Action);
    expect(all.toasts.every((x) => x.open === false)).toBe(true);
  });

  it("REMOVE_TOAST deletes the target, or everything when no id", () => {
    expect(reducer({ toasts: [t("1")] }, { type: "REMOVE_TOAST", toastId: "1" } as Action).toasts).toHaveLength(0);
    expect(reducer({ toasts: [t("1")] }, { type: "REMOVE_TOAST" } as Action).toasts).toHaveLength(0);
  });
});
