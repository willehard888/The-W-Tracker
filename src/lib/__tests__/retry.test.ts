// withNetworkRetry wraps critical writes (athlete profile, avatar upload,
// coach chat connect). The contract that matters: transient WKWebView drops
// retry invisibly; RLS/validation/business errors rethrow IMMEDIATELY — a
// too-greedy pattern silently retrying a real failure would hide bugs.
import { describe, it, expect, vi, afterEach } from "vitest";
import { isTransientNetworkError, withNetworkRetry } from "@/lib/retry";

afterEach(() => vi.useRealTimers());

describe("isTransientNetworkError", () => {
  it("matches the WKWebView + Chromium network-drop signatures", () => {
    expect(isTransientNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isTransientNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransientNetworkError(new Error("Network request failed"))).toBe(true);
    expect(isTransientNetworkError(new Error("The request timed out."))).toBe(true);
    expect(isTransientNetworkError("socket hang up")).toBe(true);
  });

  it("does NOT match business/RLS/validation errors", () => {
    expect(isTransientNetworkError(new Error("new row violates row-level security policy"))).toBe(false);
    expect(isTransientNetworkError(new Error("duplicate key value violates unique constraint"))).toBe(false);
    expect(isTransientNetworkError(new Error("Invalid input"))).toBe(false);
    expect(isTransientNetworkError(null)).toBe(false);
    expect(isTransientNetworkError(undefined)).toBe(false);
  });
});

describe("withNetworkRetry", () => {
  it("returns on first success without waiting", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withNetworkRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures with linear backoff, then succeeds", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValue("ok");
    const p = withNetworkRetry(fn, 3, 100);
    await vi.advanceTimersByTimeAsync(100); // 1st backoff: base × 1
    await vi.advanceTimersByTimeAsync(200); // 2nd backoff: base × 2
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("rethrows a NON-transient error immediately — no second attempt", async () => {
    const rls = new Error("permission denied for table profiles");
    const fn = vi.fn().mockRejectedValue(rls);
    await expect(withNetworkRetry(fn, 3, 1)).rejects.toBe(rls);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt budget and throws the last error", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    const p = withNetworkRetry(fn, 3, 50);
    const guard = expect(p).rejects.toThrow("Load failed");
    await vi.advanceTimersByTimeAsync(50 + 100);
    await guard;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
