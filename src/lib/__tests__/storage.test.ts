import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocal, readSession, removeLocal, removeSession, writeLocal, writeSession } from "../storage";

describe("storage helpers", () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

  it("round-trips through localStorage and sessionStorage", () => {
    expect(writeLocal("a", "1")).toBe(true);
    expect(readLocal("a")).toBe("1");
    removeLocal("a");
    expect(readLocal("a")).toBeNull();
    expect(writeSession("s", "2")).toBe(true);
    expect(readSession("s")).toBe("2");
    removeSession("s");
    expect(readSession("s")).toBeNull();
  });

  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readLocal("a")).toBeNull();
    expect(writeLocal("a", "1")).toBe(false);
    expect(() => removeLocal("a")).not.toThrow();
    expect(readSession("s")).toBeNull();
    expect(writeSession("s", "1")).toBe(false);
    expect(() => removeSession("s")).not.toThrow();
  });
});
