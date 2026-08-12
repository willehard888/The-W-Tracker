// uniqueChannelName prevents the StrictMode double-subscribe crash — every
// call MUST yield a distinct name even with identical inputs.
import { describe, it, expect } from "vitest";
import { uniqueChannelName } from "@/lib/realtime";

describe("uniqueChannelName", () => {
  it("identical inputs still produce distinct names (the whole point)", () => {
    expect(uniqueChannelName("feed", "user1")).not.toBe(uniqueChannelName("feed", "user1"));
  });

  it("includes prefix and keys, skips null/undefined/empty keys", () => {
    const name = uniqueChannelName("feed", "u1", null, undefined, "", 42);
    expect(name.startsWith("feed-u1-42-")).toBe(true);
  });
});
