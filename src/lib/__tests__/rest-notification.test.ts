import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  native: true,
  display: "granted" as string,
  schedule: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => state.native } }));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: state.display }),
    schedule: (...a: unknown[]) => state.schedule(...a),
    cancel: (...a: unknown[]) => state.cancel(...a),
  },
}));

import { scheduleRestDone, cancelRestDone, REST_DONE_ID } from "@/lib/rest-notification";

const future = () => new Date(Date.now() + 90_000);

describe("rest-notification", () => {
  beforeEach(() => {
    state.native = true;
    state.display = "granted";
    state.schedule.mockReset().mockResolvedValue(undefined);
    state.cancel.mockReset().mockResolvedValue(undefined);
  });

  it("does nothing on the web", async () => {
    state.native = false;
    expect(await scheduleRestDone(future(), "/coach/session/1/0")).toBe(false);
    await cancelRestDone();
    expect(state.schedule).not.toHaveBeenCalled();
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it("does not schedule a rest that is already over", async () => {
    expect(await scheduleRestDone(new Date(Date.now() - 1000), "/coach/session/1/0")).toBe(false);
    expect(state.schedule).not.toHaveBeenCalled();
  });

  // Never a permission sheet mid-set: without a grant, silently nothing.
  it("does not schedule (or prompt) without an existing grant", async () => {
    state.display = "prompt";
    expect(await scheduleRestDone(future(), "/coach/session/1/0")).toBe(false);
    expect(state.schedule).not.toHaveBeenCalled();
  });

  it("schedules the fixed id with the deep-link route when granted", async () => {
    const at = future();
    expect(await scheduleRestDone(at, "/coach/session/2/3")).toBe(true);
    expect(state.schedule).toHaveBeenCalledTimes(1);
    const [{ notifications }] = state.schedule.mock.calls[0] as [{ notifications: Array<Record<string, unknown>> }];
    expect(notifications[0]).toMatchObject({
      id: REST_DONE_ID,
      title: "Rest is up",
      body: "Next set.",
      schedule: { at, allowWhileIdle: true },
      extra: { route: "/coach/session/2/3", type: "rest-done" },
    });
    expect(REST_DONE_ID).toBe(48020);
  });

  it("swallows a bridge failure", async () => {
    state.schedule.mockRejectedValue(new Error("no bridge"));
    expect(await scheduleRestDone(future(), "/coach/session/1/0")).toBe(false);
  });

  it("cancels by the same id", async () => {
    await cancelRestDone();
    expect(state.cancel).toHaveBeenCalledWith({ notifications: [{ id: REST_DONE_ID }] });
    state.cancel.mockRejectedValue(new Error("gone"));
    await expect(cancelRestDone()).resolves.toBeUndefined();
  });
});
