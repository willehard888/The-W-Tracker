import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUNDLED_FRAME_IDS } from "../illustration-frame-ids";
import { ILLUSTRATION_BY_CATALOG } from "../illustration-map";
import { ILLUSTRATED_EXERCISES } from "../exercises-illustrated";

const DIR = "public/illustrations/frames";

describe("bundled technique frames", () => {
  it("ship both frames for every id in the set, and the set names every file", () => {
    for (const id of BUNDLED_FRAME_IDS) {
      expect(existsSync(`${DIR}/${id}-relaxation.svg`), id).toBe(true);
      expect(existsSync(`${DIR}/${id}-tension.svg`), id).toBe(true);
    }
    const onDisk = new Set(readdirSync(DIR).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, 4)));
    expect([...onDisk].sort()).toEqual([...BUNDLED_FRAME_IDS].sort());
  });

  it("cover every movement the coach can prescribe", () => {
    const bySlug = new Map(ILLUSTRATED_EXERCISES.map((e) => [e.slug, e.idNum]));
    for (const slug of new Set(Object.values(ILLUSTRATION_BY_CATALOG))) {
      const id = bySlug.get(slug);
      expect(id, slug).toBeTruthy();
      expect(BUNDLED_FRAME_IDS.has(id!), slug).toBe(true);
    }
  });
});
