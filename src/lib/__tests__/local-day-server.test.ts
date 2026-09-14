import { describe, expect, it } from "vitest";
import { clampTzOffset, localDayKey, localWeekday } from "../../../supabase/functions/_shared/local-day";

// 2026-09-13T22:30:00Z — a Sunday evening in UTC.
const T = Date.UTC(2026, 8, 13, 22, 30);
const HELSINKI = -180; // getTimezoneOffset() in Finnish summer time (UTC+3)
const NEW_YORK = 240;  // UTC-4

describe("localDayKey — the server's copy of the device's calendar day", () => {
  it("is already tomorrow in Helsinki when it is still Sunday evening in UTC", () => {
    expect(localDayKey(HELSINKI, T)).toBe("2026-09-14");
    expect(localWeekday(HELSINKI, T)).toBe(1); // Monday
  });

  it("is still Sunday afternoon in New York", () => {
    expect(localDayKey(NEW_YORK, T)).toBe("2026-09-13");
    expect(localWeekday(NEW_YORK, T)).toBe(0);
  });

  it("equals the UTC day at offset 0", () => {
    expect(localDayKey(0, T)).toBe("2026-09-13");
  });

  it("agrees with the client's localDateKey for the device's own offset", () => {
    // What the device would compute for the same instant with its own zone.
    const d = new Date(T);
    const client = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(localDayKey(d.getTimezoneOffset(), T)).toBe(client);
  });
});

describe("clampTzOffset", () => {
  it("passes real offsets through and rounds", () => {
    expect(clampTzOffset(-180)).toBe(-180);
    expect(clampTzOffset("240")).toBe(240);
    expect(clampTzOffset(-179.6)).toBe(-180);
  });
  it("refuses nonsense", () => {
    expect(clampTzOffset(undefined)).toBe(0);
    expect(clampTzOffset("x")).toBe(0);
    expect(clampTzOffset(99999)).toBe(840);
    expect(clampTzOffset(-99999)).toBe(-840);
  });
});
