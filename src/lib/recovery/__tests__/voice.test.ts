import { describe, it, expect, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { hasVoice, needsSeek, setVoiceOn, voiceOn, voiceSrc } from "@/lib/recovery/voice";
import { ROUTINES } from "@/data/recovery-routines";
import { routineSession } from "@/data/recovery-routines";

/**
 * The voice is one file per session, played against the runner's clock. Two
 * ways that goes wrong silently: a routine claims a voice whose file is not in
 * the build, or the file is a different length than the session — either leaves
 * somebody lying on the floor listening to nothing, or hearing "open your eyes"
 * two minutes early.
 */

describe("the voiced routines", () => {
  it("point at a file that ships", () => {
    for (const r of ROUTINES.filter((x) => hasVoice(x.id))) {
      const file = `public${voiceSrc(r.id)}`;
      expect(existsSync(file), `${r.id} → ${file}`).toBe(true);
    }
  });

  it("are the twelve guided and breathing ones, not the stretch routines", () => {
    const voiced = ROUTINES.filter((r) => hasVoice(r.id));
    expect(voiced.length).toBe(12);
    // A mobility routine is a list of stretches; there is nothing to say over it.
    expect(voiced.some((r) => r.shelf === "mobility")).toBe(false);
  });

  it("run one movement, so the file's timeline is the session's timeline", () => {
    // The audio is seeked to "seconds into the session"; with a single step
    // that is the step's own clock, which is what the runner reports.
    for (const r of ROUTINES.filter((x) => hasVoice(x.id))) {
      expect(routineSession(r.id)!.movements.length, r.id).toBe(1);
    }
  });
});

describe("staying in step", () => {
  it("leaves small drift alone and corrects a real jump", () => {
    expect(needsSeek(30.2, 30)).toBe(false);
    expect(needsSeek(30, 30.9)).toBe(false);
    expect(needsSeek(30, 45)).toBe(true); // skipped forward
    expect(needsSeek(45, 30)).toBe(true); // went back
  });
});

describe("the voice preference", () => {
  beforeEach(() => localStorage.clear());

  it("is on until it is turned off, and then stays off", () => {
    expect(voiceOn()).toBe(true);
    setVoiceOn(false);
    expect(voiceOn()).toBe(false);
    setVoiceOn(true);
    expect(voiceOn()).toBe(true);
  });
});
