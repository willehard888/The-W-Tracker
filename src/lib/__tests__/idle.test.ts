import { afterEach, describe, expect, it, vi } from "vitest";
import { afterIdle, onIdle } from "@/lib/idle";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("onIdle", () => {
  it("uses requestIdleCallback with the timeout when present, cancel unregisters it", () => {
    const ric = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal("requestIdleCallback", ric);
    vi.stubGlobal("cancelIdleCallback", cancel);
    const cb = vi.fn();
    const off = onIdle(cb, 3000);
    expect(ric).toHaveBeenCalledWith(cb, { timeout: 3000 });
    off();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("falls back to setTimeout(timeout) without requestIdleCallback", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const cb = vi.fn();
    onIdle(cb, 500);
    vi.advanceTimersByTime(499);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cancel stops the fallback timer (default 2000 ms)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const cb = vi.fn();
    onIdle(cb)();
    vi.advanceTimersByTime(2000);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("afterIdle", () => {
  it("waits the delay, then schedules on idle (fallback timeout)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const cb = vi.fn();
    afterIdle(cb, 3000, 500);
    vi.advanceTimersByTime(3000);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cancel before the delay stops everything; cancel after it unregisters the idle callback", () => {
    vi.useFakeTimers();
    const ric = vi.fn(() => 9);
    const cancel = vi.fn();
    vi.stubGlobal("requestIdleCallback", ric);
    vi.stubGlobal("cancelIdleCallback", cancel);
    const cb = vi.fn();
    afterIdle(cb, 1000)();
    vi.advanceTimersByTime(1000);
    expect(ric).not.toHaveBeenCalled();
    const off = afterIdle(cb, 1000);
    vi.advanceTimersByTime(1000);
    expect(ric).toHaveBeenCalledWith(cb, { timeout: 2000 });
    off();
    expect(cancel).toHaveBeenCalledWith(9);
  });
});
