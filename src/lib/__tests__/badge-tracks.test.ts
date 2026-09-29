import { describe, it, expect } from "vitest";
import { trackLine, trackLabel, maskSecret, SECRET_ICON } from "@/lib/badge-tracks";

const med = (id: string, value: number, name: string, hidden = false) =>
  ({ id, name, icon: "x", requirement_type: "meditation", requirement_value: value, hidden });
const ALL = [
  med("a", 1, "First Breath"), med("b", 10, "Inner Peace"), med("c", 30, "Mind Over Matter"),
  med("d", 300, "Enlightened"), med("s", 30, "Both Ends", true),
  { id: "m", name: "Founder", icon: "⭐", requirement_type: null, requirement_value: null },
  { id: "j", name: "Shadow Explorer", icon: "🌑", requirement_type: "vault_master:jung", requirement_value: 2 },
];

describe("trackLine — where a badge sits on its ladder", () => {
  it("counts rungs by shared requirement_type, sorted by value, secrets left out", () => {
    expect(trackLine(ALL[1], ALL)).toEqual({ label: "Meditation", rung: 2, of: 4, next: { name: "Mind Over Matter", value: 30 } });
    expect(trackLine(ALL[3], ALL)).toEqual({ label: "Meditation", rung: 4, of: 4, next: null });
  });
  it("has no line for a manual badge or a track of one", () => {
    expect(trackLine(ALL[5], ALL)).toBeNull();
    expect(trackLine(ALL[6], ALL)).toBeNull();
  });
  it("labels the tracks it knows and reads the rest", () => {
    expect(trackLabel("full_sleep_nights")).toBe("Full nights");
    expect(trackLabel("vault_master:jung")).toBe("Vault masters");
    expect(trackLabel("some_new_key")).toBe("some new key");
  });
});

describe("maskSecret", () => {
  it("hides an unearned secret entirely and leaves an earned one alone", () => {
    const masked = maskSecret(ALL[4], false);
    expect(masked.name).toBe("Secret");
    expect(masked.icon).toBe(SECRET_ICON);
    expect(masked.requirement_type).toBeNull();
    expect(maskSecret(ALL[4], true)).toBe(ALL[4]);
    expect(maskSecret(ALL[0], false)).toBe(ALL[0]);
  });
});
