import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cn, TYPE_RUNGS } from "../utils";

describe("cn: the type ladder survives tailwind-merge", () => {
  it("keeps a rung next to a colour (both are text-*)", () => {
    expect(cn("text-label text-muted-foreground")).toBe("text-label text-muted-foreground");
    expect(cn("block text-label font-bold", "text-muted-foreground")).toContain("text-label");
    expect(cn("text-gold", "text-beat")).toBe("text-gold text-beat");
  });

  it("still lets a later rung replace an earlier one", () => {
    expect(cn("text-meta", "text-dense")).toBe("text-dense");
    expect(cn("text-label", "text-[64px]")).toBe("text-[64px]");
  });

  it("knows every rung in tailwind.config.ts", () => {
    const config = readFileSync("tailwind.config.ts", "utf8");
    const block = config.slice(config.indexOf("fontSize: {"), config.indexOf("beat:") + 40);
    const keys = [...block.matchAll(/^\s+([a-z]+): "\d+px"/gm)].map((m) => m[1]);
    expect(keys).toEqual([...TYPE_RUNGS]);
  });
});
