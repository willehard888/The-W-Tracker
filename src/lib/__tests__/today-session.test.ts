import { describe, expect, it } from "vitest";
import { pickSessionDay } from "../../../supabase/functions/_shared/today-session";

const rest = { focus: "Rest", blocks: [] };
const chest = { focus: "Chest", duration_min: 48, blocks: [{ slug: "a" }] };

describe("pickSessionDay", () => {
  it("finds the one day a focus session holds, wherever it sits in the week", () => {
    expect(pickSessionDay({ weeks: [{ days: [rest, rest, rest, chest, rest, rest, rest] }] })).toBe(chest);
  });
  it("is null for an empty week and for rubbish", () => {
    expect(pickSessionDay({ weeks: [{ days: [rest, rest] }] })).toBeNull();
    expect(pickSessionDay(null)).toBeNull();
    expect(pickSessionDay({})).toBeNull();
  });
});
