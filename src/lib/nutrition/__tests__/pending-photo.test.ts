import { describe, it, expect } from "vitest";
import { setPendingPhoto, takePendingPhoto } from "../pending-photo";

describe("pending photo hand-off", () => {
  it("take returns the stashed file once, then null", () => {
    const f = new File(["x"], "meal.jpg", { type: "image/jpeg" });
    setPendingPhoto(f);
    expect(takePendingPhoto()).toBe(f);
    expect(takePendingPhoto()).toBeNull();
  });

  it("set null clears", () => {
    setPendingPhoto(new File(["x"], "a.jpg"));
    setPendingPhoto(null);
    expect(takePendingPhoto()).toBeNull();
  });
});
