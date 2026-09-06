import { describe, expect, it } from "vitest";
import { PRIORITY_SLUGS as client } from "@/data/illustration-map";
import { PRIORITY_SLUGS as edge } from "../../../supabase/functions/_shared/illustrated-catalog";

/**
 * The generator (an edge function, bundled from its own folder) carries a copy
 * of the illustrated slugs because it cannot import src/. If the copies drift,
 * the coach prefers movements the app cannot draw — or stops preferring ones it
 * can — and nothing throws.
 */
describe("PRIORITY_SLUGS: edge copy matches the client", () => {
  it("is the same set", () => {
    expect(new Set(edge)).toEqual(new Set(client));
    expect(edge).toHaveLength(client.length);
  });
});
