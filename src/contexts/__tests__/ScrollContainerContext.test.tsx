import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollLock } from "../ScrollContainerContext";

describe("useScrollLock", () => {
  afterEach(() => { document.body.style.overflow = ""; });

  it("locks while active and clears the inline style on release", () => {
    const a = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe("hidden");
    a.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("overlapping locks release on the LAST unlock, not the first", () => {
    const a = renderHook(() => useScrollLock(true));
    const b = renderHook(() => useScrollLock(true));
    a.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    b.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("does nothing while inactive", () => {
    const a = renderHook(() => useScrollLock(false));
    expect(document.body.style.overflow).toBe("");
    a.unmount();
  });
});
