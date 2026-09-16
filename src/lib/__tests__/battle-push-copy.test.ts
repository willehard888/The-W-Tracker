import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BATTLE_PUSH_KINDS, battlePushCopy, isBattlePushKind } from "../../../supabase/functions/_shared/battle-push";

/**
 * Every kind the SQL trigger and resolver dispatch has push copy, or the
 * push 400s in notify-social and vanishes. Parsed from the migration.
 */
const sql = readFileSync("supabase/migrations/20260918100000_battles_server_resolve.sql", "utf8");

describe("battle push copy", () => {
  it("covers every kind the server dispatches", () => {
    const dispatched = [...sql.matchAll(/dispatch_social_push\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(dispatched.length).toBeGreaterThan(0);
    for (const kind of new Set(dispatched)) expect(isBattlePushKind(kind), kind).toBe(true);
    for (const kind of BATTLE_PUSH_KINDS) expect(dispatched).toContain(kind);
  });

  it("names the other member, routes into the app, and never carries a score", () => {
    for (const kind of BATTLE_PUSH_KINDS) {
      const c = battlePushCopy(kind, "@mika");
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.title.length).toBeLessThanOrEqual(40);
      expect(c.body).toContain("@mika");
      expect(c.body.length).toBeLessThanOrEqual(110);
      expect(["/battles", "/notifications"]).toContain(c.data.route);
      expect(c.body).not.toMatch(/\d/);
      expect(c.title + c.body).not.toMatch(/[—–]/);
    }
    expect(isBattlePushKind("friend_request")).toBe(false);
  });
});
