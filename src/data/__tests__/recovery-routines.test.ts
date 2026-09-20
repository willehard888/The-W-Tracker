import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  GUIDED,
  LIBRARY_ITEMS,
  ROUTINES,
  routineArt,
  routineMovements,
  routineSession,
} from "@/data/recovery-routines";
import { RECOVERY_MOVEMENTS, movementSeconds } from "@/data/recovery";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";
import { BUNDLED_FRAME_IDS } from "@/data/illustration-frame-ids";
import { CHECKIN_HABITS } from "@/lib/checkin-habits";
import { cycleSec } from "@/lib/recovery/pace";
import { habitsEarnedToday, markRecoveryDone, recoveryDoneToday } from "@/lib/recovery/completion";

/**
 * The library is data the runner trusts without checking: a routine step that
 * names a movement that does not exist would silently drop out of the session,
 * a cue at second 700 of a 600-second hold would never show, and a claim in a
 * script would ship under the app's name. These make each of those a failure.
 */

const stepId = (s: string | [string, number]) => (typeof s === "string" ? s : s[0]);

describe("routines", () => {
  it("name only items that exist, each at most once", () => {
    const ids = new Set(LIBRARY_ITEMS.map((m) => m.id));
    for (const r of ROUTINES) {
      const steps = r.steps.map(stepId);
      expect(steps.filter((id) => !ids.has(id)), r.id).toEqual([]);
      // The runner keys its progress bar by id.
      expect(new Set(steps).size, r.id).toBe(steps.length);
    }
  });

  it("have unique ids", () => {
    expect(new Set(ROUTINES.map((r) => r.id)).size).toBe(ROUTINES.length);
  });

  it("tick a habit the check-in actually has", () => {
    const keys = new Set(CHECKIN_HABITS.map((h) => h.key));
    for (const r of ROUTINES) expect(keys.has(r.habit), r.id).toBe(true);
  });

  it("link only Vault pieces that exist", () => {
    const sources = [
      readFileSync("scripts/vault/base.json", "utf8"),
      ...readdirSync("supabase/migrations").map((f) => readFileSync(join("supabase/migrations", f), "utf8")),
    ].join("\n");
    for (const r of ROUTINES.filter((x) => x.vault)) {
      expect(sources.includes(`"${r.vault}"`) || sources.includes(`'${r.vault}'`), r.vault).toBe(true);
    }
  });

  it("time a breathing pattern in whole cycles, so it never stops mid-breath", () => {
    for (const r of ROUTINES) {
      for (const m of routineMovements(r)) {
        if (!m.pace) continue;
        const cycles = m.holdSec / cycleSec(m.pace);
        expect(Math.abs(cycles - Math.round(cycles)), `${r.id}:${m.id}`).toBeLessThan(1e-9);
      }
    }
  });

  it("become the session the runner walks, with the time it promises", () => {
    for (const r of ROUTINES) {
      const s = routineSession(r.id)!;
      expect(s.movements.length).toBe(r.steps.length);
      expect(s.totalSec).toBe(s.movements.reduce((sum, m) => sum + movementSeconds(m), 0));
    }
    expect(routineSession("not-a-routine")).toBeNull();
  });
});

describe("the library", () => {
  it("has ids unique across movements and guided sessions, and apart from strength slugs", () => {
    const ids = LIBRARY_ITEMS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const strength = new Set(ILLUSTRATED_EXERCISES.map((e) => e.slug));
    expect(ids.filter((id) => strength.has(id))).toEqual([]);
  });

  it("gives every guided session a script that starts at once and runs in order", () => {
    for (const g of GUIDED) {
      const cues = g.cues ?? [];
      expect(cues[0]?.[0], g.id).toBe(0);
      for (let i = 1; i < cues.length; i++) expect(cues[i][0], g.id).toBeGreaterThan(cues[i - 1][0]);
      expect(cues.at(-1)![0], g.id).toBeLessThan(g.holdSec);
    }
  });

  it("says what to do, never what it does to you", () => {
    const banned =
      /speeds? recovery|flush(es)? |lactic acid|repairs? muscle|prevents? injur|heals?|detox|cortisol|nervous system|anxiety|vagal|vagus|parasympathetic|dopamine|improves? (your )?sleep|better sleep|cures?|reduces? stress|lowers? stress/i;
    const lines = [
      ...LIBRARY_ITEMS.flatMap((m) => [m.name, ...m.steps, m.caution ?? "", ...(m.cues ?? []).map(([, t]) => t)]),
      ...ROUTINES.flatMap((r) => [r.name, r.blurb]),
    ];
    expect(lines.filter((l) => banned.test(l))).toEqual([]);
  });

  it("draws every item, so no row falls back to a shared glyph", () => {
    // Six routine rows once showed the same lucide squiggle, because twelve
    // routines had no drawn step. A picture that six rows share is not a
    // picture; this is what stops the fallback coming back unnoticed.
    expect(LIBRARY_ITEMS.filter((m) => !m.art).map((m) => m.id)).toEqual([]);
  });

  it("gives every routine a drawing of its own first movement", () => {
    for (const r of ROUTINES) expect(routineArt(r), r.id).toBeDefined();
  });

  it("gives each routine a different cover, so no two rows look alike", () => {
    // The two NSDRs are deliberately the same practice at two lengths; every
    // other pair sharing a picture is the old shelf-glyph problem returning.
    const covers = ROUTINES.filter((r) => !r.id.startsWith("nsdr-")).map(routineArt);
    expect(new Set(covers).size).toBe(covers.length);
  });

  it("ships a drawing only as a complete, aligned pair", () => {
    for (const m of LIBRARY_ITEMS.filter((x) => x.art)) {
      const id = m.art!;
      expect(Number(id), m.id).toBeGreaterThanOrEqual(300); // never an Everkinetic id
      expect(BUNDLED_FRAME_IDS.has(id), m.id).toBe(true);
      expect(existsSync(`public/illustrations/gold/${id}.webp`), m.id).toBe(true);
      const box = (state: string) =>
        readFileSync(`public/illustrations/frames/${id}-${state}.svg`, "utf8").match(/viewBox="([^"]+)"/)?.[1];
      // The crossfade only reads as one movement if both frames share a canvas.
      expect(box("relaxation"), m.id).toBe(box("tension"));
    }
  });
});

describe("the check-in credit", () => {
  beforeEach(() => localStorage.clear());

  it("ticks the habit the routine names, not always mobility", () => {
    const now = new Date(2026, 8, 19, 22, 0);
    markRecoveryDone(now, "breathwork");
    expect(habitsEarnedToday(now)).toEqual(["breathwork"]);
    expect(recoveryDoneToday(now)).toBe(false);
  });

  it("keeps the original key for mobility, so older sessions still count", () => {
    const now = new Date(2026, 8, 19, 8, 0);
    markRecoveryDone(now);
    expect(recoveryDoneToday(now)).toBe(true);
    expect(habitsEarnedToday(now)).toEqual(["mobility"]);
  });

  it("forgets it on the next day", () => {
    markRecoveryDone(new Date(2026, 8, 19, 23, 50), "meditation_pm");
    expect(habitsEarnedToday(new Date(2026, 8, 20, 0, 10))).toEqual([]);
  });
});
