import { describe, it, expect } from "vitest";
import { HOW_IT_WORKS_BEATS, howBeat, howSeenKey } from "../how-it-works";

describe("how-it-works beats", () => {
  it("teaches exactly four beats in loop order", () => {
    expect(HOW_IT_WORKS_BEATS.map((b) => b.key)).toEqual(["checkin", "streak", "xp", "ladder"]);
  });
  it("every beat has title, short and body", () => {
    for (const b of HOW_IT_WORKS_BEATS) {
      expect(b.title.length).toBeGreaterThan(3);
      expect(b.short.length).toBeGreaterThan(3);
      expect(b.body.length).toBeGreaterThan(b.short.length);
    }
  });
  it("howBeat resolves keys and falls back to the first beat", () => {
    expect(howBeat("xp").key).toBe("xp");
    expect(howBeat("nope" as never).key).toBe("checkin");
  });
  it("seen key is per user", () => {
    expect(howSeenKey("abc")).toBe("w_how_seen_abc");
    expect(howSeenKey("abc")).not.toBe(howSeenKey("def"));
  });
});
