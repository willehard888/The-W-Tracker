// localDateKey is the app's day bucket: the diary, the streak warning, the
// coach's daily rotation and the snapshot window all key off it. The bug it
// exists to prevent is UTC bucketing, which moves the day at 21:00 local.
import { describe, it, expect, vi, afterEach } from "vitest";
import { localDateKey } from "@/lib/date";

describe("localDateKey", () => {
  afterEach(() => vi.useRealTimers());

  it("zero-pads month and day", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses the LOCAL calendar day, never UTC", () => {
    // 23:30 on New Year's Eve: toISOString() rolls this into next year for
    // every timezone east of UTC — Helsinki included.
    const d = new Date(2025, 11, 31, 23, 30);
    expect(localDateKey(d)).toBe("2025-12-31");
  });

  it("defaults to now", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 8, 10, 22, 15));
    expect(localDateKey()).toBe("2026-09-10");
  });
});
