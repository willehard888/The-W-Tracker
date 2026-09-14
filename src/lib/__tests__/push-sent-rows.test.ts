import { describe, expect, it } from "vitest";
import { deadTokens, pushSentRows } from "../../../supabase/functions/_shared/push-targets";

const targets = [
  { token: "t-anna", user_id: "anna" },
  { token: "t-anna-2", user_id: "anna" },
  { token: "t-orphan" },
];
const results = [
  { token: "t-anna", status: 200 },
  { token: "t-anna-2", status: 410, reason: "Unregistered" },
  { token: "t-orphan", status: 400, reason: "BadDeviceToken" },
  { token: "t-unknown", status: 200 },
];

describe("push bookkeeping", () => {
  it("prunes exactly the tokens APNs will never deliver to again", () => {
    expect(deadTokens(results)).toEqual(["t-anna-2", "t-orphan"]);
  });

  it("writes one push_sent row per owned device, with the failure reason", () => {
    expect(pushSentRows(results, targets, "winback")).toEqual([
      { user_id: "anna", event: "push_sent", props: { kind: "winback", ok: true } },
      { user_id: "anna", event: "push_sent", props: { kind: "winback", ok: false, reason: "Unregistered" } },
    ]);
  });

  it("writes nothing for a token with no owner", () => {
    expect(pushSentRows(results, [{ token: "t-unknown" }], "coach")).toEqual([]);
  });
});
