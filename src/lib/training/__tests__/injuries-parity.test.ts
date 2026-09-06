import { describe, expect, it } from "vitest";
import { normalizeInjuries as client } from "@/lib/training/injuries";
import { normalizeInjuries as edge } from "../../../../supabase/functions/coach-generate-program/movements";

/**
 * The beginner path (client) and the generator (edge) must read the same tags
 * off the same profile text, or a knee on file swaps the lunge in one and not
 * the other.
 */
const cases: { input: string | string[] | null | undefined; tags: string[] }[] = [
  { input: ["Knee"], tags: ["knee"] },
  { input: ["Lower back", "Shoulder"], tags: ["lower_back", "shoulder"] },
  { input: "Left knee (ACL 2019), rotator cuff", tags: ["knee", "shoulder"] },
  { input: ["polvivamma", "alaselkä"], tags: ["knee", "lower_back"] },
  { input: "Olkapää ja kyynärpää", tags: ["shoulder", "elbow"] },
  { input: ["ranteet", "lonkat", "nilkat", "niska"], tags: ["wrist", "hip", "ankle", "neck"] },
  { input: "whiplash", tags: [] },
  { input: ["hamstring tightness"], tags: [] },
  { input: null, tags: [] },
  { input: undefined, tags: [] },
  { input: "", tags: [] },
];

describe("normalizeInjuries: edge copy matches the client", () => {
  it.each(cases)("%o", ({ input, tags }) => {
    expect([...client(input)].sort()).toEqual([...tags].sort());
    expect(edge(input)).toEqual(client(input));
  });
});
