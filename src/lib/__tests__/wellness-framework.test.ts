// The 900-line protocol catalog is hand-maintained AND feeds the AI coach's
// prompt context. Integrity tests catch every future edit that breaks shape;
// HABIT_LEVELS boundaries are "mirrored in DB log_habit RPC" — drift is silent
// without this lock.
import { describe, it, expect } from "vitest";
import {
  PROTOCOLS,
  PROTOCOL_IDS,
  PILLARS,
  EVIDENCE_META,
  getProtocol,
  protocolsByPillar,
  compactCatalogForAI,
  HABIT_LEVELS,
  getHabitLevel,
  nextHabitLevel,
  type PillarId,
} from "@/lib/wellness-framework";

const PILLAR_IDS = Object.keys(PILLARS) as PillarId[];

describe("catalog integrity", () => {
  it("protocol ids are unique", () => {
    expect(new Set(PROTOCOL_IDS).size).toBe(PROTOCOLS.length);
  });

  it("every protocol belongs to a real pillar and a real evidence tier", () => {
    for (const p of PROTOCOLS) {
      expect(PILLAR_IDS).toContain(p.pillar);
      expect(Object.keys(EVIDENCE_META)).toContain(p.evidence);
    }
  });

  it("PROTOCOL_IDS mirrors PROTOCOLS", () => {
    expect(PROTOCOL_IDS).toEqual(PROTOCOLS.map((p) => p.id));
  });

  it("every pillar has at least one protocol (pickFreeTierMove depends on it)", () => {
    for (const pillar of PILLAR_IDS) {
      expect(protocolsByPillar(pillar).length).toBeGreaterThan(0);
    }
  });

  it("getProtocol finds by id and returns undefined for garbage", () => {
    expect(getProtocol(PROTOCOLS[0].id)?.id).toBe(PROTOCOLS[0].id);
    expect(getProtocol("no-such-protocol")).toBeUndefined();
  });

  it("compactCatalogForAI keeps the 5-field compact shape (prompt budget)", () => {
    const rows = compactCatalogForAI();
    expect(rows.length).toBe(PROTOCOLS.length);
    expect(Object.keys(rows[0]).sort()).toEqual(["dose", "evidence", "id", "pillar", "title"]);
  });
});

describe("HABIT_LEVELS — mirrored in the DB log_habit RPC", () => {
  it("boundaries stay 0/7/21/60/120 with multipliers 1.0→2.0", () => {
    expect(HABIT_LEVELS.map((l) => l.min_streak)).toEqual([0, 7, 21, 60, 120]);
    expect(HABIT_LEVELS.map((l) => l.xp_multiplier)).toEqual([1.0, 1.25, 1.5, 1.75, 2.0]);
  });

  it("getHabitLevel maps boundaries exactly", () => {
    expect(getHabitLevel(0).level).toBe(1);
    expect(getHabitLevel(6).level).toBe(1);
    expect(getHabitLevel(7).level).toBe(2);
    expect(getHabitLevel(21).level).toBe(3);
    expect(getHabitLevel(60).level).toBe(4);
    expect(getHabitLevel(120).level).toBe(5);
    expect(getHabitLevel(9999).level).toBe(5);
  });

  it("nextHabitLevel returns the next rung, null at the top", () => {
    expect(nextHabitLevel(0)?.level).toBe(2);
    expect(nextHabitLevel(120)).toBeNull();
  });
});
