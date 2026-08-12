// The offline check-in queue guards the app's defining action. The 36h drop
// window exists because a naive "same local date only" check once silently
// LOST a check-in made at 23:58 and replayed at 00:02 — that exact scenario
// is locked here. The supabase client is injected, so a plain fake suffices.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  queueCheckin,
  getPendingCheckin,
  clearPendingCheckin,
  flushPendingCheckin,
  isNetworkError,
  localDateStr,
} from "@/lib/offline-checkin";

const fakeClient = (error: { message: string } | null) =>
  ({ rpc: vi.fn().mockResolvedValue({ error }) }) as never;

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("queue basics", () => {
  it("round-trips args through localStorage", () => {
    queueCheckin({ p_workout: true });
    expect(getPendingCheckin()?.args).toEqual({ p_workout: true });
    clearPendingCheckin();
    expect(getPendingCheckin()).toBeNull();
  });

  it("localDateStr is YYYY-MM-DD", () => {
    expect(localDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isNetworkError", () => {
  it("matches replayable network signatures, not business errors", () => {
    expect(isNetworkError({ message: "TypeError: Load failed" })).toBe(true);
    expect(isNetworkError({ message: "Failed to fetch" })).toBe(true);
    expect(isNetworkError({ message: "ALREADY_CHECKED_IN_TODAY" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("flushPendingCheckin", () => {
  it("returns 'none' with an empty queue and never calls the server", async () => {
    const client = fakeClient(null);
    await expect(flushPendingCheckin(client)).resolves.toBe("none");
    expect((client as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it("REGRESSION LOCK: a 23:58 queue still replays at 00:02 (midnight crossing)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 23, 58));
    queueCheckin({ p_workout: true });
    vi.setSystemTime(new Date(2026, 7, 12, 0, 2)); // next local date, 4 min later
    await expect(flushPendingCheckin(fakeClient(null))).resolves.toBe("synced");
    expect(getPendingCheckin()).toBeNull();
  });

  it("drops a genuinely abandoned queue (>36h) without calling the server", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 12, 0));
    queueCheckin({ p_workout: true });
    vi.setSystemTime(new Date(2026, 7, 12, 1, 0)); // 37h later
    const client = fakeClient(null);
    await expect(flushPendingCheckin(client)).resolves.toBe("none");
    expect((client as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
    expect(getPendingCheckin()).toBeNull();
  });

  it("ALREADY_CHECKED_IN_TODAY clears the queue (idempotent replay)", async () => {
    queueCheckin({ p_workout: true });
    await expect(flushPendingCheckin(fakeClient({ message: "ALREADY_CHECKED_IN_TODAY" }))).resolves.toBe("already");
    expect(getPendingCheckin()).toBeNull();
  });

  it("other failures KEEP the queue for the next retry tick", async () => {
    queueCheckin({ p_workout: true });
    await expect(flushPendingCheckin(fakeClient({ message: "Load failed" }))).resolves.toBe("failed");
    expect(getPendingCheckin()).not.toBeNull();
  });
});
