// Draft persistence guards the check-in form against tab taps / WebView
// kills. Locks: round-trip, per-day isolation, corrupt-data tolerance.
import { describe, it, expect, beforeEach } from "vitest";
import { loadCheckinDraft, saveCheckinDraft, clearCheckinDraft } from "@/lib/checkin-draft";
import { localDateStr } from "@/lib/offline-checkin";

beforeEach(() => localStorage.clear());

describe("checkin draft", () => {
  it("round-trips through localStorage", () => {
    saveCheckinDraft("u1", { sleep: 7.5, workoutChoice: "trained", sportCategory: "gym", hydration: 3, completed: { reading: true }, honest: true });
    expect(loadCheckinDraft("u1")).toEqual({
      sleep: 7.5, workoutChoice: "trained", sportCategory: "gym", hydration: 3, completed: { reading: true }, honest: true,
    });
  });

  it("is isolated per user and per local day", () => {
    saveCheckinDraft("u1", { sleep: 8, workoutChoice: null, sportCategory: "none", hydration: 2, completed: {}, honest: false });
    expect(loadCheckinDraft("u2")).toBeNull();
    // A draft stored under yesterday's key is invisible today.
    localStorage.setItem(`w_checkin_draft_v1_u3_2020-01-01`, JSON.stringify({ sleep: 5 }));
    expect(loadCheckinDraft("u3")).toBeNull();
    expect(localStorage.getItem(`w_checkin_draft_v1_u1_${localDateStr()}`)).not.toBeNull();
  });

  it("tolerates corrupt or partial data", () => {
    localStorage.setItem(`w_checkin_draft_v1_u1_${localDateStr()}`, "{not json");
    expect(loadCheckinDraft("u1")).toBeNull();
    localStorage.setItem(`w_checkin_draft_v1_u1_${localDateStr()}`, JSON.stringify({ workoutChoice: "maybe", completed: "x" }));
    expect(loadCheckinDraft("u1")).toEqual({ sleep: 8, workoutChoice: null, sportCategory: "none", hydration: 0, completed: {}, honest: false });
  });

  it("clears", () => {
    saveCheckinDraft("u1", { sleep: 8, workoutChoice: "rest", sportCategory: "none", hydration: 2, completed: {}, honest: false });
    clearCheckinDraft("u1");
    expect(loadCheckinDraft("u1")).toBeNull();
  });
});
