// Slot boundaries drive which section a quick "Log" lands in.
import { describe, it, expect } from "vitest";
import { defaultSlotForHour, MEAL_SLOTS } from "../slots";

describe("MEAL_SLOTS", () => {
  it("lists the four diary sections in day order", () => {
    expect(MEAL_SLOTS.map((s) => s.key)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    expect(MEAL_SLOTS.every((s) => s.label.length > 0)).toBe(true);
  });
});

describe("defaultSlotForHour", () => {
  it("breakfast before 10:30", () => {
    expect(defaultSlotForHour(0)).toBe("breakfast");
    expect(defaultSlotForHour(10, 29)).toBe("breakfast");
  });

  it("lunch from 10:30 to 14:59", () => {
    expect(defaultSlotForHour(10, 30)).toBe("lunch");
    expect(defaultSlotForHour(14, 59)).toBe("lunch");
  });

  it("dinner from 15:00 to 20:59", () => {
    expect(defaultSlotForHour(15)).toBe("dinner");
    expect(defaultSlotForHour(20, 59)).toBe("dinner");
  });

  it("snack from 21:00", () => {
    expect(defaultSlotForHour(21)).toBe("snack");
    expect(defaultSlotForHour(23, 59)).toBe("snack");
  });
});
