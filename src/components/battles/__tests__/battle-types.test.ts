import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BATTLE_TYPES, BATTLE_TYPE_IDS, BATTLE_DURATIONS, battleTypeInfo } from "../battle-types";

/**
 * The client's discipline list and the server's CHECK constraint are the same
 * list, or a chosen discipline is rejected at create_battle. Parsed from the
 * migration so a drift fails here, not on a member's phone.
 */
const sql = readFileSync("supabase/migrations/20260918100000_battles_server_resolve.sql", "utf8");

describe("battle types ↔ the server", () => {
  it("matches the battle_type CHECK constraint exactly", () => {
    const m = sql.match(/CONSTRAINT battles_type_check\s+CHECK \(battle_type IN \(([^)]+)\)\)/);
    expect(m).not.toBeNull();
    const serverIds = m![1].split(",").map((s) => s.trim().replace(/'/g, ""));
    expect([...BATTLE_TYPE_IDS].sort()).toEqual([...serverIds].sort());
    // create_battle and battle_day_scores name the same set
    for (const id of serverIds) expect(sql.includes(`'${id}'`)).toBe(true);
  });

  it("matches the duration CHECK constraint", () => {
    const m = sql.match(/CONSTRAINT battles_duration_check\s+CHECK \(duration_days IN \(([^)]+)\)\)/);
    expect(m).not.toBeNull();
    const server = m![1].split(",").map((s) => Number(s.trim()));
    expect([...BATTLE_DURATIONS]).toEqual(server);
  });

  it("marks exactly the Apple Health disciplines as verified, and the server gates the same three", () => {
    const verified = BATTLE_TYPES.filter((t) => t.verified).map((t) => t.id).sort();
    expect(verified).toEqual(["active_kcal", "sleep", "steps"]);
    expect(sql).toMatch(/v_type IN \('steps','sleep','active_kcal'\)/);
    expect(sql).toMatch(/b\.battle_type IN \('steps','sleep','active_kcal'\)/);
  });

  it("every type has a unit and a one-line description; unknown ids fall back to XP", () => {
    for (const t of BATTLE_TYPES) {
      expect(t.unit.length).toBeGreaterThan(0);
      expect(t.description.length).toBeLessThan(48);
    }
    expect(battleTypeInfo("nope").id).toBe("xp");
    expect(battleTypeInfo(undefined).id).toBe("xp");
    expect(battleTypeInfo("sleep").label).toBe("Sleep");
  });
});
