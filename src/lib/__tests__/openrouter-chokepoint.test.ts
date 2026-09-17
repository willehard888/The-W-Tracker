import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * One door to the model provider (supabase/functions/_shared/openrouter.ts).
 * It is where the member's AI consent is enforced, where the no-retention
 * routing is set and where every call gets its timeout. A second `fetch` to
 * the provider anywhere would quietly bypass all three, which is exactly how
 * twelve functions came to send personal data with no consent at all.
 */
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : statSync(p).isFile() ? [p] : [];
  });

describe("the model provider has one door", () => {
  it("no function names the provider's host except the shared module", () => {
    const offenders = walk("supabase/functions")
      // latin1: at least one function is not valid UTF-8 and plain reads miss it.
      .filter((f) => readFileSync(f, "latin1").includes("openrouter.ai"))
      .filter((f) => !f.endsWith("_shared/openrouter.ts"));
    expect(offenders).toEqual([]);
  });

  it("and the walker really reads them (it would pass on an empty list otherwise)", () => {
    const files = walk("supabase/functions").filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(30);
    expect(files.some((f) => f.endsWith("ai-coach/index.ts"))).toBe(true);
  });
});
