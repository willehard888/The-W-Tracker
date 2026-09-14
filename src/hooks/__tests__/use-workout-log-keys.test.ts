import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A React Query invalidation matches by positional prefix. The history query
 * is keyed ["exercise-history", userId, slug]; an invalidation of
 * ["exercise-history", slug] put the slug in the user-id slot and matched
 * nothing — logging a set never refreshed the exercise's history. This pins
 * the shape so the two cannot drift apart again.
 */
describe("use-workout-log query keys", () => {
  // vitest runs from the repo root; a cwd-relative path avoids import.meta.url in jsdom.
  const src = readFileSync("src/hooks/use-workout-log.ts", "utf8");

  it("keys exercise history as [name, userId, slug]", () => {
    expect(src).toMatch(/queryKey:\s*\["exercise-history",\s*user\?\.id,\s*slug\]/);
  });

  it("invalidates exercise history by a prefix that matches that key", () => {
    const invalidations = [...src.matchAll(/invalidateQueries\(\{\s*queryKey:\s*(\[[^\]]*"exercise-history"[^\]]*\])/g)].map((m) => m[1]);
    expect(invalidations.length).toBeGreaterThan(0);
    for (const key of invalidations) {
      // Either the bare prefix, or one that starts with the user id — never the slug second.
      expect(key === '["exercise-history"]' || /^\["exercise-history",\s*user\?\.id/.test(key)).toBe(true);
    }
  });
});
