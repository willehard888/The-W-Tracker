import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";

/**
 * List rows show a pre-baked gold copy of each illustration thumbnail instead
 * of filtering it live. A new illustration without its copy would be a broken
 * image in every list: bake it with scripts/bake-gold-thumbs.mjs.
 */
describe("gold thumbnails", () => {
  it("every bundled thumbnail has its baked gold twin", () => {
    const thumbs = readdirSync("public/illustrations").filter((f) => /^\d+\.webp$/.test(f));
    expect(thumbs.length).toBeGreaterThan(200);
    expect(thumbs.filter((f) => !existsSync(`public/illustrations/gold/${f}`))).toEqual([]);
  });
});
