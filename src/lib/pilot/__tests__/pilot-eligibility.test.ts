import { describe, it, expect } from "vitest";
import { nextPrompt, COOLDOWN_MS, type EligibilityInput, type PromptLog } from "../eligibility";
import { PILOT_PROMPTS, NO_SIGNALS, type PilotSignals } from "../prompts";

const NOW = Date.parse("2026-09-25T12:00:00Z");

const base = (over: Partial<EligibilityInput> = {}): EligibilityInput => ({
  isPilot: true,
  inWindow: true,
  day: 0,
  signals: NO_SIGNALS,
  log: {},
  shownThisLaunch: 0,
  teachingCardShown: false,
  now: NOW,
  ...over,
});

const shown = (ids: string[], at = NOW - COOLDOWN_MS * 2): PromptLog =>
  Object.fromEntries(ids.map((id) => [id, { shownAt: at, answeredAt: null, dismissedAt: null }]));

const everything: PilotSignals = {
  checkedIn: true, trained: true, askedCoach: true, recovered: true,
};

describe("who we may ask", () => {
  it("asks nobody who is not in the pilot", () => {
    expect(nextPrompt(base({ isPilot: false, day: 1 }))).toBeNull();
  });

  it("stops asking once the window closes, even though access continues", () => {
    expect(nextPrompt(base({ inWindow: false, day: 20 }))).toBeNull();
  });
});

describe("the budget", () => {
  it("never stacks a question on top of a teaching card", () => {
    expect(nextPrompt(base({ day: 7, teachingCardShown: true }))).toBeNull();
  });

  it("allows one question per launch and not two", () => {
    expect(nextPrompt(base({ day: 1 }))?.id).toBe("DAY1");
    expect(nextPrompt(base({ day: 1, shownThisLaunch: 1 }))).toBeNull();
  });

  it("keeps two contextual questions 48 hours apart", () => {
    const signals = everything;
    const justAsked = { AFTER_FIRST_CHECKIN: { shownAt: NOW - 1000, answeredAt: null, dismissedAt: null } };
    expect(nextPrompt(base({ signals, log: justAsked }))).toBeNull();

    const longAgo = { AFTER_FIRST_CHECKIN: { shownAt: NOW - COOLDOWN_MS - 1, answeredAt: null, dismissedAt: null } };
    expect(nextPrompt(base({ signals, log: longAgo }))?.id).toBe("AFTER_FIRST_WORKOUT");
  });

  // A checkpoint is the scheduled, agreed part of the pilot. A tester asked
  // something yesterday still gets the day-7 question today.
  it("lets a checkpoint through the cooldown", () => {
    const justAsked = { AFTER_FIRST_CHECKIN: { shownAt: NOW - 1000, answeredAt: null, dismissedAt: null } };
    expect(nextPrompt(base({ day: 7, signals: everything, log: justAsked }))?.id).toBe("DAY1");
  });
});

