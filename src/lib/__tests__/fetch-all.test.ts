import { describe, expect, it, vi } from "vitest";
import { fetchAll } from "../../../supabase/functions/_shared/fetch-all";

const source = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

describe("fetchAll (edge-function pager)", () => {
  it("walks every page until a short one and preserves order", async () => {
    const rows = source(2_350);
    const build = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    const out = await fetchAll<{ id: number }>(build);
    expect(out).toHaveLength(2_350);
    expect(out[2_349].id).toBe(2_349);
    expect(build).toHaveBeenCalledTimes(3);
  });

  it("stops after one page when the table is smaller than a page", async () => {
    const build = vi.fn(async () => ({ data: source(12), error: null }));
    expect(await fetchAll(build, 100)).toHaveLength(12);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("surfaces the first error", async () => {
    await expect(fetchAll(async () => ({ data: null, error: new Error("boom") }))).rejects.toThrow("boom");
  });
});
