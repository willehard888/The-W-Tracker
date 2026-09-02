import { describe, it, expect } from "vitest";
import {
  getNotificationPrefs,
  clampReminderHour,
  REMINDER_HOUR_DEFAULT,
  PUSH_CATEGORIES,
} from "@/lib/notification-prefs";
import { STREAK_COPY } from "@/lib/streak-notifications";

describe("getNotificationPrefs", () => {
  it("defaults everything ON with hour 20 for empty/missing/malformed input", () => {
    for (const raw of [undefined, null, {}, "junk", 42, []]) {
      const p = getNotificationPrefs(raw);
      for (const cat of PUSH_CATEGORIES) expect(p[cat]).toBe(true);
      expect(p.reminder_hour).toBe(REMINDER_HOUR_DEFAULT);
    }
  });

  it("only an explicit false switches a category off", () => {
    const p = getNotificationPrefs({ coach: false, social: 0, tribe: "no" });
    expect(p.coach).toBe(false);
    expect(p.social).toBe(true);
    expect(p.tribe).toBe(true);
  });

  it("clamps reminder_hour into 17–22 and rejects garbage", () => {
    expect(clampReminderHour(3)).toBe(17);
    expect(clampReminderHour(23)).toBe(22);
    expect(clampReminderHour(19.6)).toBe(20);
    expect(clampReminderHour("21")).toBe(REMINDER_HOUR_DEFAULT);
    expect(clampReminderHour(NaN)).toBe(REMINDER_HOUR_DEFAULT);
    expect(getNotificationPrefs({ reminder_hour: 25 }).reminder_hour).toBe(22);
  });
});

describe("STREAK_COPY", () => {
  it("every tone has a streak-bearing title and a non-empty body", () => {
    for (const tone of ["calm_mentor", "drill_sergeant", "scientist", "hype"] as const) {
      const { title, body } = STREAK_COPY[tone];
      expect(title(47)).toContain("47");
      expect(title(1).length).toBeGreaterThan(5);
      expect(body.length).toBeGreaterThan(10);
    }
  });
});
