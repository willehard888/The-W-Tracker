import { describe, expect, it } from "vitest";
import { SPORT_CATALOG } from "@/lib/sports";
import { SPORT_LABELS } from "../../../supabase/functions/_shared/sports";

/**
 * Four coach edge functions (ai-coach, coach-daily-plan, coach-daily-brief,
 * coach-weekly-review) carry a sport-id → label table because Supabase bundles
 * each function from its own folder and Deno can't import src/.
 *
 * The drift is silent by construction: sportName() ends in `?? id`, so a sport
 * the client can persist but the edge doesn't know never throws — it drops the
 * raw slug ("icehockey", "xcski") into the AI prompt, and the athlete reads it.
 * `none` had already fallen out this way.
 *
 * Labels themselves are deliberately NOT compared: the edge copy carries the
 * short prompt forms ("Gym", "Running") where the picker shows "Gym / Weights"
 * and "Running / Jogging". The contract is the id set.
 */
describe("sports: the edge label table covers the client catalog", () => {
  it("has exactly the catalog's ids", () => {
    expect(new Set(Object.keys(SPORT_LABELS))).toEqual(new Set(SPORT_CATALOG.map((s) => s.id)));
  });
});
