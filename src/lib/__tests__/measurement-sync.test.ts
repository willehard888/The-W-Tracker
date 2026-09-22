import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The missing-is-not-zero rule has to mean the same thing on both runtimes.
 *
 * The edge functions decide what the AI Coach is told and what a push
 * notification says; the client decides what is written to the night table. A
 * drift between the two copies is how "no watch worn" becomes "zero hours of
 * sleep" again on one side only, which is exactly the shape of the bug this
 * module exists to prevent.
 */
describe("measurement dual-runtime sync", () => {
  it("src/lib and _shared copies are byte-identical", () => {
    const root = join(__dirname, "../../..");
    const client = readFileSync(join(root, "src/lib/health/measurement.ts"), "utf8");
    const edge = readFileSync(join(root, "supabase/functions/_shared/measurement.ts"), "utf8");
    expect(edge).toBe(client);
  });
});
