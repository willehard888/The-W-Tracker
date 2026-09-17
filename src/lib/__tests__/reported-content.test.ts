import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReportedIds, markReported, resetReportedIds, subscribeReportedIds } from "@/lib/reported-content";

describe("reported-content", () => {
  beforeEach(() => resetReportedIds());

  it("remembers what was reported and hands out a new snapshot each time", () => {
    const before = getReportedIds();
    markReported("c1");
    const after = getReportedIds();
    expect(after.has("c1")).toBe(true);
    // A mutated Set would keep its identity and useSyncExternalStore would
    // never re-render the row that has to disappear.
    expect(after).not.toBe(before);
    expect(before.has("c1")).toBe(false);
  });

  it("filters a comment list the way the threads do", () => {
    markReported("c2");
    const rows = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    expect(rows.filter((r) => !getReportedIds().has(r.id)).map((r) => r.id)).toEqual(["c1", "c3"]);
  });

  it("notifies subscribers once per new id, and not after unsubscribe", () => {
    const listener = vi.fn();
    const off = subscribeReportedIds(listener);
    markReported("c1");
    markReported("c1");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    markReported("c2");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