describe("never the same question twice", () => {
  it.each([
    ["shown but ignored", { shownAt: NOW - COOLDOWN_MS * 2, answeredAt: null, dismissedAt: null }],
    ["answered", { shownAt: NOW - COOLDOWN_MS * 2, answeredAt: NOW - COOLDOWN_MS * 2, dismissedAt: null }],
    ["dismissed", { shownAt: NOW - COOLDOWN_MS * 2, answeredAt: null, dismissedAt: NOW - COOLDOWN_MS * 2 }],
  ])("counts %s as asked", (_label, entry) => {
    const after = nextPrompt(base({ day: 1, log: { DAY1: entry } }));
    expect(after?.id).not.toBe("DAY1");
  });

  it("works through the whole run without repeating itself", () => {
    const log: PromptLog = {};
    const seen: string[] = [];
    // One launch per day for three weeks, every signal on, cooldown satisfied
    // by the day gap.
    for (let day = 0; day <= 20; day++) {
      const now = NOW + day * 86_400_000;
      const p = nextPrompt(base({ day, signals: everything, log, now }));
      if (!p) continue;
      seen.push(p.id);
      log[p.id] = { shownAt: now, answeredAt: now, dismissedAt: null };
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain("DAY1");
    expect(seen).toContain("DAY7");
    expect(seen).toContain("DAY14");
    // Eight questions across three weeks is the whole catalogue, and it is the
    // most anyone can be asked.
    expect(seen.length).toBeLessThanOrEqual(PILOT_PROMPTS.length);
  });
});

describe("never about something they have not used", () => {
  // The brief's hardest rule. A tester who never opened the coach is not asked
  // what they thought of it — the silence is the finding.
  it("withholds every contextual question from somebody who has done nothing", () => {
    const p = nextPrompt(base({ day: 0, signals: NO_SIGNALS, log: {} }));
    expect(p).toBeNull();
  });

  it("asks about the coach only once the coach has been used", () => {
    const beforeUse = nextPrompt(base({ signals: { ...NO_SIGNALS, recovered: true } }));
    expect(beforeUse?.id).toBe("RECOVERY_VALUE");

    const afterUse = nextPrompt(base({ signals: { ...NO_SIGNALS, askedCoach: true } }));
    expect(afterUse?.id).toBe("COACH_TRUST");
  });

  it("holds the personalisation question until there is enough behind it", () => {
    const log = shown(["AFTER_FIRST_CHECKIN", "AFTER_FIRST_WORKOUT", "COACH_TRUST", "RECOVERY_VALUE"]);
    expect(nextPrompt(base({ signals: { ...NO_SIGNALS, trained: true }, log }))).toBeNull();
    expect(nextPrompt(base({ signals: everything, log }))?.id).toBe("FEELS_PERSONAL");
  });

  it("is deterministic — the same state always asks the same thing", () => {
    const input = base({ day: 3, signals: everything });
    expect(nextPrompt(input)?.id).toBe(nextPrompt(input)?.id);
  });
});

describe("the catalogue itself", () => {
  it("has unique ids that fit the column", () => {
    const ids = PILOT_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(64);
  });

  it("gives every question something to answer with", () => {
    for (const p of PILOT_PROMPTS) {
      expect(!!(p.scale || p.choice || p.comment), `${p.id} asks nothing`).toBe(true);
    }
  });

  it("gates every contextual question on a signal, with no exceptions", () => {
    for (const p of PILOT_PROMPTS.filter((x) => x.kind === "contextual")) {
      expect(typeof p.requires, `${p.id} would be asked of everyone`).toBe("function");
    }
  });

  it("dates every checkpoint, in order", () => {
    const days = PILOT_PROMPTS.filter((p) => p.kind === "checkpoint").map((p) => p.day);
    expect(days.every((d) => typeof d === "number")).toBe(true);
    expect(days).toEqual([...days].sort((a, b) => (a ?? 0) - (b ?? 0)));
  });

  it("keeps every stored choice inside the 64-char column", () => {
    for (const p of PILOT_PROMPTS) {
      for (const o of p.choice?.options ?? []) expect(o.v.length).toBeLessThanOrEqual(64);
    }
  });

  it("asks in Finnish, because the testers are Finnish", () => {
    // Detecting a language is not something a unit test should try to do. What
    // this guards is the thing that actually goes wrong: somebody pastes the
    // English draft back over the copy. English function words are the tell,
    // and they do not collide with Finnish. Product names ("AI Coach",
    // "check-in") are not function words and pass.
    const ENGLISH = /\b(the|what|how|your|you|did|was|were|would|about|this|that|with|from)\b/i;
    for (const p of PILOT_PROMPTS) {
      const text = [
        p.title, p.scale?.question, p.scale?.low, p.scale?.high,
        p.choice?.question, ...(p.choice?.options ?? []).map((o) => o.label),
        p.comment?.label, p.comment?.placeholder,
      ].filter(Boolean).join(" ");
      expect(ENGLISH.test(text), `${p.id} still has English copy in it`).toBe(false);
    }
  });
});
