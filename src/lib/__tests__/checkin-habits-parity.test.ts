import { describe, expect, it } from "vitest";
import { CHECKIN_HABITS, CORE_KEYS, DEFAULT_CHECKIN_KEYS } from "@/lib/checkin-habits";
import {
  SHARED_CHECKIN_HABITS,
  CORE_KEYS as sharedCoreKeys,
  DEFAULT_CHECKIN_KEYS as sharedDefaultKeys,
} from "../../../supabase/functions/_shared/checkin-habits";

/**
 * The coach's edge functions carry a slim copy of the habit catalog — Supabase
 * bundles each function from its own folder, so Deno can't reach into src/.
 * Both files say "keep in sync" and nothing enforced it.
 *
 * Every way these drift is silent:
 * - a habit added only client-side is invisible to the coach;
 * - a wrong `column` sends habitDoneOnRow to the habits jsonb instead of the
 *   legacy boolean, and every completion of that habit reads as a miss;
 * - a `cadence: "bonus"` set on one side only makes the coach frame an
 *   optional second session as a gap, which the founder ruled out.
 */
const clientByKey = new Map(CHECKIN_HABITS.map((h) => [h.key, h]));
const sharedByKey = new Map(SHARED_CHECKIN_HABITS.map((h) => [h.key, h]));

// Both resolvers filter their own catalog in place, so order is part of the
// contract, not just membership.
describe("checkin-habits: edge copy matches the client", () => {
  it("lists the same keys in the same order", () => {
    expect(SHARED_CHECKIN_HABITS.map((h) => h.key)).toEqual(CHECKIN_HABITS.map((h) => h.key));
  });

  it.each(CHECKIN_HABITS.map((h) => h.key))("%s: same label, pillar and cadence", (key) => {
    const shared = sharedByKey.get(key);
    expect(shared).toBeDefined();
    const client = clientByKey.get(key)!;
    expect(shared!.label).toBe(client.label);
    expect(shared!.pillar).toBe(client.pillar);
    expect(shared!.cadence).toBe(client.cadence);
  });

  it.each(CHECKIN_HABITS.filter((h) => h.key !== "workout").map((h) => h.key))(
    "%s: same daily_checkins column",
    (key) => {
      expect(sharedByKey.get(key)?.column).toBe(clientByKey.get(key)!.column);
    },
  );

  /**
   * The one deliberate asymmetry. `workout` is a core habit the client renders
   * through the sport picker, so the client never needs a column mapping;
   * habitDoneOnRow does. Pinned here so it reads as a decision, not a gap.
   */
  it("workout keeps its edge-only column mapping", () => {
    expect(sharedByKey.get("workout")?.column).toBe("workout");
    expect(clientByKey.get("workout")?.column).toBeUndefined();
  });

  it("agrees on the core and default key lists", () => {
    expect(sharedCoreKeys).toEqual(CORE_KEYS);
    expect(sharedDefaultKeys).toEqual(DEFAULT_CHECKIN_KEYS);
  });
});
