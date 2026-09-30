import { describe, it, expect, vi, beforeEach } from "vitest";

const hapticNotification = vi.fn();
vi.mock("@/lib/haptics", () => ({ hapticNotification: (...a: unknown[]) => hapticNotification(...a) }));
const { sonner } = vi.hoisted(() => ({
  sonner: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: sonner }));

import { toast } from "@/lib/toast";

// An outcome you see is an outcome you feel — once, from the toast itself.
describe("the app's toast", () => {
  beforeEach(() => { hapticNotification.mockClear(); sonner.success.mockClear(); sonner.error.mockClear(); sonner.info.mockClear(); });
  it("success and error carry their haptic", () => {
    toast.success("Saved");
    toast.error("Couldn't save");
    expect(hapticNotification.mock.calls).toEqual([["success"], ["error"]]);
    expect(sonner.success).toHaveBeenCalledWith("Saved");
    expect(sonner.error).toHaveBeenCalledWith("Couldn't save");
  });
  it("info and the plain call pass through silently", () => {
    toast.info("FYI");
    toast("plain");
    toast.dismiss();
    expect(hapticNotification).not.toHaveBeenCalled();
    expect(sonner.info).toHaveBeenCalledWith("FYI");
    expect(sonner).toHaveBeenCalledWith("plain");
  });
});
