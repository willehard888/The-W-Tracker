// The Whealth Index core is deliberately duplicated: src/lib (client + unit
// tests) and supabase/functions/_shared (Deno edge fn) — a relative import
// across the boundary would break the deploy bundler. This test makes the
// duplication safe: any edit that touches one copy without the other fails CI.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("whealth-index dual-runtime sync", () => {
  it("src/lib and _shared copies are byte-identical", () => {
    const root = join(__dirname, "../../..");
    const client = readFileSync(join(root, "src/lib/whealth-index.ts"), "utf8");
    const edge = readFileSync(join(root, "supabase/functions/_shared/whealth-index.ts"), "utf8");
    expect(edge).toBe(client);
  });
});
